package com.weyvo.api.social;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import com.weyvo.api.trip.StoryGate;
import com.weyvo.api.trip.Trip;
import com.weyvo.api.trip.TripRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Open comments on a trip with one level of replies. The trip's author moderates; readers can report. */
@Service
public class CommentService {

    static final int MAX_COMMENT = 500;

    public record Author(String username, String displayName, String avatarUrl) {}

    /** status is filled in only for the trip's author; everyone else sees visible comments only. */
    public record Comment(long id, Long parentId, String body, Author author, Instant createdAt, String status, boolean mine,
                          List<Comment> replies) {}

    /** When locked (signed-out preview), only the count is returned, like the rest of the full story. */
    public record Comments(boolean locked, int count, List<Comment> items) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final TripRepository trips;
    private final StoryGate gate;
    private final NotificationService notifications;
    private final AppProperties.Community rules;
    private final BlockService blocks;

    public CommentService(NamedParameterJdbcTemplate jdbc, TripRepository trips, StoryGate gate,
                          NotificationService notifications, AppProperties props, BlockService blocks) {
        this.blocks = blocks;
        this.jdbc = jdbc;
        this.trips = trips;
        this.gate = gate;
        this.notifications = notifications;
        this.rules = props.community();
    }

    @Transactional(readOnly = true)
    public Comments list(long tripId, Long viewerId) {
        Trip trip = visibleTrip(tripId, viewerId);
        boolean owner = trip.isOwnedBy(viewerId);
        var params = new MapSqlParameterSource().addValue("t", tripId).addValue("v", viewerId).addValue("owner", owner);
        // Comments from people the viewer blocked, or who blocked the viewer, are left out.
        String filter = "c.trip_id = :t AND (:owner OR c.status = 'VISIBLE') AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = CAST(:v AS BIGINT) AND b.blocked_id = c.author_id) OR (b.blocker_id = c.author_id AND b.blocked_id = CAST(:v AS BIGINT)))";
        if (gate.locked(trip, viewerId)) {
            Integer n = jdbc.queryForObject("SELECT count(*) FROM trip_comments c WHERE " + filter, params, Integer.class);
            return new Comments(true, n == null ? 0 : n, List.of());
        }
        List<Comment> flat = jdbc.query("""
                SELECT c.id, c.parent_id, c.body, c.created_at, c.status, c.author_id, u.username, u.display_name, u.avatar_version
                FROM trip_comments c JOIN users u ON u.id = c.author_id AND u.status = 'ACTIVE'
                WHERE """ + " " + filter + " ORDER BY c.created_at", params,
                (rs, i) -> new Comment(rs.getLong("id"), (Long) rs.getObject("parent_id"), rs.getString("body"),
                        new Author(rs.getString("username"), rs.getString("display_name"), com.weyvo.api.user.Avatars.url(rs.getString("username"), (Integer) rs.getObject("avatar_version"))), rs.getTimestamp("created_at").toInstant(),
                        owner ? rs.getString("status") : null, viewerId != null && rs.getLong("author_id") == viewerId, new ArrayList<>()));
        // Thread replies under their parent; a reply whose parent is hidden from this viewer is dropped with it.
        Map<Long, Comment> top = new LinkedHashMap<>();
        flat.stream().filter(c -> c.parentId() == null).forEach(c -> top.put(c.id(), c));
        flat.stream().filter(c -> c.parentId() != null && top.containsKey(c.parentId())).forEach(c -> top.get(c.parentId()).replies().add(c));
        int count = top.values().stream().mapToInt(c -> 1 + c.replies().size()).sum();
        return new Comments(false, count, List.copyOf(top.values()));
    }

    /** A comment, or a reply when parentId is set. The author is notified of comments, the parent's author of replies. */
    @Transactional
    public Comment post(long userId, long tripId, String body, Long parentId) {
        Trip trip = visibleTrip(tripId, userId);
        if (trip.getStatus() != Trip.Status.PUBLISHED) throw ApiException.notFound();
        String text = clean(body);
        Integer recent = jdbc.queryForObject("SELECT count(*) FROM trip_comments WHERE author_id = :u AND created_at > now() - interval '1 hour'",
                new MapSqlParameterSource("u", userId), Integer.class);
        if (recent != null && recent >= rules.commentsPerHour()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "You've commented a lot in the last hour. Try again later");
        }
        Long parentAuthor = null;
        if (parentId != null) {
            Row parent = row(parentId);
            if (parent.tripId() != tripId || parent.parentId() != null || !"VISIBLE".equals(parent.status())) {
                throw ApiException.badRequest("You can only reply to a comment on this story");
            }
            parentAuthor = parent.authorId();
            if (blocks.between(userId, parentAuthor)) throw ApiException.notFound();
        }
        Long id = jdbc.queryForObject("INSERT INTO trip_comments (trip_id, author_id, parent_id, body) VALUES (:t, :u, :p, :b) RETURNING id",
                new MapSqlParameterSource().addValue("t", tripId).addValue("u", userId).addValue("p", parentId).addValue("b", text), Long.class);
        long ownerId = trip.getOwner().getId();
        if (parentAuthor != null) {
            notifications.notify(parentAuthor, userId, NotificationService.Type.REPLY, tripId, null, id);
        }
        // The trip's author hears about every comment, unless the reply was already addressed to them.
        if (parentAuthor == null || parentAuthor != ownerId) {
            notifications.notify(ownerId, userId, NotificationService.Type.COMMENT, tripId, null, id);
        }
        return one(id, userId, false);
    }

    @Transactional
    public Comment setHidden(long ownerId, long commentId, boolean hidden) {
        ownedComment(ownerId, commentId);
        jdbc.update("UPDATE trip_comments SET status = :s WHERE id = :id",
                new MapSqlParameterSource().addValue("s", hidden ? "HIDDEN_BY_AUTHOR" : "VISIBLE").addValue("id", commentId));
        return one(commentId, ownerId, true);
    }

    /** The commenter can remove their own comment; the trip's author can remove any on their trip. Replies go with it. */
    @Transactional
    public void delete(long userId, long commentId) {
        Row c = row(commentId);
        Trip trip = trips.findById(c.tripId()).orElseThrow(ApiException::notFound);
        if (c.authorId() != userId && !trip.isOwnedBy(userId)) throw ApiException.notFound();
        jdbc.update("DELETE FROM trip_comments WHERE id = :id", new MapSqlParameterSource("id", commentId));
    }

    @Transactional
    public void report(long userId, long commentId, String reason) {
        Row c = row(commentId);
        visibleTrip(c.tripId(), userId);
        if (c.authorId() == userId) throw ApiException.badRequest("You can't report your own comment");
        String r = reason == null ? "OTHER" : reason.toUpperCase(Locale.ROOT);
        if (!List.of("SPAM", "ABUSE", "OFF_TOPIC", "OTHER").contains(r)) throw ApiException.badRequest("Pick a reason for the report");
        var params = new MapSqlParameterSource().addValue("c", commentId).addValue("u", userId).addValue("r", r).addValue("n", rules.reportsToHide());
        jdbc.update("INSERT INTO comment_reports (comment_id, reporter_id, reason) VALUES (:c, :u, :r) ON CONFLICT DO NOTHING", params);
        jdbc.update("""
                UPDATE trip_comments SET status = 'HIDDEN_BY_REPORTS'
                WHERE id = :c AND status = 'VISIBLE'
                  AND (SELECT count(*) FROM comment_reports WHERE comment_id = :c AND reviewed_at IS NULL) >= :n""", params);
    }

    // ---- helpers ----

    private record Row(long id, long tripId, long authorId, Long parentId, String status) {}

    private Row row(long commentId) {
        return jdbc.query("SELECT id, trip_id, author_id, parent_id, status FROM trip_comments WHERE id = :id",
                        new MapSqlParameterSource("id", commentId),
                        (rs, i) -> new Row(rs.getLong("id"), rs.getLong("trip_id"), rs.getLong("author_id"), (Long) rs.getObject("parent_id"), rs.getString("status")))
                .stream().findFirst().orElseThrow(ApiException::notFound);
    }

    private void ownedComment(long ownerId, long commentId) {
        Row c = row(commentId);
        trips.findById(c.tripId()).filter(t -> t.isOwnedBy(ownerId)).orElseThrow(ApiException::notFound);
    }

    private Trip visibleTrip(long tripId, Long viewerId) {
        return trips.findById(tripId).filter(t -> t.isVisibleTo(viewerId) && !blocks.between(viewerId, t.getOwner().getId()))
                .orElseThrow(ApiException::notFound);
    }

    private Comment one(long commentId, long viewerId, boolean owner) {
        return jdbc.query("""
                SELECT c.id, c.parent_id, c.body, c.created_at, c.status, c.author_id, u.username, u.display_name, u.avatar_version
                FROM trip_comments c JOIN users u ON u.id = c.author_id WHERE c.id = :id""",
                new MapSqlParameterSource("id", commentId),
                (rs, i) -> new Comment(rs.getLong("id"), (Long) rs.getObject("parent_id"), rs.getString("body"),
                        new Author(rs.getString("username"), rs.getString("display_name"), com.weyvo.api.user.Avatars.url(rs.getString("username"), (Integer) rs.getObject("avatar_version"))), rs.getTimestamp("created_at").toInstant(),
                        owner ? rs.getString("status") : null, rs.getLong("author_id") == viewerId, new ArrayList<>())).get(0);
    }

    private static String clean(String text) {
        String t = text == null ? "" : text.strip();
        if (t.isEmpty()) throw ApiException.badRequest("Write your comment first");
        if (t.length() > MAX_COMMENT) throw ApiException.badRequest("Keep your comment under " + MAX_COMMENT + " characters");
        return t;
    }
}
