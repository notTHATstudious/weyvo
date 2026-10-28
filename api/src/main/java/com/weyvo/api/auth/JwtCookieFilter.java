package com.weyvo.api.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Turns a valid session cookie into an authenticated principal. Invalid or missing cookies stay anonymous. */
@Component
public class JwtCookieFilter extends OncePerRequestFilter {

    private final SessionCookie cookie;
    private final JwtService jwt;

    public JwtCookieFilter(SessionCookie cookie, JwtService jwt) {
        this.cookie = cookie;
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        cookie.read(request).flatMap(jwt::verify).ifPresent(user -> {
            var auth = new UsernamePasswordAuthenticationToken(user, null, List.of());
            SecurityContextHolder.getContext().setAuthentication(auth);
        });
        chain.doFilter(request, response);
    }
}
