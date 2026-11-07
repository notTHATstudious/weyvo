package com.weyvo.api.points;

import java.time.Instant;
import java.time.OffsetDateTime;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Wey points: 5 for each day you open Weyvo, 20 per short story, 50 per full issue, and 50 extra in a week with
 * 4 or more stories. At most 50 a day and 250 a week. Points can be spent after 3 months on Weyvo, 500 at a time
 * for ₹25 off Premium, never more than half the price.
 */
@Service
public class PointsService {

    public static final int BLOCK_POINTS = 500;
    public static final int BLOCK_PAISE = 2500;
    public static final int DAY_CAP = 50;
    public static final int WEEK_CAP = 250;

    public record Balance(int balance, int earned, int spent, int thisWeek, int weekCap, Instant unlocksAt, boolean unlocked,
                          int blockPoints, int blockRupees, int redeemableRupees) {}

    /** Days and weeks are counted in India time. */
    private static final String EARNED = """
            WITH days AS (
                SELECT day, 5 AS pts, 0 AS stories FROM user_activity_days WHERE user_id = :u
                UNION ALL
                SELECT (published_at AT TIME ZONE 'Asia/Kolkata')::date, CASE WHEN kind = 'FULL' THEN 50 ELSE 20 END, 1
                FROM trips WHERE owner_id = :u AND status = 'PUBLISHED' AND removed_at IS NULL AND published_at IS NOT NULL
                UNION ALL
                SELECT (published_at AT TIME ZONE 'Asia/Kolkata')::date, 20, 1 FROM expired_short_stories WHERE user_id = :u
            ), per_day AS (
                SELECT day, LEAST(:dayCap, sum(pts)) AS pts, sum(stories) AS stories FROM days GROUP BY day
            ), per_week AS (
                SELECT date_trunc('week', day) AS week,
                       LEAST(:weekCap, sum(pts) + CASE WHEN sum(stories) >= 4 THEN 50 ELSE 0 END) AS pts
                FROM per_day GROUP BY 1
            )
            SELECT COALESCE(sum(pts), 0) AS total,
                   COALESCE(sum(pts) FILTER (WHERE week = date_trunc('week', (now() AT TIME ZONE 'Asia/Kolkata')::date)), 0) AS this_week
            FROM per_week""";

    private final NamedParameterJdbcTemplate jdbc;

    public PointsService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Balance balance(long userId) {
        var p = new MapSqlParameterSource().addValue("u", userId).addValue("dayCap", DAY_CAP).addValue("weekCap", WEEK_CAP);
        int[] earned = jdbc.queryForObject(EARNED, p, (rs, i) -> new int[] {rs.getInt("total"), rs.getInt("this_week")});
        // Points on an order count as spent once it's paid, and are held for 30 minutes while checkout is open.
        int spent = jdbc.queryForObject("""
                SELECT COALESCE(sum(points_used), 0) FROM payments
                WHERE user_id = :u AND (status = 'PAID' OR created_at > now() - interval '30 minutes')""", p, Integer.class);
        OffsetDateTime unlocks = jdbc.queryForObject("SELECT created_at + interval '3 months' FROM users WHERE id = :u", p, OffsetDateTime.class);
        boolean unlocked = !unlocks.toInstant().isAfter(Instant.now());
        int balance = Math.max(0, earned[0] - spent);
        int redeemable = unlocked ? balance / BLOCK_POINTS * BLOCK_PAISE / 100 : 0;
        return new Balance(balance, earned[0], spent, earned[1], WEEK_CAP, unlocks.toInstant(), unlocked,
                BLOCK_POINTS, BLOCK_PAISE / 100, redeemable);
    }

    /** How many points to spend on a price: whole 500-point blocks, up to half the price. Zero while locked. */
    public int pointsFor(long userId, int pricePaise) {
        Balance b = balance(userId);
        if (!b.unlocked()) return 0;
        int blocks = Math.min(b.balance() / BLOCK_POINTS, (pricePaise / 2) / BLOCK_PAISE);
        return blocks * BLOCK_POINTS;
    }

    public static int discountPaise(int points) {
        return points / BLOCK_POINTS * BLOCK_PAISE;
    }
}
