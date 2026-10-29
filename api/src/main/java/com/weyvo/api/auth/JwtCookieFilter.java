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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Turns a valid session cookie into an authenticated principal. The token's session version must match the
 * account's, and the account must be active; anything else stays anonymous.
 */
@Component
public class JwtCookieFilter extends OncePerRequestFilter {

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
            var auth = new UsernamePasswordAuthenticationToken(user, null, List.of());
            SecurityContextHolder.getContext().setAuthentication(auth);
        });
        chain.doFilter(request, response);
    }

    private Optional<CurrentUser> load(JwtService.Claims claims) {
        return jdbc.query("""
                SELECT id, username, email_verified_at IS NOT NULL AS verified FROM users
                WHERE id = :id AND status = 'ACTIVE' AND session_version = :sv""",
                new MapSqlParameterSource().addValue("id", claims.userId()).addValue("sv", claims.sessionVersion()),
                (rs, i) -> new CurrentUser(rs.getLong("id"), rs.getString("username"), rs.getBoolean("verified")))
                .stream().findFirst();
    }
}
