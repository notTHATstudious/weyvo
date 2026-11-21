package com.weyvo.api.daily;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.auth.signups-per-ip-per-hour=1000"})
@AutoConfigureMockMvc
@Testcontainers
class DailyIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired DailyService daily;

    @Test
    void theDailyQuizUsesAPublicPhotoAndItsPlaceAndAllowsOneGuess() throws Exception {
        Cookie me = signup("player");
        long owner = db.queryForObject("SELECT id FROM users ORDER BY id LIMIT 1", Long.class);
        long trip = db.queryForObject("""
                INSERT INTO trips (owner_id, kind, title, place, slug, status, visibility, published_at)
                VALUES (?, 'FULL', 'Goa days', 'Candolim, Goa', 'goa-days-' || floor(random() * 1e9)::text, 'PUBLISHED', 'PUBLIC', now()) RETURNING id""", Long.class, owner);
        db.update("INSERT INTO trip_photos (trip_id, role, position, large_key, thumb_key, width, height, size_bytes) VALUES (?, 'COVER', 0, 'k', 'k', 10, 10, 1)", trip);
        daily.forgetQuiz();

        JsonNode today = json.readTree(mvc.perform(get("/api/daily").cookie(me)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode options = today.get("quiz").get("options");
        assertThat(options).hasSize(4);
        assertThat(options.toString()).contains("Candolim");
        assertThat(today.get("quiz").get("answer").isNull()).isTrue(); // not given away before guessing

        mvc.perform(post("/api/daily/guess").cookie(me).contentType(MediaType.APPLICATION_JSON).content("{\"option\":\"Candolim\"}"))
                .andExpect(jsonPath("$.correct").value(true)).andExpect(jsonPath("$.percentCorrect").value(100));
        mvc.perform(post("/api/daily/guess").cookie(me).contentType(MediaType.APPLICATION_JSON).content("{\"option\":\"Candolim\"}"))
                .andExpect(status().isBadRequest());
        // Opening the app today (5) plus a right answer (10).
        mvc.perform(get("/api/me/points").cookie(me)).andExpect(jsonPath("$.balance").value(15));
    }

    @Test
    void questionAnswersAreFilteredAndOncePerDay() throws Exception {
        Cookie me = signup("answerer");
        say(me, "visit https://spam.example for deals").andExpect(status().isBadRequest());
        say(me, "Irani chai in Pune, at a tiny cafe").andExpect(status().isNoContent());
        say(me, "and another").andExpect(status().isBadRequest());
        mvc.perform(get("/api/daily").cookie(me)).andExpect(jsonPath("$.question.myAnswer").value("Irani chai in Pune, at a tiny cafe"));
    }

    @Test
    void theStreakCountsDaysInARowAndPaysABonusAtSeven() throws Exception {
        Cookie me = signup("streaker");
        long id = db.queryForObject("SELECT id FROM users WHERE email LIKE 'streaker%' ORDER BY id DESC LIMIT 1", Long.class);
        db.update("""
                INSERT INTO user_activity_days (user_id, day)
                SELECT ?, (now() AT TIME ZONE 'Asia/Kolkata')::date - g FROM generate_series(1, 6) g ON CONFLICT DO NOTHING""", id);
        mvc.perform(get("/api/daily").cookie(me)).andExpect(jsonPath("$.streak.days").value(7));
        assertThat(db.queryForObject("SELECT count(*) FROM daily_bonuses WHERE user_id = ?", Integer.class, id)).isEqualTo(1);
    }

    private org.springframework.test.web.servlet.ResultActions say(Cookie me, String text) throws Exception {
        return mvc.perform(post("/api/daily/answer").cookie(me).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("text", text, "place", ""))));
    }

    private Cookie signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        String email = username + "@example.com";
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isAccepted());
        db.update("UPDATE users SET email_verified_at = now() WHERE username = ?", username);
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}")).andReturn().getResponse().getCookie("weyvo_session");
    }
}
