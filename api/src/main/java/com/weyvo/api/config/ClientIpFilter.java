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
 * Behind a host's proxies every request seems to come from the last proxy, which would put all visitors in
 * one rate-limit bucket. With APP_CLIENT_IP_HEADER set (normally X-Forwarded-For), the visitor's address is
 * read from that header, counting from the right past APP_CLIENT_IP_TRUSTED_HOPS addresses our own proxies
 * appended. Counting from the right matters: anything a visitor writes into the header themselves ends up
 * further left and is ignored. Unset locally, where the connection's address is already the visitor's.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ClientIpFilter extends OncePerRequestFilter {

    private final String header;
    private final int trustedHops;

    public ClientIpFilter(@Value("${app.client-ip-header:}") String header, @Value("${app.client-ip-trusted-hops:0}") int trustedHops) {
        this.header = header == null ? "" : header.strip();
        this.trustedHops = Math.max(0, trustedHops);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String ip = clientIp(request.getHeader(header.isEmpty() ? "-" : header));
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

    /** The address trustedHops places from the right, or null to keep the connection's own address. */
    String clientIp(String value) {
        if (header.isEmpty() || value == null || value.isBlank()) return null;
        String[] parts = value.split(",");
        int index = parts.length - 1 - trustedHops;
        if (index < 0) return null;
        String ip = parts[index].strip();
        return ip.isEmpty() || ip.length() > 64 ? null : ip;
    }
}
