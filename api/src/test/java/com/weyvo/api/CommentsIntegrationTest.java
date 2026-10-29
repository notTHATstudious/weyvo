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
import java.util.HashMap;
import java.util.Map;
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
        "app.auth.require-verified-email=false",
        "app.auth.signups-per-ip-per-hour=1000",
        "app.community.comments-per-hour=3",
        "app.community.reports-to-hide=2"})
@AutoConfigureMockMvc
@Testcontainers
class CommentsIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private record Account(Cookie cookie, String username) {}

    @Test
    void commentsAndRepliesNotifyTheRightPeople() throws Exception {
        Account author = signup("author");
        Account reader = signup("reader");
        Account friend = signup("friend");
        long trip = publish(author, "PUBLIC");

        long c = id(comment(reader, trip, "Loved the monastery bit!", null).andExpect(status().isCreated()));
        notifications(author).andExpect(jsonPath("$[0].type").value("COMMENT")).andExpect(jsonPath("$[0].actor.username").value(reader.username()));

        comment(author, trip, "Thank you!", c).andExpect(status().isCreated());
        notifications(reader).andExpect(jsonPath("$[0].type").value("REPLY"));
        notifications(author).andExpect(jsonPath("$", hasSize(1))); // no self-notification for replying

        comment(friend, trip, "Same here", c).andExpect(status().isCreated());
        notifications(reader).andExpect(jsonPath("$[?(@.type == 'REPLY')]", hasSize(2)));
        notifications(author).andExpect(jsonPath("$[?(@.type == 'COMMENT')]", hasSize(2)));

        mvc.perform(get("/api/trips/" + trip + "/comments").cookie(friend.cookie()))
                .andExpect(jsonPath("$.count").value(3))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].replies", hasSize(2)));
        mvc.perform(get("/api/trips/" + trip + "/comments"))
                .andExpect(jsonPath("$.locked").value(true))
                .andExpect(jsonPath("$.count").value(3))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void commentRulesHold() throws Exception {
        Account author = signup("rules");
        Account reader = signup("commenter");
        Account other = signup("other");
        long trip = publish(author, "PUBLIC");
        long otherTrip = publish(author, "PUBLIC");
        long hidden = publish(author, "PRIVATE");

        comment(reader, hidden, "Can I see this?", null).andExpect(status().isNotFound());
        comment(reader, trip, "  ", null).andExpect(status().isBadRequest());
        comment(reader, trip, "x".repeat(501), null).andExpect(status().isBadRequest());
        mvc.perform(post("/api/trips/" + trip + "/comments").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Hi\"}"))
                .andExpect(status().isUnauthorized());

        long top = id(comment(reader, trip, "First", null).andExpect(status().isCreated()));
        long reply = id(comment(reader, trip, "Second", top).andExpect(status().isCreated()));
        comment(other, trip, "Reply to a reply", reply).andExpect(status().isBadRequest());
        comment(other, otherTrip, "Wrong story", top).andExpect(status().isBadRequest());
        comment(reader, trip, "Third", null).andExpect(status().isCreated());
        comment(reader, trip, "Fourth", null).andExpect(status().isTooManyRequests());

        mvc.perform(put("/api/comments/" + top + "/hidden").cookie(reader.cookie())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/comments/" + top).cookie(other.cookie())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/comments/" + top).cookie(author.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/" + trip + "/comments").cookie(other.cookie())).andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void reportsHideACommentButTheAuthorStillSeesIt() throws Exception {
        Account author = signup("mod");
        Account spammer = signup("spammer");
        long trip = publish(author, "PUBLIC");
        long c = id(comment(spammer, trip, "Cheap followers here", null).andExpect(status().isCreated()));

        report(spammer, c).andExpect(status().isBadRequest());
        Account r1 = signup("r1");
        report(r1, c).andExpect(status().isNoContent());
        report(signup("r2"), c).andExpect(status().isNoContent());

        mvc.perform(get("/api/trips/" + trip + "/comments").cookie(r1.cookie())).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/api/trips/" + trip + "/comments").cookie(author.cookie()))
                .andExpect(jsonPath("$.items[0].status").value("HIDDEN_BY_REPORTS"));
    }

    // ---- helpers ----

    private ResultActions comment(Account who, long trip, String text, Long parentId) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("text", text);
        body.put("parentId", parentId);
        return mvc.perform(post("/api/trips/" + trip + "/comments").cookie(who.cookie())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private ResultActions report(Account who, long commentId) throws Exception {
        return mvc.perform(post("/api/comments/" + commentId + "/reports").cookie(who.cookie())
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"SPAM\"}"));
    }

    private ResultActions notifications(Account who) throws Exception {
        return mvc.perform(get("/api/me/notifications").cookie(who.cookie()));
    }

    private long id(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private Account signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        Cookie cookie = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test " + name + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getCookie("weyvo_session");
        return new Account(cookie, username);
    }

    private long publish(Account owner, String visibility) throws Exception {
        var created = json.readTree(mvc.perform(post("/api/trips").cookie(owner.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FULL\",\"title\":\"Comment test\",\"place\":\"Goa\",\"visibility\":\"" + visibility + "\",\"sections\":[{\"body\":\"One\"}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long id = created.get("id").asLong();
        mvc.perform(post("/api/trips/" + id + "/publish").cookie(owner.cookie())).andExpect(status().isOk());
        return id;
    }
}
