package com.weyvo.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
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

/** Tiny limits set through configuration, the same way launch values will be set. */
@SpringBootTest(properties = {
        "app.signup.check-mail-domain=false", "app.auth.require-verified-email=false", "app.auth.signups-per-ip-per-hour=1000",
        "app.storage.local-dir=target/test-photos",
        "app.plans.free.full-trip-sections=2",
        "app.plans.free.short-story-photos=2",
        "app.plans.free.total-photos=2",
        "app.plans.free.uploads-per-hour=3",
        "app.plans.premium.full-trip-sections=5",
        "app.plans.premium.short-story-photos=5",
        "app.plans.premium.total-photos=0",
        "app.plans.premium.uploads-per-hour=0"})
@AutoConfigureMockMvc
@Testcontainers
class PlanLimitsIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;

    private record Account(Cookie cookie, String username) {}

    @Test
    void freeUsersAreHeldToTheConfiguredSectionLimit() throws Exception {
        Account free = signup("free");
        mvc.perform(post("/api/trips").cookie(free.cookie()).contentType(MediaType.APPLICATION_JSON).content(fullTrip(3)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Your plan allows up to 2 story sections"));
        mvc.perform(post("/api/trips").cookie(free.cookie()).contentType(MediaType.APPLICATION_JSON).content(fullTrip(2)))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/me/plan").cookie(free.cookie()))
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.limits.totalPhotos").value(2));
    }

    @Test
    void totalPhotosAndHourlyUploadsAreCappedButReplacingIsAllowed() throws Exception {
        Account free = signup("uploads");
        long trip = createTrip(free, 2);

        upload(free, trip, "COVER", 0).andExpect(status().isCreated());   // 1 stored, 1 upload this hour
        upload(free, trip, "SECTION", 0).andExpect(status().isCreated()); // 2 stored, 2 uploads
        upload(free, trip, "SECTION", 1)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("You've reached your plan's limit of 2 photos"));
        upload(free, trip, "COVER", 0).andExpect(status().isCreated());   // replacement: still 2 stored, 3 uploads
        upload(free, trip, "COVER", 0).andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/me/plan").cookie(free.cookie()))
                .andExpect(jsonPath("$.photosUsed").value(2))
                .andExpect(jsonPath("$.uploadsLastHour").value(3));
    }

    @Test
    void premiumGetsHigherLimitsUntilItExpires() throws Exception {
        Account premium = signup("premium");
        db.update("UPDATE users SET plan = 'PREMIUM' WHERE username = ?", premium.username());

        long trip = createTrip(premium, 4);
        upload(premium, trip, "COVER", 0).andExpect(status().isCreated());
        for (int i = 0; i < 4; i++) upload(premium, trip, "SECTION", i).andExpect(status().isCreated());
        mvc.perform(get("/api/me/plan").cookie(premium.cookie()))
                .andExpect(jsonPath("$.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.photosUsed").value(5));

        db.update("UPDATE users SET plan_expires_at = now() - interval '1 day' WHERE username = ?", premium.username());
        mvc.perform(get("/api/me/plan").cookie(premium.cookie())).andExpect(jsonPath("$.plan").value("FREE"));
        mvc.perform(post("/api/trips").cookie(premium.cookie()).contentType(MediaType.APPLICATION_JSON).content(fullTrip(4)))
                .andExpect(status().isBadRequest());
    }

    // ---- helpers ----

    private Account signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        Cookie cookie = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getCookie("weyvo_session");
        return new Account(cookie, username);
    }

    private long createTrip(Account owner, int sections) throws Exception {
        String res = mvc.perform(post("/api/trips").cookie(owner.cookie()).contentType(MediaType.APPLICATION_JSON).content(fullTrip(sections)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions upload(Account owner, long trip, String role, int position) throws Exception {
        return mvc.perform(multipart("/api/trips/" + trip + "/photos").file(new MockMultipartFile("file", "p.jpg", "image/jpeg", jpeg()))
                .param("role", role).param("position", String.valueOf(position)).cookie(owner.cookie()));
    }

    private static String fullTrip(int sections) {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < sections; i++) s.append(i > 0 ? "," : "").append("{\"body\":\"Section ").append(i + 1).append("\"}");
        return "{\"kind\":\"FULL\",\"title\":\"Plan test\",\"place\":\"Goa\",\"visibility\":\"PUBLIC\",\"sections\":[" + s + "]}";
    }

    private static byte[] jpeg() throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB), "jpeg", out);
        return out.toByteArray();
    }
}
