package com.weyvo.api.plan;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import com.weyvo.api.config.AppProperties.PlanLimits;
import com.weyvo.api.user.User;
import com.weyvo.api.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Plan limits from configuration, plus the usage they're checked against. */
@Service
public class PlanService {

    public record Usage(User.Plan plan, PlanLimits limits, int photosUsed, int uploadsLastHour) {}

    private final AppProperties.Plans plans;
    private final UserRepository users;
    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;

    public PlanService(AppProperties props, UserRepository users, NamedParameterJdbcTemplate jdbc) {
        this.plans = props.plans();
        this.users = users;
        this.jdbc = jdbc;
        this.clock = Clock.systemUTC();
    }

    public PlanLimits limitsFor(User user) {
        return user.effectivePlan(Instant.now(clock)) == User.Plan.PREMIUM ? plans.premium() : plans.free();
    }

    @Transactional(readOnly = true)
    public PlanLimits limitsFor(long userId) {
        return limitsFor(user(userId));
    }

    @Transactional(readOnly = true)
    public Usage usage(long userId) {
        User u = user(userId);
        return new Usage(u.effectivePlan(Instant.now(clock)), limitsFor(u), photosUsed(userId), uploadsLastHour(userId));
    }

    /**
     * Throws 429/403 when another upload would exceed the plan; otherwise records it. A replacement
     * doesn't add to the stored total, but still counts towards the hourly limit.
     */
    @Transactional
    public void recordUpload(long userId, boolean replacesExisting) {
        PlanLimits limits = limitsFor(userId);
        if (limits.uploadsPerHour() > 0 && uploadsLastHour(userId) >= limits.uploadsPerHour()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "You've uploaded a lot in the last hour. Try again a little later");
        }
        if (!replacesExisting && limits.totalPhotos() > 0 && photosUsed(userId) >= limits.totalPhotos()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You've reached your plan's limit of " + limits.totalPhotos() + " photos");
        }
        jdbc.update("INSERT INTO photo_uploads (user_id) VALUES (:u)", new MapSqlParameterSource("u", userId));
    }

    private int photosUsed(long userId) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM trip_photos p JOIN trips t ON t.id = p.trip_id WHERE t.owner_id = :u""",
                new MapSqlParameterSource("u", userId), Integer.class);
        return n == null ? 0 : n;
    }

    private int uploadsLastHour(long userId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM photo_uploads WHERE user_id = :u AND created_at > now() - interval '1 hour'",
                new MapSqlParameterSource("u", userId), Integer.class);
        return n == null ? 0 : n;
    }

    private User user(long userId) {
        return users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Sign in again"));
    }
}
