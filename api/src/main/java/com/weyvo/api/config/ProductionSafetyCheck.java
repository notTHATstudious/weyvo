package com.weyvo.api.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Refuses to start in production with development defaults. The dev session key is public (it's in Git),
 * so running on it would let anyone forge a login.
 */
@Component
public class ProductionSafetyCheck implements InitializingBean {

    static final String DEV_JWT_SECRET = "ZGV2LW9ubHktc2VjcmV0LWNoYW5nZS1tZS1iZWZvcmUtZGVwbG95aW5nLTEyMzQ1Ng==";

    private final AppProperties props;
    private final String env;

    public ProductionSafetyCheck(AppProperties props, @Value("${app.env:development}") String env) {
        this.props = props;
        this.env = env;
    }

    @Override
    public void afterPropertiesSet() {
        if (!"production".equalsIgnoreCase(env)) return;
        List<String> problems = problems(props);
        if (!problems.isEmpty()) {
            throw new IllegalStateException("Unsafe production configuration: " + String.join("; ", problems));
        }
    }

    static List<String> problems(AppProperties p) {
        List<String> out = new ArrayList<>();
        if (DEV_JWT_SECRET.equals(p.jwt().secret())) out.add("APP_JWT_SECRET is the public development key");
        if (!p.cookie().secure()) out.add("APP_COOKIE_SECURE must be true (HTTPS)");
        if (p.cors().allowedOrigins().stream().anyMatch(o -> o.contains("localhost") || o.startsWith("http://"))) {
            out.add("APP_CORS_ORIGINS must be your https web address, not localhost");
        }
        if (!p.auth().requireVerifiedEmail()) out.add("AUTH_REQUIRE_VERIFIED_EMAIL must stay true");
        return out;
    }
}
