package com.weyvo.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.storage.local-dir=target/test-photos"})
@AutoConfigureMockMvc
@Testcontainers
class SocialIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private record Account(Cookie cookie, String username) {}
    private record TripRef(long id, String slug) {}

    @Test
    void reactionsCountOnceAndSaveStaysPrivate() throws Exception {
        Account author = signup("author");
        Account reader = signup("reader");
        TripRef trip = publish(author, "PUBLIC");

        mvc.perform(put("/api/trips/" + trip.id() + "/reactions/want").cookie(reader.cookie())).andExpect(status().isOk());
        mvc.perform(put("/api/trips/" + trip.id() + "/reactions/want").cookie(reader.cookie()))
                .andExpect(jsonPath("$.want").value(1))
                .andExpect(jsonPath("$.wantByMe").value(true));
        mvc.perform(put("/api/trips/" + trip.id() + "/reactions/save").cookie(reader.cookie()))
                .andExpect(jsonPath("$.savedByMe").value(true));

        // Others see the public Want count but not the reader's private Save.
        mvc.perform(get("/api/trips/" + trip.slug()).cookie(author.cookie()))
                .andExpect(jsonPath("$.reactions.want").value(1))
                .andExpect(jsonPath("$.reactions.savedByMe").value(false))
                .andExpect(jsonPath("$.reactions.save").doesNotExist());
        mvc.perform(get("/api/me/reactions/save").cookie(reader.cookie())).andExpect(jsonPath("$", hasSize(1)));

        mvc.perform(delete("/api/trips/" + trip.id() + "/reactions/want").cookie(reader.cookie()))
                .andExpect(jsonPath("$.want").value(0))
                .andExpect(jsonPath("$.wantByMe").value(false));
        mvc.perform(put("/api/trips/" + trip.id() + "/reactions/love").cookie(reader.cookie())).andExpect(status().isNotFound());
    }

    @Test
    void reactionsNeedAccessAndASignedInReader() throws Exception {
        Account author = signup("hidden");
        Account other = signup("other");
        TripRef privateTrip = publish(author, "PRIVATE");
        TripRef publicTrip = publish(author, "PUBLIC");

        mvc.perform(put("/api/trips/" + privateTrip.id() + "/reactions/been").cookie(other.cookie())).andExpect(status().isNotFound());
        mvc.perform(put("/api/trips/" + publicTrip.id() + "/reactions/been")).andExpect(status().isUnauthorized());
    }

    @Test
    void savedListDropsTripsThatGoPrivate() throws Exception {
        Account author = signup("changer");
        Account reader = signup("saver");
        TripRef trip = publish(author, "PUBLIC");
        mvc.perform(put("/api/trips/" + trip.id() + "/reactions/save").cookie(reader.cookie())).andExpect(status().isOk());
        mvc.perform(get("/api/me/reactions/save").cookie(reader.cookie())).andExpect(jsonPath("$", hasSize(1)));

        mvc.perform(put("/api/trips/" + trip.id()).cookie(author.cookie()).contentType(MediaType.APPLICATION_JSON).content(tripBody("PRIVATE")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/me/reactions/save").cookie(reader.cookie())).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void followsDriveCountsAndTheFollowingFeed() throws Exception {
        Account me = signup("me");
        Account friend = signup("friend");
        Account stranger = signup("stranger");
        TripRef friendTrip = publish(friend, "PUBLIC");
        publish(stranger, "PUBLIC");

        mvc.perform(put("/api/users/" + me.username() + "/follow").cookie(me.cookie())).andExpect(status().isBadRequest());
        mvc.perform(put("/api/users/" + friend.username() + "/follow").cookie(me.cookie()))
                .andExpect(jsonPath("$.followers").value(1))
                .andExpect(jsonPath("$.followedByMe").value(true));
        mvc.perform(put("/api/users/" + friend.username() + "/follow").cookie(me.cookie())).andExpect(jsonPath("$.followers").value(1));

        mvc.perform(get("/api/users/" + me.username())).andExpect(jsonPath("$.following").value(1));
        mvc.perform(get("/api/me/following").cookie(me.cookie()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].slug").value(friendTrip.slug()));

        mvc.perform(delete("/api/users/" + friend.username() + "/follow").cookie(me.cookie())).andExpect(jsonPath("$.followers").value(0));
        mvc.perform(get("/api/me/following").cookie(me.cookie())).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(put("/api/users/nobody_here_404/follow").cookie(me.cookie())).andExpect(status().isNotFound());
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

    private TripRef publish(Account owner, String visibility) throws Exception {
        var created = json.readTree(mvc.perform(post("/api/trips").cookie(owner.cookie()).contentType(MediaType.APPLICATION_JSON).content(tripBody(visibility)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long id = created.get("id").asLong();
        mvc.perform(post("/api/trips/" + id + "/publish").cookie(owner.cookie())).andExpect(status().isOk());
        return new TripRef(id, created.get("slug").asText());
    }

    private static String tripBody(String visibility) {
        return "{\"kind\":\"FULL\",\"title\":\"Social test\",\"place\":\"Goa\",\"visibility\":\"" + visibility + "\",\"sections\":[{\"body\":\"One\"}]}";
    }
}
