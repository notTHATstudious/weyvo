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
                UNION ALL
                SELECT 'TRIP', t.id, left(COALESCE(t.title || ' · ' || (SELECT s.body FROM trip_sections s WHERE s.trip_id = t.id ORDER BY s.position LIMIT 1), t.title), 300),
                       u.username, t.slug, t.title, true, 0, 'AUTO_' || t.held_reason, t.updated_at
                FROM trips t JOIN users u ON u.id = t.owner_id
                WHERE t.held_reason IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trip_reports r WHERE r.trip_id = t.id AND r.reviewed_at IS NULL)
                UNION ALL
                SELECT 'COMMENT', c.id, c.body, u.username, t.slug, t.title, true, 0, 'AUTO_' || c.held_reason, c.created_at
                FROM trip_comments c JOIN trips t ON t.id = c.trip_id JOIN users u ON u.id = c.author_id
                WHERE c.held_reason IS NOT NULL AND NOT EXISTS (SELECT 1 FROM comment_reports r WHERE r.comment_id = c.id AND r.reviewed_at IS NULL)
                UNION ALL
                SELECT 'QUESTION', q.id, q.body, u.username, t.slug, t.title, true, 0, 'AUTO_' || q.held_reason, q.created_at
                FROM trip_questions q JOIN trips t ON t.id = q.trip_id JOIN users u ON u.id = q.asker_id
                WHERE q.held_reason IS NOT NULL AND NOT EXISTS (SELECT 1 FROM question_reports r WHERE r.question_id = q.id AND r.reviewed_at IS NULL)
                ORDER BY last DESC LIMIT 100""", new MapSqlParameterSource(),
                (rs, i) -> new Report(Kind.valueOf(rs.getString("kind")), rs.getLong("id"), rs.getString("text"), rs.getString("author"),
                        rs.getString("slug"), rs.getString("title"), rs.getBoolean("hidden"), rs.getInt("n"),
                        Arrays.asList(rs.getString("reasons").split(",")), rs.getTimestamp("last").toInstant()));
    }

    /** Strikes that suspend an account. */
    static final int STRIKE_LIMIT = 3;

    /**
     * Hide takes the item down and gives its author a strike (three suspend the account); keep puts it back.
     * Either way its open reports, and any word-filter hold, are cleared.
     */
    @Transactional
    public void decide(Kind kind, long id, boolean hide) {
        var p = new MapSqlParameterSource().addValue("id", id).addValue("hide", hide);
        Long author = switch (kind) {
            case TRIP -> one("""
                    UPDATE trips SET removed_at = CASE WHEN :hide THEN COALESCE(removed_at, now()) END, held_reason = NULL
                    WHERE id = :id RETURNING owner_id""", p);
            // A comment or question its trip's author hid stays hidden when the admin keeps it.
            case COMMENT -> one("""
                    UPDATE trip_comments SET status = CASE WHEN :hide THEN 'HIDDEN_BY_REPORTS'
                        WHEN status = 'HIDDEN_BY_REPORTS' THEN 'VISIBLE' ELSE status END, held_reason = NULL
                    WHERE id = :id RETURNING author_id""", p);
            case QUESTION -> one("""
                    UPDATE trip_questions SET status = CASE WHEN :hide THEN 'HIDDEN_BY_REPORTS'
                        WHEN status = 'HIDDEN_BY_REPORTS' THEN 'VISIBLE' ELSE status END, held_reason = NULL
                    WHERE id = :id RETURNING asker_id""", p);
        };
        if (author == null) throw ApiException.notFound();
        if (hide) {
            jdbc.update("""
                    UPDATE users SET strikes = strikes + 1,
                           status = CASE WHEN strikes + 1 >= :limit AND NOT is_admin THEN 'SUSPENDED' ELSE status END,
                           session_version = CASE WHEN strikes + 1 >= :limit AND NOT is_admin THEN session_version + 1 ELSE session_version END
                    WHERE id = :u""", new MapSqlParameterSource().addValue("u", author).addValue("limit", STRIKE_LIMIT));
        }
        String reports = switch (kind) {
            case TRIP -> "UPDATE trip_reports SET reviewed_at = now() WHERE trip_id = :id";
            case COMMENT -> "UPDATE comment_reports SET reviewed_at = now() WHERE comment_id = :id";
            case QUESTION -> "UPDATE question_reports SET reviewed_at = now() WHERE question_id = :id";
        };
        jdbc.update(reports + " AND reviewed_at IS NULL", p);
    }

    private Long one(String sql, MapSqlParameterSource p) {
        return jdbc.query(sql, p, (rs, i) -> rs.getLong(1)).stream().findFirst().orElse(null);
    }

    /** Lifts a suspension. The person signs in again as normal. */
    @Transactional
    public void restore(String username) {
        int n = jdbc.update("UPDATE users SET status = 'ACTIVE', strikes = 0 WHERE lower(username) = lower(:n) AND status = 'SUSPENDED'",
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
