package com.weyvo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weyvo.api.billing.RazorpayGateway;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
        "app.signup.check-mail-domain=false",
        "app.auth.signups-per-ip-per-hour=1000",
        "app.payments.razorpay-key-id=rzp_test_dummy",
        "app.payments.razorpay-key-secret=test-key-secret",
        "app.payments.razorpay-webhook-secret=test-webhook-secret",
        "app.payments.month-price-paise=9900",
        "app.payments.year-price-paise=99900"})
@AutoConfigureMockMvc
@Testcontainers
class BillingIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean RazorpayGateway razorpay;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;

    private final AtomicInteger orders = new AtomicInteger();

    private record Account(Cookie cookie, String username) {}

    @BeforeEach
    void fakeRazorpay() {
        when(razorpay.createOrder(anyInt(), anyString(), anyString(), anyMap()))
                .thenAnswer(inv -> "order_test_" + orders.incrementAndGet() + "_" + UUID.randomUUID().toString().substring(0, 6));
    }

    @Test
    void aSignedPaymentGrantsPremiumOnceAtTheServerPrice() throws Exception {
        Account a = signup("buyer", true);
        mvc.perform(get("/api/billing/plans")).andExpect(jsonPath("$.keyId").value("rzp_test_dummy"));

        String orderId = order(a, "MONTH").andExpect(jsonPath("$.amountPaise").value(9900)).andReturnOrderId();
        verify(a, orderId, "pay_1", sign("test-key-secret", orderId + "|pay_1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("PREMIUM"));
        Timestamp first = expiry(a);
        assertThat(first.toInstant()).isAfter(java.time.Instant.now().plus(java.time.Duration.ofDays(27)));

        verify(a, orderId, "pay_1", sign("test-key-secret", orderId + "|pay_1")).andExpect(status().isOk());
        assertThat(expiry(a)).isEqualTo(first); // the same payment never extends twice
    }

    @Test
    void forgedOrForeignPaymentsAreRejected() throws Exception {
        Account a = signup("faker", true);
        Account b = signup("other", true);
        String orderId = order(a, "YEAR").andReturnOrderId();

        verify(a, orderId, "pay_2", "0".repeat(64)).andExpect(status().isBadRequest());
        verify(b, orderId, "pay_2", sign("test-key-secret", orderId + "|pay_2")).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/plan").cookie(a.cookie())).andExpect(jsonPath("$.plan").value("FREE"));
    }

    @Test
    void webhookNeedsAValidSignatureAndTheExactAmount() throws Exception {
        Account a = signup("hooked", true);
        String orderId = order(a, "MONTH").andReturnOrderId();
        String wrongAmount = webhookBody(orderId, "pay_3", 100);
        String right = webhookBody(orderId, "pay_3", 9900);

        webhook(right, "bad-signature").andExpect(status().isBadRequest());
        webhook(wrongAmount, sign("test-webhook-secret", wrongAmount)).andExpect(status().isOk());
        mvc.perform(get("/api/me/plan").cookie(a.cookie())).andExpect(jsonPath("$.plan").value("FREE"));

        webhook(right, sign("test-webhook-secret", right)).andExpect(status().isOk());
        mvc.perform(get("/api/me/plan").cookie(a.cookie())).andExpect(jsonPath("$.plan").value("PREMIUM"));
    }

    @Test
    void unverifiedAccountsCannotBuy() throws Exception {
        Account a = signup("early", false);
        assertThat(a.cookie()).isNull(); // never signed in until the email is confirmed
        mvc.perform(post("/api/billing/orders").contentType(MediaType.APPLICATION_JSON).content("{\"period\":\"MONTH\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void weyPointsTakeMoneyOffPremiumOnlyAfterThreeMonths() throws Exception {
        Account a = signup("saver", true);
        // 210 earlier days opened (5 points each, one per week) plus today gives 1,055 points.
        db.update("""
                INSERT INTO user_activity_days (user_id, day)
                SELECT u.id, current_date - (g * 7) FROM users u, generate_series(1, 210) g WHERE u.username = ?""", a.username());

        mvc.perform(get("/api/me/points").cookie(a.cookie()))
                .andExpect(jsonPath("$.balance").value(1055)).andExpect(jsonPath("$.unlocked").value(false));
        order(a, "MONTH", true).andExpect(jsonPath("$.amountPaise").value(9900)).andExpect(jsonPath("$.pointsUsed").value(0));

        db.update("UPDATE users SET created_at = now() - interval '4 months' WHERE username = ?", a.username());
        mvc.perform(get("/api/me/points").cookie(a.cookie())).andExpect(jsonPath("$.redeemableRupees").value(50));
        // At most half the ₹99 price, in ₹25 steps: ₹25 off for 500 points.
        order(a, "MONTH", true).andExpect(jsonPath("$.amountPaise").value(7400)).andExpect(jsonPath("$.pointsUsed").value(500));
        mvc.perform(get("/api/me/points").cookie(a.cookie())).andExpect(jsonPath("$.balance").value(555));
    }

    @Test
    void weyPointsAreCappedEachDay() throws Exception {
        Account a = signup("streak", true);
        db.update("INSERT INTO user_activity_days (user_id, day) SELECT id, current_date FROM users WHERE username = ?", a.username());
        db.update("""
                INSERT INTO trips (owner_id, kind, title, place, slug, status, visibility, published_at)
                SELECT u.id, 'FULL', 'Trip ' || g, 'Goa', 'cap-' || u.id || '-' || g, 'PUBLISHED', 'PUBLIC', now()
                FROM users u, generate_series(1, 3) g WHERE u.username = ?""", a.username());
        mvc.perform(get("/api/me/points").cookie(a.cookie())).andExpect(jsonPath("$.balance").value(50));
        db.update("UPDATE trips SET removed_at = now() WHERE slug LIKE 'cap-%'");
        mvc.perform(get("/api/me/points").cookie(a.cookie())).andExpect(jsonPath("$.balance").value(5));
    }

    // ---- helpers ----

    private OrderResult order(Account a, String period, boolean usePoints) throws Exception {
        return new OrderResult(mvc.perform(post("/api/billing/orders").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"period\":\"" + period + "\",\"usePoints\":" + usePoints + "}")).andExpect(status().isOk()), json);
    }

    private record OrderResult(ResultActions actions, ObjectMapper json) {
        OrderResult andExpect(org.springframework.test.web.servlet.ResultMatcher m) throws Exception {
            actions.andExpect(m);
            return this;
        }

        String andReturnOrderId() throws Exception {
            return json.readTree(actions.andReturn().getResponse().getContentAsString()).get("orderId").asText();
        }
    }

    private OrderResult order(Account a, String period) throws Exception {
        return new OrderResult(mvc.perform(post("/api/billing/orders").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"period\":\"" + period + "\"}")).andExpect(status().isOk()), json);
    }

    private ResultActions verify(Account a, String orderId, String paymentId, String signature) throws Exception {
        return mvc.perform(post("/api/billing/verify").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"orderId\":\"" + orderId + "\",\"paymentId\":\"" + paymentId + "\",\"signature\":\"" + signature + "\"}"));
    }

    private ResultActions webhook(String body, String signature) throws Exception {
        return mvc.perform(post("/api/billing/webhook").header("X-Razorpay-Signature", signature).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String webhookBody(String orderId, String paymentId, int amount) {
        return "{\"event\":\"payment.captured\",\"payload\":{\"payment\":{\"entity\":{\"id\":\"" + paymentId
                + "\",\"order_id\":\"" + orderId + "\",\"amount\":" + amount + "}}}}";
    }

    private Timestamp expiry(Account a) {
        return db.queryForObject("SELECT plan_expires_at FROM users WHERE username = ?", Timestamp.class, a.username());
    }

    private Account signup(String name, boolean verified) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        String email = username + "@example.com";
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isAccepted());
        if (!verified) return new Account(null, username);
        db.update("UPDATE users SET email_verified_at = now() WHERE username = ?", username);
        return new Account(login(email), username);
    }

    /** Signs in and returns the session cookie (null when the server holds the sign-in back). */
    private Cookie login(String email) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}")).andReturn().getResponse().getCookie("weyvo_session");
    }


    private static String sign(String secret, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
