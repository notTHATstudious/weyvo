package com.weyvo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Own-account actions, with the verified-email rule left on. */
@SpringBootTest(properties = {
        "app.signup.check-mail-domain=false",
        "app.auth.signups-per-ip-per-hour=1000",
        "app.storage.local-dir=target/test-photos-account"})
@AutoConfigureMockMvc
@Testcontainers
class AccountIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;

    private record Account(Cookie cookie, String username, String email) {}

    @Test
    void profileCanBeEditedWithinLimits() throws Exception {
        Account a = signup("profile", false);
        mvc.perform(put("/api/me/profile").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Asha Rao\",\"bio\":\"Hills and trains\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/users/" + a.username()))
                .andExpect(jsonPath("$.displayName").value("Asha Rao"))
                .andExpect(jsonPath("$.bio").value("Hills and trains"));
        mvc.perform(put("/api/me/profile").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Asha\",\"bio\":\"" + "x".repeat(161) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changingThePasswordSignsOutOtherSessions() throws Exception {
        Account a = signup("changer", true);
        change(a.cookie(), "wrong-password-123", "another-password-1").andExpect(status().isBadRequest());
        Cookie fresh = change(a.cookie(), "correct-horse-battery", "another-password-1").andExpect(status().isNoContent())
                .andReturn().getResponse().getCookie("weyvo_session");

        mvc.perform(get("/api/auth/me").cookie(a.cookie())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(fresh)).andExpect(status().isOk());
        login(a.email(), "another-password-1").andExpect(status().isOk());
    }

    @Test
    void exportContainsTheUsersDataButNeverThePasswordHash() throws Exception {
        Account a = signup("exporter", true);
        createTrip(a);
        String body = mvc.perform(get("/api/me/export").cookie(a.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.username").value(a.username()))
                .andExpect(jsonPath("$.trips[0].title").value("Account test"))
                .andExpect(jsonPath("$.trips[0].sections[0].body").value("One"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("password").doesNotContain("$2a$");
        mvc.perform(get("/api/me/export")).andExpect(status().isUnauthorized());
    }

    @Test
    void deletingTheAccountRemovesStoriesAndPhotoFiles() throws Exception {
        Account a = signup("leaver", true);
        long trip = createTrip(a);
        mvc.perform(multipart("/api/trips/" + trip + "/photos").file(new MockMultipartFile("file", "p.jpg", "image/jpeg", jpeg()))
                .param("role", "COVER").cookie(a.cookie())).andExpect(status().isCreated());
        Path dir = Path.of("target/test-photos-account/trips/" + trip);
        assertThat(Files.list(dir).count()).isEqualTo(2);

        deleteAccount(a, "not-my-password").andExpect(status().isBadRequest());
        deleteAccount(a, "correct-horse-battery").andExpect(status().isNoContent());

        mvc.perform(get("/api/auth/me").cookie(a.cookie())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/" + a.username())).andExpect(status().isNotFound());
        assertThat(db.queryForObject("SELECT count(*) FROM trips WHERE id = ?", Integer.class, trip)).isZero();
        assertThat(Files.list(dir).count()).isZero();
    }

    @Test
    void unverifiedPeopleCanStillDeleteTheirAccountButCannotPost() throws Exception {
        Account a = signup("unverified", false);
        mvc.perform(post("/api/trips").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON).content(tripBody()))
                .andExpect(status().isForbidden());
        deleteAccount(a, "correct-horse-battery").andExpect(status().isNoContent());
    }

    // ---- helpers ----

    private Account signup(String name, boolean verified) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        String email = username + "@example.com";
        Cookie cookie = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getCookie("weyvo_session");
        if (verified) db.update("UPDATE users SET email_verified_at = now() WHERE username = ?", username);
        return new Account(cookie, username, email);
    }

    private long createTrip(Account a) throws Exception {
        String res = mvc.perform(post("/api/trips").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON).content(tripBody()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions change(Cookie c, String current, String next) throws Exception {
        return mvc.perform(post("/api/auth/password/change").cookie(c).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions deleteAccount(Account a, String password) throws Exception {
        return mvc.perform(delete("/api/me").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"" + password + "\"}"));
    }

    private static String tripBody() {
        return "{\"kind\":\"FULL\",\"title\":\"Account test\",\"place\":\"Goa\",\"visibility\":\"PUBLIC\",\"sections\":[{\"body\":\"One\"}]}";
    }

    private static byte[] jpeg() throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB), "jpeg", out);
        return out.toByteArray();
    }
}
