package com.weyvo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.weyvo.api.mail.Mailer;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** The real verification and limit rules, with email captured instead of sent. */
@SpringBootTest(properties = {
        "app.signup.check-mail-domain=false",
        "app.auth.signups-per-ip-per-hour=1000",
        "app.auth.login-per-ip-per-15-min=1000",
        "app.auth.login-per-email-per-15-min=3"})
@AutoConfigureMockMvc
@Testcontainers
class AuthFlowIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    record Sent(String to, String subject, String text) {}

    static final List<Sent> OUTBOX = new CopyOnWriteArrayList<>();

    @TestConfiguration
    static class CaptureMail {
        @Bean
        @Primary
        Mailer capturingMailer() {
            return (to, subject, text, html) -> OUTBOX.add(new Sent(to, subject, text));
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;

    private record Account(Cookie cookie, String email) {}

    @BeforeEach
    void clearOutbox() {
        OUTBOX.clear();
    }

    @Test
    void unverifiedAccountsCanReadButNotPostUntilTheCodeIsEntered() throws Exception {
        Account a = signup("newbie");
        String code = lastCodeFor(a.email());
        assertThat(code).matches("\\d{6}");

        mvc.perform(get("/api/auth/me").cookie(a.cookie())).andExpect(jsonPath("$.emailVerified").value(false));
        mvc.perform(get("/api/trips").cookie(a.cookie())).andExpect(status().isOk());
        createTrip(a).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("Verify your email to do that"));

        verify(a, wrong(code)).andExpect(status().isBadRequest());
        verify(a, code).andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(true));
        createTrip(a).andExpect(status().isCreated());

        // Only a keyed hash of the code is stored.
        String stored = db.queryForObject("SELECT code_hash FROM email_codes ORDER BY id DESC LIMIT 1", String.class);
        assertThat(stored).isNotEqualTo(code).hasSize(64);
    }

    @Test
    void aCodeStopsWorkingAfterFiveWrongTries() throws Exception {
        Account a = signup("guesser");
        String code = lastCodeFor(a.email());
        for (int i = 0; i < 5; i++) verify(a, wrong(code)).andExpect(status().isBadRequest());
        verify(a, code).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("That code has expired. Ask for a new one"));
    }

    @Test
    void resendingHasACooldown() throws Exception {
        Account a = signup("impatient");
        mvc.perform(post("/api/auth/verify-email/resend").cookie(a.cookie())).andExpect(status().isTooManyRequests());
    }

    @Test
    void passwordResetDoesNotRevealAccountsAndSignsOutOtherSessions() throws Exception {
        Account a = signup("forgetful");
        OUTBOX.clear();

        forgot("nobody-" + UUID.randomUUID() + "@example.com").andExpect(status().isNoContent());
        assertThat(OUTBOX).isEmpty();
        forgot(a.email()).andExpect(status().isNoContent());
        String code = lastCodeFor(a.email());

        reset(a.email(), wrong(code), "a-brand-new-password").andExpect(status().isBadRequest());
        Cookie fresh = reset(a.email(), code, "a-brand-new-password").andExpect(status().isOk())
                .andReturn().getResponse().getCookie("weyvo_session");

        mvc.perform(get("/api/auth/me").cookie(a.cookie())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(fresh)).andExpect(status().isOk());
        login(a.email(), "correct-horse-battery").andExpect(status().isUnauthorized());
        login(a.email(), "a-brand-new-password").andExpect(status().isOk());
    }

    @Test
    void repeatedFailedLoginsAreSlowedDown() throws Exception {
        Account a = signup("target");
        for (int i = 0; i < 3; i++) login(a.email(), "wrong-password-" + i).andExpect(status().isUnauthorized());
        login(a.email(), "correct-horse-battery").andExpect(status().isTooManyRequests());
    }

    // ---- helpers ----

    private Account signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        String email = username + "@example.com";
        Cookie cookie = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getCookie("weyvo_session");
        return new Account(cookie, email);
    }

    private ResultActions verify(Account a, String code) throws Exception {
        return mvc.perform(post("/api/auth/verify-email").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + code + "\"}"));
    }

    private ResultActions createTrip(Account a) throws Exception {
        return mvc.perform(post("/api/trips").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"FULL\",\"title\":\"First\",\"place\":\"Goa\",\"visibility\":\"PUBLIC\",\"sections\":[{\"body\":\"One\"}]}"));
    }

    private ResultActions forgot(String email) throws Exception {
        return mvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"));
    }

    private ResultActions reset(String email, String code, String password) throws Exception {
        return mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\",\"password\":\"" + password + "\"}"));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private static String lastCodeFor(String email) {
        Pattern sixDigits = Pattern.compile("\\b(\\d{6})\\b");
        for (int i = OUTBOX.size() - 1; i >= 0; i--) {
            Sent s = OUTBOX.get(i);
            Matcher m = sixDigits.matcher(s.text());
            if (s.to().equals(email) && m.find()) return m.group(1);
        }
        throw new AssertionError("no code emailed to " + email);
    }

    private static String wrong(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }
}
