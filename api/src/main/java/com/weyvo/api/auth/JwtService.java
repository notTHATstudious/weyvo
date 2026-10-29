package com.weyvo.api.auth;

import com.weyvo.api.config.AppProperties;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    /** What a valid token says; the filter still checks the version against the database. */
    public record Claims(long userId, int sessionVersion) {}

    private final SecretKey key;
    private final AppProperties.Jwt config;

    public JwtService(AppProperties props) {
        this.config = props.jwt();
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(config.secret()));
    }

    public String issue(long userId, int sessionVersion) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .claim("sv", sessionVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(config.ttl())))
                .signWith(key)
                .compact();
    }

    /** Claims for a valid, unexpired token; empty for anything else. */
    public Optional<Claims> verify(String token) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            Integer sv = claims.get("sv", Integer.class);
            return Optional.of(new Claims(Long.parseLong(claims.getSubject()), sv == null ? -1 : sv));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public long ttlSeconds() {
        return config.ttl().toSeconds();
    }
}
