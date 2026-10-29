package com.weyvo.api.auth;

import com.weyvo.api.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Database-backed sliding-window limits, shared by every API instance. Buckets hold hashes, so the table
 * never contains raw emails or IP addresses.
 */
@Component
public class RateLimiter {

    private final NamedParameterJdbcTemplate jdbc;

    public RateLimiter(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Records an attempt, or throws 429 when {@code max} attempts already happened within {@code window}.
     * Runs in its own transaction so a later failure (wrong password) still counts.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void attempt(String kind, String value, int max, Duration window, String message) {
        String bucket = kind + ":" + hash(value);
        var params = new MapSqlParameterSource().addValue("b", bucket).addValue("s", window.toSeconds());
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM rate_events WHERE bucket = :b AND created_at > now() - make_interval(secs => :s)", params, Integer.class);
        if (n != null && n >= max) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, message);
        jdbc.update("INSERT INTO rate_events (bucket) VALUES (:b)", params);
    }

    /** Old events are useless once outside every window; keep the table small. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 600_000)
    @Transactional
    public void purge() {
        jdbc.update("DELETE FROM rate_events WHERE created_at < now() - interval '1 day'", new MapSqlParameterSource());
    }

    static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
