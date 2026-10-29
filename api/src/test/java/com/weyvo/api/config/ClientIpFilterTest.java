package com.weyvo.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ClientIpFilterTest {

    // The chain Render produced for a real visit: visitor, then three addresses its proxies appended.
    private static final String RENDER = "103.167.123.115,162.158.41.96,162.158.41.96,74.220.48.243";

    @Test
    void readsTheVisitorPastTheTrustedHops() {
        assertThat(new ClientIpFilter("X-Forwarded-For", 3).clientIp(RENDER)).isEqualTo("103.167.123.115");
    }

    @Test
    void addressesAVisitorAddsThemselvesAreIgnored() {
        assertThat(new ClientIpFilter("X-Forwarded-For", 3).clientIp("6.6.6.6, 1.2.3.4," + RENDER)).isEqualTo("103.167.123.115");
    }

    @Test
    void fallsBackWhenTheChainIsShortOrUnset() {
        assertThat(new ClientIpFilter("X-Forwarded-For", 3).clientIp("74.220.48.243")).isNull();
        assertThat(new ClientIpFilter("", 0).clientIp(RENDER)).isNull();
        assertThat(new ClientIpFilter("True-Client-IP", 0).clientIp("74.220.48.243")).isEqualTo("74.220.48.243");
    }
}
