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

    private final SecretKey key;
    private final AppProperties.Jwt config;

    public JwtService(AppProperties props) {
        this.config = props.jwt();
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(config.secret()));
    }

    public String issue(CurrentUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(user.id()))
                .claim("u", user.username())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(config.ttl())))
                .signWith(key)
                .compact();
    }

    /** Returns the user for a valid, unexpired token; empty for anything else. */
    public Optional<CurrentUser> verify(String token) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(new CurrentUser(Long.parseLong(claims.getSubject()), claims.get("u", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public long ttlSeconds() {
        return config.ttl().toSeconds();
    }
}
