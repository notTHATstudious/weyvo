package com.weyvo.api.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cookie cookie, Cors cors, Story story, Signup signup, Storage storage, Plans plans,
                            Community community) {

    public record Community(int questionsPerHour, int reportsToHide) {}

    public record Jwt(String secret, Duration ttl) {}

    public record Cookie(String name, boolean secure) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Story(double freeShare) {}

    public record Signup(boolean checkMailDomain) {}

    public record Plans(PlanLimits free, PlanLimits premium) {}

    /** Per-plan limits. For totalPhotos and uploadsPerHour, 0 means unlimited. */
    public record PlanLimits(int fullTripSections, int shortStoryPhotos, int totalPhotos, int uploadsPerHour) {}

    public record Storage(String provider, String localDir, String supabaseUrl, String supabaseServiceKey, String supabaseBucket) {}
}
