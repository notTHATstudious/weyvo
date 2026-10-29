package com.weyvo.api.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Numbers for the admin dashboard, all from our own tables. Days are counted in India time.
 * "Active" means the account made a signed-in request; see JwtCookieFilter.
 */
@Service
public class AdminStatsService {

    /** Today's date in India, as SQL. */
    private static final String TODAY = "(now() AT TIME ZONE 'Asia/Kolkata')::date";
    /** A timestamp column's date in India, as SQL. */
    private static String day(String column) {
        return "(" + column + " AT TIME ZONE 'Asia/Kolkata')::date";
    }

    public record Users(int total, int verified, int premium, int suspended) {}
    public record Active(int now, int today, int week, int month) {}
    public record Signups(int today, int week, int month) {}
    public record Stories(int published, int full, int shorts, int drafts) {}
    /** Last 7 days. */
    public record Engagement(int storiesPublished, int comments, int questions, int reactions, int saves, int follows, int shares) {}
    /** Of people who joined in the cohort window, how many came back at least `days` days after joining. */
    public record Retention(int days, int cohort, int returned) {}
    public record Day(LocalDate day, int signups, int active, int stories) {}
    public record Stats(Users users, Active active, Signups signups, Stories stories, Engagement engagement,
                        List<Retention> retention, List<Day> daily, int openReports, Instant generatedAt) {}

    public record UserRow(String username, String displayName, String email, String status, boolean premium, boolean admin,
                          boolean verified, Instant joinedAt, Instant lastSeenAt, int stories) {}

    private final NamedParameterJdbcTemplate jdbc;

    public AdminStatsService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Stats stats() {
        var none = new MapSqlParameterSource();
        Map<String, Object> u = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE status <> 'DELETED') AS total,
                       count(*) FILTER (WHERE status = 'ACTIVE' AND email_verified_at IS NOT NULL) AS verified,
                       count(*) FILTER (WHERE status = 'ACTIVE' AND plan = 'PREMIUM' AND (plan_expires_at IS NULL OR plan_expires_at > now())) AS premium,
                       count(*) FILTER (WHERE status = 'SUSPENDED') AS suspended,
                       count(*) FILTER (WHERE last_seen_at > now() - interval '5 minutes') AS active_now,
                       count(*) FILTER (WHERE %s = %s) AS signups_today,
                       count(*) FILTER (WHERE %s > %s - 7) AS signups_week,
                       count(*) FILTER (WHERE %s > %s - 30) AS signups_month
                FROM users""".formatted(day("created_at"), TODAY, day("created_at"), TODAY, day("created_at"), TODAY), none);
        Map<String, Object> a = jdbc.queryForMap("""
                SELECT count(DISTINCT user_id) FILTER (WHERE day = %1$s) AS today,
                       count(DISTINCT user_id) FILTER (WHERE day > %1$s - 7) AS week,
                       count(DISTINCT user_id) FILTER (WHERE day > %1$s - 30) AS month
                FROM user_activity_days WHERE day > %1$s - 30""".formatted(TODAY), none);
        Map<String, Object> s = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE status = 'PUBLISHED') AS published,
                       count(*) FILTER (WHERE status = 'PUBLISHED' AND kind = 'FULL') AS full,
                       count(*) FILTER (WHERE status = 'PUBLISHED' AND kind = 'SHORT') AS shorts,
                       count(*) FILTER (WHERE status = 'DRAFT') AS drafts
                FROM trips""", none);
        String week = " > now() - interval '7 days'";
        Map<String, Object> e = jdbc.queryForMap("""
                SELECT (SELECT count(*) FROM trips WHERE published_at%1$s) AS stories,
                       (SELECT count(*) FROM trip_comments WHERE created_at%1$s) AS comments,
                       (SELECT count(*) FROM trip_questions WHERE created_at%1$s) AS questions,
                       (SELECT count(*) FROM trip_reactions WHERE type IN ('BEEN', 'WANT') AND created_at%1$s)
                         + (SELECT count(*) FROM place_reactions WHERE created_at%1$s) AS reactions,
                       (SELECT count(*) FROM trip_reactions WHERE type = 'SAVE' AND created_at%1$s) AS saves,
                       (SELECT count(*) FROM follows WHERE created_at%1$s) AS follows,
                       (SELECT count(*) FROM trip_shares WHERE created_at%1$s) AS shares""".formatted(week), none);
        Integer reports = jdbc.queryForObject("""
                SELECT (SELECT count(DISTINCT trip_id) FROM trip_reports WHERE reviewed_at IS NULL)
                     + (SELECT count(DISTINCT comment_id) FROM comment_reports WHERE reviewed_at IS NULL)
                     + (SELECT count(DISTINCT question_id) FROM question_reports WHERE reviewed_at IS NULL)""", none, Integer.class);

        List<Day> daily = jdbc.query("""
                SELECT d::date AS day,
                       (SELECT count(*) FROM users WHERE %s = d::date) AS signups,
                       (SELECT count(*) FROM user_activity_days WHERE day = d::date) AS active,
                       (SELECT count(*) FROM trips WHERE published_at IS NOT NULL AND %s = d::date) AS stories
                FROM generate_series(%s - 29, %s, interval '1 day') AS d ORDER BY d""".formatted(
                        day("created_at"), day("published_at"), TODAY, TODAY), none,
                (rs, i) -> new Day(rs.getDate("day").toLocalDate(), rs.getInt("signups"), rs.getInt("active"), rs.getInt("stories")));

        return new Stats(
                new Users(i(u, "total"), i(u, "verified"), i(u, "premium"), i(u, "suspended")),
                new Active(i(u, "active_now"), i(a, "today"), i(a, "week"), i(a, "month")),
                new Signups(i(u, "signups_today"), i(u, "signups_week"), i(u, "signups_month")),
                new Stories(i(s, "published"), i(s, "full"), i(s, "shorts"), i(s, "drafts")),
                new Engagement(i(e, "stories"), i(e, "comments"), i(e, "questions"), i(e, "reactions"), i(e, "saves"), i(e, "follows"), i(e, "shares")),
                List.of(retention(7), retention(30)), daily, reports == null ? 0 : reports, Instant.now());
    }

    /**
     * People who joined between `days` and `days + 30` days ago (so everyone had the full window),
     * and how many were active again on or after day `days`.
     */
    private Retention retention(int days) {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT count(*) AS cohort,
                       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_activity_days a WHERE a.user_id = u.id AND a.day >= %1$s + :d)) AS returned
                FROM users u
                WHERE %1$s <= %2$s - :d AND %1$s > %2$s - :d - 30 AND u.status <> 'DELETED'""".formatted(day("u.created_at"), TODAY),
                new MapSqlParameterSource("d", days));
        return new Retention(days, i(r, "cohort"), i(r, "returned"));
    }

    /** Search by username, name or email; newest first when there's no query. */
    @Transactional(readOnly = true)
    public List<UserRow> users(String query) {
        String q = query == null ? "" : query.strip().toLowerCase();
        if (q.length() > 100) q = q.substring(0, 100);
        String like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return jdbc.query("""
                SELECT u.username, u.display_name, u.email, u.status, u.is_admin, u.email_verified_at IS NOT NULL AS verified, u.created_at, u.last_seen_at,
                       u.plan = 'PREMIUM' AND (u.plan_expires_at IS NULL OR u.plan_expires_at > now()) AS premium,
                       (SELECT count(*) FROM trips t WHERE t.owner_id = u.id AND t.status = 'PUBLISHED') AS stories
                FROM users u
                WHERE u.status <> 'DELETED'
                  AND (:q = '' OR lower(u.username) LIKE :like OR lower(u.display_name) LIKE :like OR lower(u.email) LIKE :like)
                ORDER BY u.created_at DESC LIMIT 50""",
                new MapSqlParameterSource().addValue("q", q).addValue("like", like),
                (rs, i) -> new UserRow(rs.getString("username"), rs.getString("display_name"), rs.getString("email"), rs.getString("status"),
                        rs.getBoolean("premium"), rs.getBoolean("is_admin"), rs.getBoolean("verified"), rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("last_seen_at") == null ? null : rs.getTimestamp("last_seen_at").toInstant(), rs.getInt("stories")));
    }

    private static int i(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v == null ? 0 : ((Number) v).intValue();
    }
}
