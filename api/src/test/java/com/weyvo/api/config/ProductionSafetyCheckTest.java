package com.weyvo.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductionSafetyCheckTest {

    private static AppProperties props(String secret, boolean secureCookie, String origin, boolean requireVerified) {
        return new AppProperties(new AppProperties.Jwt(secret, Duration.ofDays(7)), new AppProperties.Cookie("weyvo_session", secureCookie),
                new AppProperties.Cors(List.of(origin)), null, null, null, null, null, null,
                new AppProperties.Auth(requireVerified, Duration.ofMinutes(10), 5, Duration.ofSeconds(60), 5, 8, 20, 5), null);
    }

    @Test
    void developmentDefaultsAreRejected() {
        assertThat(ProductionSafetyCheck.problems(props(ProductionSafetyCheck.DEV_JWT_SECRET, false, "http://localhost:5173", false)))
                .hasSize(4);
    }

    @Test
    void aProperProductionSetupPasses() {
        assertThat(ProductionSafetyCheck.problems(props("cmVhbC1zZWNyZXQtZm9yLXByb2R1Y3Rpb24tdXNlLTEyMzQ1Njc4OTA=", true, "https://weyvo.in", true)))
                .isEmpty();
    }
}
