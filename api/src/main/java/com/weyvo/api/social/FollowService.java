package com.weyvo.api.social;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.user.User;
import com.weyvo.api.user.UserRepository;
import java.util.List;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FollowService {

    public record FollowStats(int followers, int following, boolean followedByMe) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository users;
    private final NotificationService notifications;
    private final BlockService blocks;

    public FollowService(NamedParameterJdbcTemplate jdbc, UserRepository users, NotificationService notifications, BlockService blocks) {
        this.blocks = blocks;
        this.jdbc = jdbc;
        this.users = users;
        this.notifications = notifications;
    }

    @Transactional
    public FollowStats set(long followerId, String username, boolean on) {
        User target = users.findByUsernameIgnoreCase(username).filter(User::isActive).orElseThrow(ApiException::notFound);
        if (target.getId() == followerId) throw ApiException.badRequest("You can't follow yourself");
        if (on && blocks.between(followerId, target.getId())) throw ApiException.notFound();
        var params = new MapSqlParameterSource().addValue("a", followerId).addValue("b", target.getId());
        if (on) {
            jdbc.update("INSERT INTO follows (follower_id, followee_id) VALUES (:a, :b) ON CONFLICT DO NOTHING", params);
            notifications.notify(target.getId(), followerId, NotificationService.Type.FOLLOW, null, null);
        } else {
            jdbc.update("DELETE FROM follows WHERE follower_id = :a AND followee_id = :b", params);
        }
        return stats(target.getId(), followerId);
    }

    @Transactional(readOnly = true)
    public FollowStats stats(long userId, Long viewerId) {
        var params = new MapSqlParameterSource().addValue("u", userId).addValue("v", viewerId);
        Integer followers = jdbc.queryForObject("SELECT count(*) FROM follows WHERE followee_id = :u", params, Integer.class);
        Integer following = jdbc.queryForObject("SELECT count(*) FROM follows WHERE follower_id = :u", params, Integer.class);
        boolean mine = viewerId != null && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = :v AND followee_id = :u)", params, Boolean.class));
        return new FollowStats(followers == null ? 0 : followers, following == null ? 0 : following, mine);
    }

    public record Person(String username, String displayName, String avatarUrl, boolean followedByMe) {}

    /**
     * Who follows someone, or who they follow, newest first. Suspended accounts and anyone in a block with
     * the viewer are left out; if the person themselves blocked the viewer, they aren't found at all.
     */
    @Transactional(readOnly = true)
    public List<Person> list(String username, boolean followers, Long viewerId) {
        User target = users.findByUsernameIgnoreCase(username).filter(User::isActive).orElseThrow(ApiException::notFound);
        if (viewerId != null && viewerId != target.getId() && blocks.between(viewerId, target.getId()) && !blocks.blockedByMe(viewerId, target.getId())) {
            throw ApiException.notFound();
        }
        String join = followers ? "f.follower_id" : "f.followee_id";
        String where = followers ? "f.followee_id" : "f.follower_id";
        return jdbc.query("""
                SELECT u.username, u.display_name, u.avatar_version,
                       EXISTS (SELECT 1 FROM follows m WHERE m.follower_id = CAST(:v AS BIGINT) AND m.followee_id = u.id) AS mine
                FROM follows f JOIN users u ON u.id = %s AND u.status = 'ACTIVE'
                WHERE %s = :t
                  AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = CAST(:v AS BIGINT) AND b.blocked_id = u.id)
                                                              OR (b.blocker_id = u.id AND b.blocked_id = CAST(:v AS BIGINT)))
                ORDER BY f.created_at DESC LIMIT 200""".formatted(join, where),
                new MapSqlParameterSource().addValue("t", target.getId()).addValue("v", viewerId),
                (rs, i) -> new Person(rs.getString("username"), rs.getString("display_name"),
                        com.weyvo.api.user.Avatars.url(rs.getString("username"), (Integer) rs.getObject("avatar_version")), rs.getBoolean("mine")));
    }

    public record Suggestion(String username, String displayName, String avatarUrl, int stories) {}

    /**
     * Travellers worth following: active people with the most public stories (recent ones count most),
     * leaving out the viewer, people they already follow, and anyone in a block with them.
     */
    @Transactional(readOnly = true)
    public List<Suggestion> suggestions(Long viewerId) {
        return jdbc.query("""
                SELECT u.username, u.display_name, u.avatar_version, count(t.id) AS stories,
                       max(t.published_at) AS latest
                FROM users u
                JOIN trips t ON t.owner_id = u.id AND t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL
                WHERE u.status = 'ACTIVE' AND u.id <> COALESCE(CAST(:v AS BIGINT), -1)
                  AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = CAST(:v AS BIGINT) AND f.followee_id = u.id)
                  AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = CAST(:v AS BIGINT) AND b.blocked_id = u.id)
                                                              OR (b.blocker_id = u.id AND b.blocked_id = CAST(:v AS BIGINT)))
                GROUP BY u.id
                ORDER BY count(t.id) FILTER (WHERE t.published_at > now() - interval '30 days') DESC, count(t.id) DESC, latest DESC
                LIMIT 6""", new MapSqlParameterSource("v", viewerId),
                (rs, i) -> new Suggestion(rs.getString("username"), rs.getString("display_name"),
                        com.weyvo.api.user.Avatars.url(rs.getString("username"), (Integer) rs.getObject("avatar_version")), rs.getInt("stories")));
    }

    @Transactional(readOnly = true)
    public List<Long> followeeIds(long followerId) {
        return jdbc.queryForList("SELECT followee_id FROM follows WHERE follower_id = :a",
                new MapSqlParameterSource("a", followerId), Long.class);
    }
}
