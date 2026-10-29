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
        mvc.perform(post("/api/billing/orders").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"period\":\"MONTH\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/billing/orders").contentType(MediaType.APPLICATION_JSON).content("{\"period\":\"MONTH\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ---- helpers ----

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
        Cookie cookie = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getCookie("weyvo_session");
        if (verified) db.update("UPDATE users SET email_verified_at = now() WHERE username = ?", username);
        return new Account(cookie, username);
    }

    private static String sign(String secret, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
