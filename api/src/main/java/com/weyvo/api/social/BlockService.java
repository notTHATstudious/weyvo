package com.weyvo.api.social;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.user.Avatars;
import com.weyvo.api.user.User;
import com.weyvo.api.user.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Blocking works both ways: once either person blocks the other, neither sees the other's profile, stories,
 * comments or questions, and neither can follow, react, comment, ask or notify the other.
 */
@Service
public class BlockService {

    public record Blocked(String username, String displayName, String avatarUrl) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository users;

    public BlockService(NamedParameterJdbcTemplate jdbc, UserRepository users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    /** Blocking also ends any follow in either direction. */
    @Transactional
    public void block(long blockerId, String username) {
        User target = users.findByUsernameIgnoreCase(username).filter(User::isActive).orElseThrow(ApiException::notFound);
        if (target.getId() == blockerId) throw ApiException.badRequest("You can't block yourself");
        var p = new MapSqlParameterSource().addValue("a", blockerId).addValue("b", target.getId());
        jdbc.update("INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (:a, :b) ON CONFLICT DO NOTHING", p);
        jdbc.update("DELETE FROM follows WHERE (follower_id = :a AND followee_id = :b) OR (follower_id = :b AND followee_id = :a)", p);
    }

    @Transactional
    public void unblock(long blockerId, String username) {
        jdbc.update("""
                DELETE FROM user_blocks WHERE blocker_id = :a
                  AND blocked_id = (SELECT id FROM users WHERE lower(username) = lower(:n))""",
                new MapSqlParameterSource().addValue("a", blockerId).addValue("n", username));
    }

    @Transactional(readOnly = true)
    public List<Blocked> list(long blockerId) {
        return jdbc.query("""
                SELECT u.username, u.display_name, u.avatar_version FROM user_blocks b JOIN users u ON u.id = b.blocked_id
                WHERE b.blocker_id = :a ORDER BY b.created_at DESC""", new MapSqlParameterSource("a", blockerId),
                (rs, i) -> new Blocked(rs.getString("username"), rs.getString("display_name"),
                        Avatars.url(rs.getString("username"), (Integer) rs.getObject("avatar_version"))));
    }

    /** True when the viewer blocked this person. (If they blocked the viewer, the profile simply isn't found.) */
    @Transactional(readOnly = true)
    public boolean blockedByMe(Long viewerId, long userId) {
        return viewerId != null && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = :a AND blocked_id = :b)",
                new MapSqlParameterSource().addValue("a", viewerId).addValue("b", userId), Boolean.class));
    }

    /** True when either person has blocked the other. */
    @Transactional(readOnly = true)
    public boolean between(Long viewerId, long userId) {
        if (viewerId == null || viewerId == userId) return false;
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM user_blocks
                               WHERE (blocker_id = :a AND blocked_id = :b) OR (blocker_id = :b AND blocked_id = :a))""",
                new MapSqlParameterSource().addValue("a", viewerId).addValue("b", userId), Boolean.class));
    }

    /** Everyone the viewer blocked or was blocked by, for filtering lists. */
    @Transactional(readOnly = true)
    public Set<Long> hiddenFor(Long viewerId) {
        if (viewerId == null) return Set.of();
        return new HashSet<>(jdbc.queryForList("""
                SELECT blocked_id FROM user_blocks WHERE blocker_id = :v
                UNION SELECT blocker_id FROM user_blocks WHERE blocked_id = :v""",
                new MapSqlParameterSource("v", viewerId), Long.class));
    }
}
