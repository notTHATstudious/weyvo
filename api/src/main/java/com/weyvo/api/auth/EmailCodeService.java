package com.weyvo.api.auth;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.jsonwebtoken.io.Decoders;

/** One-time 6-digit codes for email verification and password reset. Only keyed hashes are stored. */
@Service
public class EmailCodeService {

    public enum Purpose { VERIFY, RESET }

    private static final SecureRandom RANDOM = new SecureRandom();

    private final NamedParameterJdbcTemplate jdbc;
    private final AppProperties.Auth rules;
    private final byte[] key;

    public EmailCodeService(NamedParameterJdbcTemplate jdbc, AppProperties props) {
        this.jdbc = jdbc;
        this.rules = props.auth();
        this.key = Decoders.BASE64.decode(props.jwt().secret());
    }

    /** Creates a fresh code (older unused ones stop working) and returns it for sending. */
    @Transactional
    public String issue(long userId, Purpose purpose) {
        var params = new MapSqlParameterSource().addValue("u", userId).addValue("p", purpose.name())
                .addValue("cool", rules.codeResendCooldown().toSeconds());
        Boolean tooSoon = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM email_codes WHERE user_id = :u AND purpose = :p
                               AND created_at > now() - make_interval(secs => :cool))""", params, Boolean.class);
        if (Boolean.TRUE.equals(tooSoon)) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Wait a minute before asking for another code");
        Integer lastHour = jdbc.queryForObject("""
                SELECT count(*) FROM email_codes WHERE user_id = :u AND purpose = :p AND created_at > now() - interval '1 hour'""",
                params, Integer.class);
        if (lastHour != null && lastHour >= rules.codesPerHour()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many codes requested. Try again in an hour");
        }

        jdbc.update("UPDATE email_codes SET consumed_at = now() WHERE user_id = :u AND purpose = :p AND consumed_at IS NULL", params);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        jdbc.update("""
                INSERT INTO email_codes (user_id, purpose, code_hash, expires_at)
                VALUES (:u, :p, :h, now() + make_interval(secs => :ttl))""",
                params.addValue("h", hash(userId, purpose, code)).addValue("ttl", rules.codeTtl().toSeconds()));
        return code;
    }

    /**
     * Consumes the code if it matches. Wrong guesses count against the code, and after the maximum it can
     * no longer be used even with the right digits.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public void consume(long userId, Purpose purpose, String code) {
        String digits = code == null ? "" : code.replaceAll("\\s", "");
        var params = new MapSqlParameterSource().addValue("u", userId).addValue("p", purpose.name());
        var row = jdbc.query("""
                SELECT id, code_hash, attempts FROM email_codes
                WHERE user_id = :u AND purpose = :p AND consumed_at IS NULL AND expires_at > now()
                ORDER BY created_at DESC LIMIT 1 FOR UPDATE""", params,
                (rs, i) -> new Object[] {rs.getLong("id"), rs.getString("code_hash"), rs.getInt("attempts")});
        if (row.isEmpty() || (int) row.get(0)[2] >= rules.codeMaxAttempts()) {
            throw ApiException.badRequest("That code has expired. Ask for a new one");
        }
        long id = (long) row.get(0)[0];
        boolean match = digits.matches("\\d{6}") && MessageDigest.isEqual(
                ((String) row.get(0)[1]).getBytes(StandardCharsets.US_ASCII),
                hash(userId, purpose, digits).getBytes(StandardCharsets.US_ASCII));
        if (!match) {
            jdbc.update("UPDATE email_codes SET attempts = attempts + 1 WHERE id = :id", new MapSqlParameterSource("id", id));
            throw ApiException.badRequest("That code isn't right. Check the email and try again");
        }
        jdbc.update("UPDATE email_codes SET consumed_at = now() WHERE id = :id", new MapSqlParameterSource("id", id));
    }

    /** Keyed with the server secret, so a leaked database alone can't be used to brute-force codes. */
    private String hash(long userId, Purpose purpose, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((userId + ":" + purpose + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
