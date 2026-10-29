package com.weyvo.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Behind a host's proxy every request seems to come from the proxy, which would put all visitors in one
 * rate-limit bucket. When APP_CLIENT_IP_HEADER names a header the host itself sets (and overwrites), the
 * visitor's address is taken from it. Unset locally, where the address is already the visitor's.
 * Only name a header the host controls: one a visitor can set themselves would let them dodge rate limits.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ClientIpFilter extends OncePerRequestFilter {

    private final String header;

    public ClientIpFilter(@Value("${app.client-ip-header:}") String header) {
        this.header = header == null ? "" : header.strip();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String ip = clientIp(request);
        if (ip == null) {
            chain.doFilter(request, response);
            return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override
            public String getRemoteAddr() {
                return ip;
            }
        }, response);
    }

    /** The first address in the configured header, or null to keep the connection's own address. */
    String clientIp(HttpServletRequest request) {
        if (header.isEmpty()) return null;
        String value = request.getHeader(header);
        if (value == null || value.isBlank()) return null;
        String first = value.split(",")[0].strip();
        return first.isEmpty() || first.length() > 64 ? null : first;
    }
}
