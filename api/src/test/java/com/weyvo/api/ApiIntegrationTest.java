package com.weyvo.api;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
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
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// DNS lookups are kept out of the test run; test emails use example.com, which has a null MX by design.
@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.auth.require-verified-email=false", "app.auth.signups-per-ip-per-hour=1000"})
@AutoConfigureMockMvc
@Testcontainers
class ApiIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    // ---- auth ----

    @Test
    void signupSetsSessionAndMeReturnsUser() throws Exception {
        Cookie session = signup("asha");
        mvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(session.getAttribute("username")));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginRejectsWrongPasswordAndAcceptsRightOne() throws Exception {
        String email = unique("ravi") + "@example.com";
        signup(unique("ravi"), email);
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"wrong-password-1\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email.toUpperCase() + "\",\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isOk())
                .andExpect(cookie().httpOnly("weyvo_session", true));
    }

    @Test
    void signupRejectsThrowawayInboxesIncludingSubdomains() throws Exception {
        for (String email : new String[] {"trip@mailinator.com", "trip@inbox.YOPMAIL.com"}) {
            mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\",\"username\":\"" + unique("temp") + "\",\"displayName\":\"Temp\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Use your real email address. Temporary inboxes aren't allowed"));
        }
    }

    @Test
    void publicProfileShowsNameButNeverEmail() throws Exception {
        Cookie session = signup("profile");
        String username = (String) session.getAttribute("username");
        mvc.perform(get("/api/users/" + username.toUpperCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.email").doesNotExist());
        mvc.perform(get("/api/users/nobody_here_123")).andExpect(status().isNotFound());
    }

    @Test
    void tamperedTokenIsTreatedAsSignedOut() throws Exception {
        mvc.perform(get("/api/auth/me").cookie(new Cookie("weyvo_session", "not.a.real-token")))
                .andExpect(status().isUnauthorized());
    }

    // ---- 60% gate and visibility ----

    @Test
    void signedOutReadersGetSixtyPercentAndSignedInReadersGetEverything() throws Exception {
        Cookie author = signup("aarav");
        String slug = publish(author, fullTrip("PUBLIC", 3));

        mvc.perform(get("/api/trips/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locked").value(true))
                .andExpect(jsonPath("$.sections", hasSize(2)))
                .andExpect(jsonPath("$.totalSections").value(3))
                .andExpect(jsonPath("$.moments", hasSize(0)))
                .andExpect(jsonPath("$.finalNote").value(nullValue()));

        Cookie reader = signup("reader");
        mvc.perform(get("/api/trips/" + slug).cookie(reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locked").value(false))
                .andExpect(jsonPath("$.sections", hasSize(3)))
                .andExpect(jsonPath("$.moments", hasSize(2)))
                .andExpect(jsonPath("$.finalNote").value("Go before the road gets paved."));
    }

    @Test
    void privateTripsAndDraftsAreInvisibleToEveryoneButTheOwner() throws Exception {
        Cookie owner = signup("owner");
        Cookie other = signup("other");
        String privateSlug = publish(owner, fullTrip("PRIVATE", 1));
        String draftSlug = create(owner, fullTrip("PUBLIC", 1)).get("slug").asText();

        for (String slug : new String[] {privateSlug, draftSlug}) {
            mvc.perform(get("/api/trips/" + slug)).andExpect(status().isNotFound());
            mvc.perform(get("/api/trips/" + slug).cookie(other)).andExpect(status().isNotFound());
            mvc.perform(get("/api/trips/" + slug).cookie(owner)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/trips")).andExpect(jsonPath("$[?(@.slug == '" + privateSlug + "')]").isEmpty());
    }

    @Test
    void unlistedTripsOpenByLinkButStayOutOfTheFeed() throws Exception {
        Cookie owner = signup("unlisted");
        String slug = publish(owner, fullTrip("UNLISTED", 2));
        mvc.perform(get("/api/trips/" + slug)).andExpect(status().isOk()).andExpect(jsonPath("$.locked").value(true));
        mvc.perform(get("/api/trips")).andExpect(jsonPath("$[?(@.slug == '" + slug + "')]").isEmpty());
    }

    // ---- ownership ----

    @Test
    void usersCannotEditPublishOrDeleteSomeoneElsesTrip() throws Exception {
        Cookie owner = signup("alice");
        Cookie intruder = signup("mallory");
        long id = create(owner, fullTrip("PUBLIC", 1)).get("id").asLong();

        mvc.perform(put("/api/trips/" + id).cookie(intruder).contentType(MediaType.APPLICATION_JSON).content(fullTrip("PUBLIC", 1)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/trips/" + id + "/publish").cookie(intruder)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/trips/" + id).cookie(intruder)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/trips/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/trips/" + id).cookie(owner)).andExpect(status().isNoContent());
    }

    @Test
    void ownersCanEditATripAndReplaceItsSections() throws Exception {
        Cookie owner = signup("editor");
        long id = create(owner, fullTrip("PUBLIC", 2)).get("id").asLong();
        mvc.perform(put("/api/trips/" + id).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(fullTrip("PUBLIC", 3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sections", hasSize(3)))
                .andExpect(jsonPath("$.sections[0].heading").value("Part 1"));
        mvc.perform(put("/api/trips/" + id).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(fullTrip("PUBLIC", 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sections", hasSize(1)));
    }

    // ---- template limits ----

    @Test
    void templateLimitsAreEnforcedOnTheServer() throws Exception {
        Cookie user = signup("limits");
        mvc.perform(post("/api/trips").cookie(user).contentType(MediaType.APPLICATION_JSON).content(fullTrip("PUBLIC", 4)))
                .andExpect(status().isBadRequest());
        String longTitle = "{\"kind\":\"FULL\",\"title\":\"" + "x".repeat(61) + "\",\"place\":\"Goa\",\"visibility\":\"PUBLIC\"}";
        mvc.perform(post("/api/trips").cookie(user).contentType(MediaType.APPLICATION_JSON).content(longTitle))
                .andExpect(status().isBadRequest());
        String shortWithoutTag = "{\"kind\":\"SHORT\",\"title\":\"Alibaug\",\"place\":\"Alibaug\",\"visibility\":\"PUBLIC\",\"sections\":[{\"body\":\"One bonfire\"}]}";
        mvc.perform(post("/api/trips").cookie(user).contentType(MediaType.APPLICATION_JSON).content(shortWithoutTag))
                .andExpect(status().isBadRequest());
        String shortStory = "{\"kind\":\"SHORT\",\"shortTag\":\"ONE_NIGHT\",\"title\":\"Alibaug\",\"place\":\"Alibaug\",\"visibility\":\"PUBLIC\",\"sections\":[{\"body\":\"One bonfire\"}]}";
        mvc.perform(post("/api/trips").cookie(user).contentType(MediaType.APPLICATION_JSON).content(shortStory))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.shortTag").value("ONE_NIGHT"));
    }

    // ---- helpers ----

    private Cookie signup(String name) throws Exception {
        String username = unique(name);
        return signup(username, username + "@example.com");
    }

    private Cookie signup(String username, String email) throws Exception {
        var res = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test " + username + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse();
        Cookie session = res.getCookie("weyvo_session");
        session.setAttribute("username", username);
        return session;
    }

    private JsonNode create(Cookie user, String body) throws Exception {
        String res = mvc.perform(post("/api/trips").cookie(user).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(res);
    }

    private String publish(Cookie user, String body) throws Exception {
        long id = create(user, body).get("id").asLong();
        mvc.perform(post("/api/trips/" + id + "/publish").cookie(user)).andExpect(status().isOk());
        return mvc.perform(get("/api/me/trips").cookie(user)).andReturn().getResponse().getContentAsString()
                .transform(s -> {
                    try {
                        for (JsonNode n : json.readTree(s)) if (n.get("id").asLong() == id) return n.get("slug").asText();
                        throw new IllegalStateException("published trip missing from /api/me/trips");
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                });
    }

    private static String fullTrip(String visibility, int sections) {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < sections; i++) {
            if (i > 0) s.append(',');
            s.append("{\"heading\":\"Part ").append(i + 1).append("\",\"body\":\"Section body ").append(i + 1).append("\"}");
        }
        return "{\"kind\":\"FULL\",\"title\":\"Ten days above the clouds\",\"place\":\"Spiti Valley\",\"intro\":\"We went for the monasteries.\","
                + "\"finalNote\":\"Go before the road gets paved.\",\"visibility\":\"" + visibility + "\","
                + "\"sections\":[" + s + "],\"moments\":[\"Butter tea\",\"The apple truck\"]}";
    }

    private static String unique(String name) {
        return name + "_" + UUID.randomUUID().toString().substring(0, 8);
    }
}
