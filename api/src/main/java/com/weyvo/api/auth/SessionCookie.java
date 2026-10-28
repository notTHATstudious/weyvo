package com.weyvo.api.auth;

import com.weyvo.api.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** The httpOnly cookie that carries the session token. */
@Component
public class SessionCookie {

    private final AppProperties.Cookie config;
    private final JwtService jwt;

    public SessionCookie(AppProperties props, JwtService jwt) {
        this.config = props.cookie();
        this.jwt = jwt;
    }

    public ResponseCookie create(String token) {
        return base(token).maxAge(jwt.ttlSeconds()).build();
    }

    public ResponseCookie clear() {
        return base("").maxAge(0).build();
    }

    public Optional<String> read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        return Arrays.stream(cookies)
                .filter(c -> config.name().equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> !v.isBlank())
                .findFirst();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(config.name(), value)
                .httpOnly(true)
                .secure(config.secure())
                .sameSite("Lax")
                .path("/");
    }
}
