package com.weyvo.api.mail;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ResendMailerTest {

    @Test
    void logLinesNeverCarryCodes() {
        assertThat(ResendMailer.redact("Your Weyvo code: 482913")).isEqualTo("Your Weyvo code: ######");
        assertThat(ResendMailer.redact("Reset your Weyvo password: 006411")).doesNotContain("006411");
    }
}
