package com.weyvo.api;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
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
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
        "app.signup.check-mail-domain=false",
        "app.storage.local-dir=target/test-photos",
        "app.community.questions-per-hour=2",
        "app.community.reports-to-hide=3"})
@AutoConfigureMockMvc
@Testcontainers
class CommunityIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private record Account(Cookie cookie, String username) {}
    private record TripRef(long id, String slug) {}

    // ---- Ask the traveller ----

    @Test
    void readersAskAuthorsAnswerAndBothAreNotified() throws Exception {
        Account author = signup("author");
        Account reader = signup("reader");
        TripRef trip = publish(author, "PUBLIC");

        long q = ask(reader, trip, "Is the road open in May?").andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine").value(true)).andReturnId();
        mvc.perform(get("/api/me/notifications").cookie(author.cookie()))
                .andExpect(jsonPath("$[0].type").value("QUESTION"))
                .andExpect(jsonPath("$[0].actor.username").value(reader.username()))
                .andExpect(jsonPath("$[0].trip.slug").value(trip.slug()));

        mvc.perform(put("/api/questions/" + q + "/answer").cookie(author.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Yes, from mid-May.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("Yes, from mid-May."));
        mvc.perform(get("/api/me/notifications").cookie(reader.cookie())).andExpect(jsonPath("$[0].type").value("ANSWER"));

        // Signed out: the count, never the text (Q&A is part of the full story).
        mvc.perform(get("/api/trips/" + trip.id() + "/questions"))
                .andExpect(jsonPath("$.locked").value(true))
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/api/trips/" + trip.id() + "/questions").cookie(reader.cookie()))
                .andExpect(jsonPath("$.items[0].answer").value("Yes, from mid-May."))
                .andExpect(jsonPath("$.items[0].status").value(nullValue()));
    }

    @Test
    void questionRulesAndLimitsHold() throws Exception {
        Account author = signup("rules");
        Account reader = signup("asker");
        Account other = signup("other");
        TripRef trip = publish(author, "PUBLIC");
        TripRef hidden = publish(author, "PRIVATE");

        ask(author, trip, "Asking myself?").andExpect(status().isBadRequest());
        ask(reader, hidden, "Can I see this?").andExpect(status().isNotFound());
        ask(reader, trip, "   ").andExpect(status().isBadRequest());
        ask(reader, trip, "x".repeat(301)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/trips/" + trip.id() + "/questions").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Hi\"}"))
                .andExpect(status().isUnauthorized());

        long q = ask(reader, trip, "First?").andExpect(status().isCreated()).andReturnId();
        ask(reader, trip, "Second?").andExpect(status().isCreated());
        ask(reader, trip, "Third?").andExpect(status().isTooManyRequests());

        mvc.perform(put("/api/questions/" + q + "/answer").cookie(other.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Not mine\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/questions/" + q + "/hidden").cookie(reader.cookie())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/questions/" + q).cookie(other.cookie())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/questions/" + q).cookie(reader.cookie())).andExpect(status().isNoContent());
    }

    @Test
    void reportsHideAQuestionAfterThreeDifferentPeople() throws Exception {
        Account author = signup("mod");
        Account asker = signup("spammer");
        TripRef trip = publish(author, "PUBLIC");
        long q = ask(asker, trip, "Buy cheap followers!").andExpect(status().isCreated()).andReturnId();

        mvc.perform(post("/api/questions/" + q + "/reports").cookie(asker.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"SPAM\"}"))
                .andExpect(status().isBadRequest());
        Account r1 = signup("r1");
        report(r1, q);
        report(r1, q); // the same person twice still counts once
        report(signup("r2"), q);
        mvc.perform(get("/api/trips/" + trip.id() + "/questions").cookie(r1.cookie())).andExpect(jsonPath("$.items", hasSize(1)));
        report(signup("r3"), q);

        mvc.perform(get("/api/trips/" + trip.id() + "/questions").cookie(r1.cookie())).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/api/trips/" + trip.id() + "/questions").cookie(author.cookie()))
                .andExpect(jsonPath("$.items[0].status").value("HIDDEN_BY_REPORTS"));
    }

    // ---- Notifications ----

    @Test
    void notificationsFireOnceSkipSavesAndRespectPrivacy() throws Exception {
        Account author = signup("star");
        Account fan = signup("fan");
        TripRef trip = publish(author, "PUBLIC");

        mvc.perform(put("/api/users/" + author.username() + "/follow").cookie(fan.cookie())).andExpect(status().isOk());
        mvc.perform(delete("/api/users/" + author.username() + "/follow").cookie(fan.cookie())).andExpect(status().isOk());
        mvc.perform(put("/api/users/" + author.username() + "/follow").cookie(fan.cookie())).andExpect(status().isOk());
        mvc.perform(put("/api/trips/" + trip.id() + "/reactions/save").cookie(fan.cookie())).andExpect(status().isOk());
        mvc.perform(put("/api/trips/" + trip.id() + "/reactions/want").cookie(fan.cookie())).andExpect(status().isOk());

        mvc.perform(get("/api/me/notifications").cookie(author.cookie()))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[?(@.type == 'FOLLOW')]", hasSize(1)))
                .andExpect(jsonPath("$[?(@.type == 'WANT')]", hasSize(1)));
        mvc.perform(get("/api/me/notifications/unread-count").cookie(author.cookie())).andExpect(jsonPath("$.count").value(2));
        mvc.perform(post("/api/me/notifications/read").cookie(author.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/notifications/unread-count").cookie(author.cookie())).andExpect(jsonPath("$.count").value(0));
        mvc.perform(get("/api/me/notifications")).andExpect(status().isUnauthorized());

        // The author answers the fan, then makes the trip private: the fan's notification loses the trip link.
        long q = ask(fan, trip, "Worth it in winter?").andExpect(status().isCreated()).andReturnId();
        mvc.perform(put("/api/questions/" + q + "/answer").cookie(author.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Very.\"}"));
        mvc.perform(put("/api/trips/" + trip.id()).cookie(author.cookie()).contentType(MediaType.APPLICATION_JSON).content(tripBody("PRIVATE")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/me/notifications").cookie(fan.cookie()))
                .andExpect(jsonPath("$[0].type").value("ANSWER"))
                .andExpect(jsonPath("$[0].trip").value(nullValue()));
    }

    // ---- helpers ----

    private interface IdResult {
        long andReturnId() throws Exception;
    }

    private record Asked(ResultActions actions, ObjectMapper json) {
        Asked andExpect(org.springframework.test.web.servlet.ResultMatcher m) throws Exception {
            actions.andExpect(m);
            return this;
        }

        long andReturnId() throws Exception {
            return json.readTree(actions.andReturn().getResponse().getContentAsString()).get("id").asLong();
        }
    }

    private Asked ask(Account who, TripRef trip, String text) throws Exception {
        return new Asked(mvc.perform(post("/api/trips/" + trip.id() + "/questions").cookie(who.cookie())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(java.util.Map.of("text", text)))), json);
    }

    private void report(Account who, long q) throws Exception {
        mvc.perform(post("/api/questions/" + q + "/reports").cookie(who.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"SPAM\"}"))
                .andExpect(status().isNoContent());
    }

    private Account signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        Cookie cookie = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test " + name + "\"}"))
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
        return "{\"kind\":\"FULL\",\"title\":\"Community test\",\"place\":\"Goa\",\"visibility\":\"" + visibility + "\",\"sections\":[{\"body\":\"One\"}]}";
    }
}
