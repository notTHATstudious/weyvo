package com.weyvo.api.admin;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.social.BlockService;
import com.weyvo.api.trip.Trip;
import com.weyvo.api.trip.TripRepository;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Story reports from readers, and the admin queue that reviews reported stories, comments and questions. */
@Service
public class ModerationService {

    public enum Kind { TRIP, COMMENT, QUESTION }

    /** One reported item with its open (unreviewed) reports. text is a short excerpt for review. */
    public record Report(Kind kind, long id, String text, String author, String tripSlug, String tripTitle, boolean hidden,
                         int reports, List<String> reasons, Instant lastReportedAt) {}

    private static final List<String> REASONS = List.of("SPAM", "ABUSE", "OFF_TOPIC", "OTHER");

    private final NamedParameterJdbcTemplate jdbc;
    private final TripRepository trips;
    private final BlockService blocks;

    public ModerationService(NamedParameterJdbcTemplate jdbc, TripRepository trips, BlockService blocks) {
        this.jdbc = jdbc;
        this.trips = trips;
        this.blocks = blocks;
    }

    /** One report per reader per story. Stories are never hidden automatically; an admin decides. */
    @Transactional
    public void reportTrip(long userId, long tripId, String reason) {
        Trip trip = trips.findById(tripId)
                .filter(t -> t.isVisibleTo(userId) && t.getStatus() == Trip.Status.PUBLISHED && !blocks.between(userId, t.getOwner().getId()))
                .orElseThrow(ApiException::notFound);
        if (trip.isOwnedBy(userId)) throw ApiException.badRequest("You can't report your own story");
        String r = reason == null ? "OTHER" : reason.toUpperCase(Locale.ROOT);
        if (!REASONS.contains(r)) throw ApiException.badRequest("Pick a reason for the report");
        jdbc.update("""
                INSERT INTO trip_reports (trip_id, reporter_id, reason) VALUES (:t, :u, :r)
                ON CONFLICT (trip_id, reporter_id) DO UPDATE SET reason = :r, created_at = now(), reviewed_at = NULL""",
                new MapSqlParameterSource().addValue("t", tripId).addValue("u", userId).addValue("r", r));
    }

    /** Items with open reports, most recently reported first. */
    @Transactional(readOnly = true)
    public List<Report> queue() {
        return jdbc.query("""
                SELECT 'TRIP' AS kind, t.id, left(COALESCE(t.intro, (SELECT s.body FROM trip_sections s WHERE s.trip_id = t.id ORDER BY s.position LIMIT 1), ''), 300) AS text,
                       u.username AS author, t.slug, t.title, t.removed_at IS NOT NULL AS hidden,
                       count(*) AS n, string_agg(DISTINCT r.reason, ',') AS reasons, max(r.created_at) AS last
                FROM trip_reports r JOIN trips t ON t.id = r.trip_id JOIN users u ON u.id = t.owner_id
                WHERE r.reviewed_at IS NULL GROUP BY t.id, u.username
                UNION ALL
                SELECT 'COMMENT', c.id, c.body, u.username, t.slug, t.title, c.status <> 'VISIBLE',
                       count(*), string_agg(DISTINCT r.reason, ','), max(r.created_at)
                FROM comment_reports r JOIN trip_comments c ON c.id = r.comment_id JOIN trips t ON t.id = c.trip_id JOIN users u ON u.id = c.author_id
                WHERE r.reviewed_at IS NULL GROUP BY c.id, u.username, t.slug, t.title
                UNION ALL
                SELECT 'QUESTION', q.id, q.body, u.username, t.slug, t.title, q.status <> 'VISIBLE',
                       count(*), string_agg(DISTINCT r.reason, ','), max(r.created_at)
                FROM question_reports r JOIN trip_questions q ON q.id = r.question_id JOIN trips t ON t.id = q.trip_id JOIN users u ON u.id = q.asker_id
                WHERE r.reviewed_at IS NULL GROUP BY q.id, u.username, t.slug, t.title
                ORDER BY last DESC LIMIT 100""", new MapSqlParameterSource(),
                (rs, i) -> new Report(Kind.valueOf(rs.getString("kind")), rs.getLong("id"), rs.getString("text"), rs.getString("author"),
                        rs.getString("slug"), rs.getString("title"), rs.getBoolean("hidden"), rs.getInt("n"),
                        Arrays.asList(rs.getString("reasons").split(",")), rs.getTimestamp("last").toInstant()));
    }

    /** Hide takes the item down; keep restores it. Either way its open reports are marked reviewed. */
    @Transactional
    public void decide(Kind kind, long id, boolean hide) {
        var p = new MapSqlParameterSource().addValue("id", id).addValue("hide", hide);
        int changed = switch (kind) {
            case TRIP -> jdbc.update("UPDATE trips SET removed_at = CASE WHEN :hide THEN COALESCE(removed_at, now()) END WHERE id = :id", p);
            // A comment or question its trip's author hid stays hidden when the admin keeps it.
            case COMMENT -> jdbc.update("""
                    UPDATE trip_comments SET status = CASE WHEN :hide THEN 'HIDDEN_BY_REPORTS'
                        WHEN status = 'HIDDEN_BY_REPORTS' THEN 'VISIBLE' ELSE status END WHERE id = :id""", p);
            case QUESTION -> jdbc.update("""
                    UPDATE trip_questions SET status = CASE WHEN :hide THEN 'HIDDEN_BY_REPORTS'
                        WHEN status = 'HIDDEN_BY_REPORTS' THEN 'VISIBLE' ELSE status END WHERE id = :id""", p);
        };
        if (changed == 0) throw ApiException.notFound();
        String reports = switch (kind) {
            case TRIP -> "UPDATE trip_reports SET reviewed_at = now() WHERE trip_id = :id";
            case COMMENT -> "UPDATE comment_reports SET reviewed_at = now() WHERE comment_id = :id";
            case QUESTION -> "UPDATE question_reports SET reviewed_at = now() WHERE question_id = :id";
        };
        jdbc.update(reports + " AND reviewed_at IS NULL", p);
    }

    /** Lifts a suspension. The person signs in again as normal. */
    @Transactional
    public void restore(String username) {
        int n = jdbc.update("UPDATE users SET status = 'ACTIVE' WHERE lower(username) = lower(:n) AND status = 'SUSPENDED'",
                new MapSqlParameterSource("n", username));
        if (n == 0) throw ApiException.notFound();
    }

    /** Suspends an account and ends its sessions at once. Admins can't be suspended from the app. */
    @Transactional
    public void suspend(long adminId, String username) {
        int n = jdbc.update("""
                UPDATE users SET status = 'SUSPENDED', session_version = session_version + 1
                WHERE lower(username) = lower(:n) AND status = 'ACTIVE' AND NOT is_admin AND id <> :a""",
                new MapSqlParameterSource().addValue("n", username).addValue("a", adminId));
        if (n == 0) throw ApiException.notFound();
    }
}
