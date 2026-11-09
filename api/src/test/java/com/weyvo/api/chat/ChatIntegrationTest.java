package com.weyvo.api.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.auth.signups-per-ip-per-hour=1000"})
@AutoConfigureMockMvc
@Testcontainers
class ChatIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired ChatService chats;

    private record Account(Cookie cookie, String username, long id) {}

    @Test
    void onlyFollowersCanAskAndNothingIsSentBeforeAccepting() throws Exception {
        Account fan = signup("fan");
        Account star = signup("star");
        request(fan, star).andExpect(status().isBadRequest());
        follow(fan, star);
        long chat = id(request(fan, star).andExpect(jsonPath("$.state").value("REQUESTED")));
        say(fan, chat, "hey!").andExpect(status().isNotFound());
        mvc.perform(get("/api/chats").cookie(star.cookie())).andExpect(jsonPath("$.requests[0].from.username").value(fan.username()));
        mvc.perform(post("/api/chats/requests/" + chat + "/accept").cookie(star.cookie())).andExpect(jsonPath("$.state").value("CHAT"));
        say(fan, chat, "hey! loved your Spiti story 😍").andExpect(status().isOk());
        mvc.perform(get("/api/chats/with/" + fan.username()).cookie(star.cookie())).andExpect(jsonPath("$.state").value("CHAT"));
    }

    @Test
    void linksAndAbuseAreRefusedButAnyTopicIsFine() throws Exception {
        long chat = openChat(signup("a"), signup("b"));
        Account a = member(chat, true);
        say(a, chat, "who won the cricket match?").andExpect(status().isOk());
        Thread.sleep(1100);
        say(a, chat, "call me on 98765 43210").andExpect(status().isBadRequest());
        say(a, chat, "visit https://example.com").andExpect(status().isBadRequest());
    }

    @Test
    void readMessagesVanishWhenBothHaveLeftAndUnreadOnesAfter12Hours() throws Exception {
        long chat = openChat(signup("c"), signup("d"));
        Account c = member(chat, true);
        Account d = member(chat, false);
        // d isn't in the chat: the message waits unread, so it isn't "Seen" and d gets the dot.
        say(c, chat, "see you in Goa").andExpect(status().isOk()).andExpect(jsonPath("$.readAt").isEmpty());
        mvc.perform(get("/api/chats/unread").cookie(d.cookie())).andExpect(jsonPath("$.count").value(1));
        // d opens it: now it's read, and while d stays, new messages are read on arrival.
        mvc.perform(get("/api/chats/" + chat + "/messages").cookie(d.cookie())).andExpect(jsonPath("$[0].readAt").isNotEmpty());
        Thread.sleep(1100);
        say(c, chat, "bring snacks").andExpect(jsonPath("$.readAt").isNotEmpty());
        assertThat(count(chat)).isEqualTo(2);
        // d leaves and c isn't in it either: everything read is gone.
        mvc.perform(post("/api/chats/" + chat + "/leave").cookie(d.cookie())).andExpect(status().isNoContent());
        assertThat(count(chat)).isZero();

        Thread.sleep(1100);
        say(c, chat, "still there?").andExpect(status().isOk());
        db.update("UPDATE chat_messages SET created_at = now() - interval '13 hours' WHERE chat_id = ?", chat);
        chats.sweep();
        assertThat(count(chat)).isZero();
    }

    @Test
    void unreadMessagesInOneChatAreCapped() throws Exception {
        long chat = openChat(signup("e"), signup("f"));
        long sender = member(chat, true).id();
        for (int i = 0; i < ChatService.MAX_UNREAD_IN_CHAT; i++) {
            db.update("INSERT INTO chat_messages (chat_id, sender_id, body) VALUES (?, ?, 'hi')", chat, sender);
        }
        say(member(chat, true), chat, "one more").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("catch up")));
    }

    @Test
    void blockingEndsTheChatAndReportsKeepACopy() throws Exception {
        Account g = signup("g");
        Account h = signup("h");
        long chat = openChat(g, h);
        say(g, chat, "this trip was fun").andExpect(status().isOk());
        mvc.perform(post("/api/chats/" + chat + "/report").cookie(h.cookie())).andExpect(status().isNoContent());
        assertThat(db.queryForObject("SELECT transcript FROM chat_reports WHERE reporter_id = ?", String.class, h.id())).contains("this trip was fun");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/users/" + g.username() + "/block").cookie(h.cookie()))
                .andExpect(status().is2xxSuccessful());
        assertThat(db.queryForObject("SELECT count(*) FROM chat_requests WHERE id = ?", Integer.class, chat)).isZero();
        Thread.sleep(1100);
        say(g, chat, "hello?").andExpect(status().isNotFound());
    }

    // ---- helpers ----

    private Account lastFrom, lastTo;

    /** A follows B, asks, B accepts. */
    private long openChat(Account from, Account to) throws Exception {
        follow(from, to);
        long chat = id(request(from, to));
        mvc.perform(post("/api/chats/requests/" + chat + "/accept").cookie(to.cookie())).andExpect(status().isOk());
        lastFrom = from;
        lastTo = to;
        return chat;
    }

    private Account member(long chat, boolean sender) {
        return sender ? lastFrom : lastTo;
    }

    private void follow(Account who, Account whom) {
        db.update("INSERT INTO follows (follower_id, followee_id) VALUES (?, ?) ON CONFLICT DO NOTHING", who.id(), whom.id());
    }

    private ResultActions request(Account from, Account to) throws Exception {
        return mvc.perform(post("/api/chats/requests").cookie(from.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + to.username() + "\"}"));
    }

    private ResultActions say(Account a, long chat, String text) throws Exception {
        return mvc.perform(post("/api/chats/" + chat + "/messages").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("text", text))));
    }

    private long id(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString()).get("chatId").asLong();
    }

    private int count(long chat) {
        return db.queryForObject("SELECT count(*) FROM chat_messages WHERE chat_id = ?", Integer.class, chat);
    }

    private Account signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        String email = username + "@example.com";
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isAccepted());
        db.update("UPDATE users SET email_verified_at = now() WHERE username = ?", username);
        Cookie cookie = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}")).andReturn().getResponse().getCookie("weyvo_session");
        return new Account(cookie, username, db.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username));
    }
}
