package com.weyvo.api;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.auth.require-verified-email=false", "app.auth.signups-per-ip-per-hour=1000"})
@AutoConfigureMockMvc
@Testcontainers
class ModerationIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;

    private record Account(Cookie cookie, String username) {}
    private record Story(long id, String slug) {}

    @Test
    void blockingCutsContactBothWays() throws Exception {
        Account writer = signup("writer");
        Account troll = signup("troll");
        Story story = publish(writer);
        mvc.perform(put("/api/users/" + writer.username() + "/follow").cookie(troll.cookie())).andExpect(status().isOk());
        comment(troll, story.id(), "First!").andExpect(status().isCreated());

        mvc.perform(put("/api/users/" + troll.username() + "/block").cookie(writer.cookie())).andExpect(status().isNoContent());

        // The blocked person can't see or reach the blocker.
        mvc.perform(get("/api/trips/" + story.slug()).cookie(troll.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/users/" + writer.username()).cookie(troll.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/users/" + writer.username() + "/map").cookie(troll.cookie())).andExpect(status().isNotFound());
        mvc.perform(put("/api/users/" + writer.username() + "/follow").cookie(troll.cookie())).andExpect(status().isNotFound());
        mvc.perform(put("/api/trips/" + story.id() + "/reactions/been").cookie(troll.cookie())).andExpect(status().isNotFound());
        comment(troll, story.id(), "Still here").andExpect(status().isNotFound());
        mvc.perform(get("/api/trips").cookie(troll.cookie())).andExpect(jsonPath("$[*].slug", not(hasItem(story.slug()))));

        // The blocker no longer sees their comments, the follow is gone, and they can still find the profile to unblock.
        mvc.perform(get("/api/trips/" + story.id() + "/comments").cookie(writer.cookie())).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/api/users/" + writer.username()).cookie(writer.cookie())).andExpect(jsonPath("$.followers").value(0));
        mvc.perform(get("/api/users/" + troll.username()).cookie(writer.cookie())).andExpect(jsonPath("$.blockedByMe").value(true));
        mvc.perform(get("/api/me/blocked").cookie(writer.cookie())).andExpect(jsonPath("$[0].username").value(troll.username()));

        // Anyone else sees everything as before.
        mvc.perform(get("/api/trips/" + story.slug())).andExpect(status().isOk());

        mvc.perform(delete("/api/users/" + troll.username() + "/block").cookie(writer.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/" + story.slug()).cookie(troll.cookie())).andExpect(status().isOk());
    }

    @Test
    void adminsReviewReportsAndOthersCannot() throws Exception {
        Account writer = signup("author");
        Account reader = signup("reader");
        Account admin = signup("admin");
        db.update("UPDATE users SET is_admin = true WHERE username = ?", admin.username());
        Story story = publish(writer);

        mvc.perform(post("/api/trips/" + story.id() + "/reports").cookie(writer.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"SPAM\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/trips/" + story.id() + "/reports").cookie(reader.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"SPAM\"}")).andExpect(status().isNoContent());

        mvc.perform(get("/api/admin/reports").cookie(reader.cookie())).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/reports")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/reports/trip/" + story.id() + "/hide").cookie(reader.cookie())).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/me").cookie(admin.cookie())).andExpect(jsonPath("$.admin").value(true));
        mvc.perform(get("/api/admin/reports").cookie(admin.cookie()))
                .andExpect(jsonPath("$[?(@.kind == 'TRIP' && @.id == " + story.id() + ")].reasons[0]").value("SPAM"));

        // Hide: gone for readers, still there for its author; the report leaves the queue.
        mvc.perform(post("/api/admin/reports/trip/" + story.id() + "/hide").cookie(admin.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/" + story.slug()).cookie(reader.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/trips")).andExpect(jsonPath("$[*].slug", not(hasItem(story.slug()))));
        mvc.perform(get("/api/trips/" + story.slug()).cookie(writer.cookie())).andExpect(status().isOk());
        mvc.perform(get("/api/admin/reports").cookie(admin.cookie())).andExpect(jsonPath("$[?(@.kind == 'TRIP' && @.id == " + story.id() + ")]", hasSize(0)));

        // Keep restores it.
        mvc.perform(post("/api/admin/reports/trip/" + story.id() + "/keep").cookie(admin.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/" + story.slug()).cookie(reader.cookie())).andExpect(status().isOk());

        // Suspending ends the account's sessions at once; admins can't be suspended from the app.
        mvc.perform(post("/api/admin/users/" + reader.username() + "/suspend").cookie(admin.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/notifications").cookie(reader.cookie())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/users/" + admin.username() + "/suspend").cookie(admin.cookie())).andExpect(status().isNotFound());

        // A suspended author's stories disappear with them.
        mvc.perform(post("/api/admin/users/" + writer.username() + "/suspend").cookie(admin.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/" + story.slug())).andExpect(status().isNotFound());
        mvc.perform(get("/api/trips")).andExpect(jsonPath("$[*].slug", not(hasItem(story.slug()))));
    }

    @Test
    void dashboardCountsActivityAndFindsUsers() throws Exception {
        Account writer = signup("dash");
        Account admin = signup("boss");
        db.update("UPDATE users SET is_admin = true WHERE username = ?", admin.username());
        Story story = publish(writer);

        // Shares count from anyone who can see the story, signed in or not.
        mvc.perform(post("/api/trips/" + story.id() + "/shares").contentType(MediaType.APPLICATION_JSON).content("{\"kind\":\"IMAGE\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/trips/" + story.id() + "/shares").contentType(MediaType.APPLICATION_JSON).content("{\"kind\":\"FAX\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/admin/stats").cookie(writer.cookie())).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/users").cookie(writer.cookie())).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/stats").cookie(admin.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.active.now").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.active.today").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.signups.today").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.engagement.shares").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.daily", hasSize(30)))
                .andExpect(jsonPath("$.retention", hasSize(2)));

        mvc.perform(get("/api/admin/users").param("q", writer.username()).cookie(admin.cookie()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].email").value(writer.username() + "@example.com"))
                .andExpect(jsonPath("$[0].stories").value(1));
        // LIKE wildcards in the search are taken literally.
        mvc.perform(get("/api/admin/users").param("q", "%").cookie(admin.cookie())).andExpect(jsonPath("$", hasSize(0)));

        mvc.perform(post("/api/admin/users/" + writer.username() + "/suspend").cookie(admin.cookie())).andExpect(status().isNoContent());
        mvc.perform(post("/api/admin/users/" + writer.username() + "/restore").cookie(admin.cookie())).andExpect(status().isNoContent());

        // Deleting photos (testing tool): admins only, and only with the exact phrase.
        String body = "{\"username\":\"" + writer.username() + "\",\"confirm\":\"DELETE PHOTOS\"}";
        Account plain = signup("plain");
        mvc.perform(post("/api/admin/photos/delete").cookie(plain.cookie()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/photos/delete").cookie(admin.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"confirm\":\"delete\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/photos/delete").cookie(admin.cookie()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.deleted").value(0));
        mvc.perform(get("/api/trips/" + story.slug())).andExpect(status().isOk());
    }

    @Test
    void newFeaturesWorkTogether() throws Exception {
        Account writer = signup("finder");
        Account reader = signup("seeker");
        Story story = publish(writer);

        // Search finds the traveller and the story; LIKE wildcards are literal.
        mvc.perform(get("/api/search").param("q", writer.username()))
                .andExpect(jsonPath("$.people[0].username").value(writer.username()));
        mvc.perform(get("/api/search").param("q", "Moderation test")).andExpect(jsonPath("$.stories[*].slug", hasItem(story.slug())));
        mvc.perform(get("/api/search").param("q", "%_")).andExpect(jsonPath("$.people", hasSize(0)));

        // This week, suggestions, share preview.
        mvc.perform(get("/api/trips/this-week")).andExpect(jsonPath("$[*].slug", hasItem(story.slug())));
        mvc.perform(get("/api/suggestions/travellers").cookie(reader.cookie())).andExpect(jsonPath("$[*].username", hasItem(writer.username())));
        mvc.perform(get("/api/share/" + story.slug()))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(org.hamcrest.Matchers.containsString("og:title")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(org.hamcrest.Matchers.containsString("Moderation test")));

        // You can't react to your own story.
        mvc.perform(put("/api/trips/" + story.id() + "/reactions/been").cookie(writer.cookie())).andExpect(status().isBadRequest());

        // Push: public key for anyone; only real push services accepted.
        mvc.perform(get("/api/push/key")).andExpect(jsonPath("$.publicKey").isNotEmpty());
        var key = WebPushKeys.browserKey();
        mvc.perform(put("/api/me/push").cookie(reader.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://example.com/steal\",\"keys\":{\"p256dh\":\"" + key + "\",\"auth\":\"AAAAAAAAAAAAAAAAAAAAAA\"}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/me/push").cookie(reader.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/test-" + UUID.randomUUID() + "\",\"keys\":{\"p256dh\":\"" + key + "\",\"auth\":\"AAAAAAAAAAAAAAAAAAAAAA\"}}"))
                .andExpect(status().isNoContent());
        mvc.perform(put("/api/me/push").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions comment(Account a, long tripId, String text) throws Exception {
        return mvc.perform(post("/api/trips/" + tripId + "/comments").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"" + text + "\"}"));
    }

    private Account signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        Cookie c = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getCookie("weyvo_session");
        return new Account(c, username);
    }

    private Story publish(Account a) throws Exception {
        JsonNode created = json.readTree(mvc.perform(post("/api/trips").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FULL\",\"title\":\"Moderation test\",\"place\":\"Goa\",\"visibility\":\"PUBLIC\",\"sections\":[{\"body\":\"One\"}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/trips/" + created.get("id").asLong() + "/publish").cookie(a.cookie())).andExpect(status().isOk());
        return new Story(created.get("id").asLong(), created.get("slug").asText());
    }
}
