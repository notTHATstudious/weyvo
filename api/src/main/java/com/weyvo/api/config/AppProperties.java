package com.weyvo.api.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cookie cookie, Cors cors, Story story, Signup signup, Storage storage, Plans plans,
                            Community community, Mail mail, Auth auth, Payments payments) {

    public record Payments(String razorpayKeyId, String razorpayKeySecret, String razorpayWebhookSecret,
                           int monthPricePaise, int yearPricePaise) {
        public boolean configured() {
            return razorpayKeyId != null && !razorpayKeyId.isBlank() && razorpayKeySecret != null && !razorpayKeySecret.isBlank();
        }
    }

    public record Mail(String resendApiKey, String from, String appUrl) {}

    public record Auth(boolean requireVerifiedEmail, Duration codeTtl, int codeMaxAttempts, Duration codeResendCooldown,
                       int codesPerHour, int loginPerEmailPer15Min, int loginPerIpPer15Min, int signupsPerIpPerHour) {}

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
