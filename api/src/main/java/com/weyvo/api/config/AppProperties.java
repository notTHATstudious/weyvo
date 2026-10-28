package com.weyvo.api.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cookie cookie, Cors cors, Story story, Signup signup, Storage storage) {

    public record Jwt(String secret, Duration ttl) {}

    public record Cookie(String name, boolean secure) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Story(double freeShare) {}

    public record Signup(boolean checkMailDomain) {}

    public record Storage(String provider, String localDir, String supabaseUrl, String supabaseServiceKey, String supabaseBucket) {}
}
