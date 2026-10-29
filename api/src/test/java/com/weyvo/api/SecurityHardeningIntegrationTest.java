package com.weyvo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.auth.require-verified-email=false", "app.auth.signups-per-ip-per-hour=1000"})
@AutoConfigureMockMvc
@Testcontainers
class SecurityHardeningIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Test
    void storyLinksEndInEightRandomCharacters() throws Exception {
        Cookie c = signup();
        String res = mvc.perform(post("/api/trips").cookie(c).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FULL\",\"title\":\"Hidden gem\",\"place\":\"Goa\",\"visibility\":\"UNLISTED\",\"sections\":[{\"body\":\"One\"}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(res).get("slug").asText()).matches("hidden-gem-[a-z0-9]{8}");
    }

    @Test
    void apiResponsesCarrySecurityHeaders() throws Exception {
        mvc.perform(get("/api/trips"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));
    }

    @Test
    void signingOutEverywhereEndsEverySession() throws Exception {
        Cookie c = signup();
        mvc.perform(post("/api/auth/logout-everywhere").cookie(c)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").cookie(c)).andExpect(status().isUnauthorized());
    }

    private Cookie signup() throws Exception {
        String u = "sec_" + UUID.randomUUID().toString().substring(0, 8);
        return mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + u + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + u + "\",\"displayName\":\"Sec\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getCookie("weyvo_session");
    }
}
