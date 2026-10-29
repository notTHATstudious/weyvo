package com.weyvo.api.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Turns a valid session cookie into an authenticated principal. The token's session version must match the
 * account's, and the account must be active; anything else stays anonymous.
 */
@Component
public class JwtCookieFilter extends OncePerRequestFilter {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(JwtCookieFilter.class);

    private final SessionCookie cookie;
    private final JwtService jwt;
    private final NamedParameterJdbcTemplate jdbc;

    public JwtCookieFilter(SessionCookie cookie, JwtService jwt, NamedParameterJdbcTemplate jdbc) {
        this.cookie = cookie;
        this.jwt = jwt;
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        cookie.read(request).flatMap(jwt::verify).flatMap(this::load).ifPresent(user -> {
            var authorities = user.admin() ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN")) : List.<SimpleGrantedAuthority>of();
            var auth = new UsernamePasswordAuthenticationToken(user, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
            seen(user.id());
        });
        chain.doFilter(request, response);
    }

    /**
     * Records that this account is active: last seen at most once a minute, plus the day (India time) for
     * daily/weekly/monthly counts. Failing to record never fails the request.
     */
    private void seen(long userId) {
        try {
            var p = new MapSqlParameterSource("id", userId);
            int updated = jdbc.update("UPDATE users SET last_seen_at = now() WHERE id = :id"
                    + " AND (last_seen_at IS NULL OR last_seen_at < now() - interval '1 minute')", p);
            if (updated > 0) {
                jdbc.update("INSERT INTO user_activity_days (user_id, day) VALUES (:id, (now() AT TIME ZONE 'Asia/Kolkata')::date)"
                        + " ON CONFLICT DO NOTHING", p);
            }
        } catch (RuntimeException e) {
            log.warn("Could not record activity: {}", e.getClass().getSimpleName());
        }
    }

    private Optional<CurrentUser> load(JwtService.Claims claims) {
        return jdbc.query("""
                SELECT id, username, email_verified_at IS NOT NULL AS verified, is_admin FROM users
                WHERE id = :id AND status = 'ACTIVE' AND session_version = :sv""",
                new MapSqlParameterSource().addValue("id", claims.userId()).addValue("sv", claims.sessionVersion()),
                (rs, i) -> new CurrentUser(rs.getLong("id"), rs.getString("username"), rs.getBoolean("verified"), rs.getBoolean("is_admin")))
                .stream().findFirst();
    }
}
