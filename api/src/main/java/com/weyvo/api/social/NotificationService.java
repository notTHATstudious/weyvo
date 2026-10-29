package com.weyvo.api.social;

import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** In-app notifications for follows, reactions, questions and answers. */
@Service
public class NotificationService {

    public enum Type { FOLLOW, BEEN, WANT, QUESTION, ANSWER, COMMENT, REPLY }

    public record Actor(String username, String displayName, String avatarUrl) {}
    public record TripLink(String slug, String title) {}
    public record Item(long id, Type type, Actor actor, TripLink trip, boolean read, Instant createdAt) {}

    private final NamedParameterJdbcTemplate jdbc;

    public NotificationService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Records an event once. Self-actions and repeats of the same event are ignored. */
    @Transactional
    public void notify(long recipientId, long actorId, Type type, Long tripId, Long questionId) {
        notify(recipientId, actorId, type, tripId, questionId, null);
    }

    @Transactional
    public void notify(long recipientId, long actorId, Type type, Long tripId, Long questionId, Long commentId) {
        if (recipientId == actorId) return;
        // Nothing passes between two people when either has blocked the other.
        jdbc.update("""
                INSERT INTO notifications (recipient_id, actor_id, type, trip_id, question_id, comment_id)
                SELECT :r, :a, :type, :trip, :q, :c
                WHERE NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = :r AND blocked_id = :a) OR (blocker_id = :a AND blocked_id = :r))
                ON CONFLICT DO NOTHING""",
                new MapSqlParameterSource().addValue("r", recipientId).addValue("a", actorId)
                        .addValue("type", type.name()).addValue("trip", tripId).addValue("q", questionId).addValue("c", commentId));
    }

    /**
     * Newest first. A trip link is shown only while the recipient may still see that trip, so a trip that
     * went private or back to draft doesn't keep leaking its title.
     */
    @Transactional(readOnly = true)
    public List<Item> inbox(long userId, int limit) {
        return jdbc.query("""
                SELECT n.id, n.type, n.read_at, n.created_at, a.username, a.display_name, a.avatar_version,
                       CASE WHEN t.owner_id = :u OR (t.status = 'PUBLISHED' AND t.visibility <> 'PRIVATE' AND t.removed_at IS NULL)
                            THEN t.slug END AS slug,
                       CASE WHEN t.owner_id = :u OR (t.status = 'PUBLISHED' AND t.visibility <> 'PRIVATE' AND t.removed_at IS NULL)
                            THEN t.title END AS title
                FROM notifications n
                JOIN users a ON a.id = n.actor_id AND a.status = 'ACTIVE'
                LEFT JOIN trips t ON t.id = n.trip_id
                WHERE n.recipient_id = :u
                ORDER BY n.created_at DESC
                LIMIT :n""",
                new MapSqlParameterSource().addValue("u", userId).addValue("n", limit),
                (rs, i) -> new Item(rs.getLong("id"), Type.valueOf(rs.getString("type")),
                        new Actor(rs.getString("username"), rs.getString("display_name"), com.weyvo.api.user.Avatars.url(rs.getString("username"), (Integer) rs.getObject("avatar_version"))),
                        rs.getString("slug") == null ? null : new TripLink(rs.getString("slug"), rs.getString("title")),
                        rs.getTimestamp("read_at") != null, rs.getTimestamp("created_at").toInstant()));
    }

    @Transactional(readOnly = true)
    public int unreadCount(long userId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM notifications WHERE recipient_id = :u AND read_at IS NULL",
                new MapSqlParameterSource("u", userId), Integer.class);
        return n == null ? 0 : n;
    }

    @Transactional
    public void markAllRead(long userId) {
        jdbc.update("UPDATE notifications SET read_at = now() WHERE recipient_id = :u AND read_at IS NULL",
                new MapSqlParameterSource("u", userId));
    }
}
