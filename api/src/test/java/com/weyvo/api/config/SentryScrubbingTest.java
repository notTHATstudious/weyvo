package com.weyvo.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SentryScrubbingTest {

    @Test
    void storySlugsAndQueriesLeaveReports() {
        assertThat(SentryScrubbing.scrub("https://weyvo-api.onrender.com/api/trips/goa-ab12cd34?x=1")).isEqualTo("https://weyvo-api.onrender.com/api/trips/:slug");
        assertThat(SentryScrubbing.scrub("/api/share/goa-ab12cd34")).isEqualTo("/api/share/:slug");
        assertThat(SentryScrubbing.scrub("GET /api/trips/{slug}")).isEqualTo("GET /api/trips/:slug");
    }

    @Test
    void numericIdsAndOtherPathsStay() {
        assertThat(SentryScrubbing.scrub("/api/trips/42/comments")).isEqualTo("/api/trips/42/comments");
        assertThat(SentryScrubbing.scrub("/api/places/hampi")).isEqualTo("/api/places/hampi");
        assertThat(SentryScrubbing.scrub(null)).isNull();
    }
}
