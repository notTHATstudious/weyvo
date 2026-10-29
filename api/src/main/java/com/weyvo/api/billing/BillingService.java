package com.weyvo.api.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Premium as one-time purchases of a month or a year. The server sets every amount, verifies Razorpay's
 * signatures, and grants each paid order exactly once (checkout callback and webhook can both arrive).
 */
@Service
public class BillingService {

    public enum Period { MONTH, YEAR }

    public record PlanOption(Period period, int amountPaise, String currency, String label) {}

    public record Plans(String keyId, boolean available, List<PlanOption> options,
                        AppProperties.PlanLimits free, AppProperties.PlanLimits premium) {}

    public record Order(String orderId, int amountPaise, String currency, String keyId, Period period) {}

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    private final AppProperties.Payments cfg;
    private final AppProperties.Plans limits;
    private final RazorpayGateway razorpay;
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    public BillingService(AppProperties props, RazorpayGateway razorpay, NamedParameterJdbcTemplate jdbc, ObjectMapper json) {
        this.cfg = props.payments();
        this.limits = props.plans();
        this.razorpay = razorpay;
        this.jdbc = jdbc;
        this.json = json;
    }

    public Plans plans() {
        return new Plans(cfg.configured() ? cfg.razorpayKeyId() : null, cfg.configured(), List.of(
                new PlanOption(Period.MONTH, cfg.monthPricePaise(), "INR", "1 month"),
                new PlanOption(Period.YEAR, cfg.yearPricePaise(), "INR", "1 year")), limits.free(), limits.premium());
    }

    @Transactional
    public Order createOrder(long userId, Period period) {
        int amount = period == Period.MONTH ? cfg.monthPricePaise() : cfg.yearPricePaise();
        String receipt = "u" + userId + "-" + UUID.randomUUID().toString().substring(0, 12);
        String orderId = razorpay.createOrder(amount, "INR", receipt, Map.of("userId", String.valueOf(userId), "period", period.name()));
        jdbc.update("INSERT INTO payments (user_id, razorpay_order_id, period, amount_paise) VALUES (:u, :o, :p, :a)",
                new MapSqlParameterSource().addValue("u", userId).addValue("o", orderId).addValue("p", period.name()).addValue("a", amount));
        log.info("Order created userId={} period={} amount={}", userId, period, amount);
        return new Order(orderId, amount, "INR", cfg.razorpayKeyId(), period);
    }

    /** Called by the web app after checkout. The signature proves Razorpay issued this payment for this order. */
    @Transactional
    public void verifyCheckout(long userId, String orderId, String paymentId, String signature) {
        Payment p = payment(orderId).filter(x -> x.userId() == userId).orElseThrow(ApiException::notFound);
        String expected = hmac(cfg.razorpayKeySecret(), orderId + "|" + paymentId);
        if (!constantTimeEquals(expected, signature)) {
            log.warn("Payment signature mismatch userId={}", userId);
            throw ApiException.badRequest("We couldn't confirm that payment. If you were charged, contact support");
        }
        grant(p, paymentId);
    }

    /** Razorpay's server-to-server notification. Verified with the webhook secret over the raw body. */
    @Transactional
    public void webhook(String rawBody, String signature) {
        if (cfg.razorpayWebhookSecret() == null || cfg.razorpayWebhookSecret().isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Webhook not configured");
        }
        if (signature == null || !constantTimeEquals(hmac(cfg.razorpayWebhookSecret(), rawBody), signature)) {
            log.warn("Webhook signature mismatch");
            throw ApiException.badRequest("Invalid signature");
        }
        JsonNode event;
        try {
            event = json.readTree(rawBody);
        } catch (Exception e) {
            throw ApiException.badRequest("Malformed webhook");
        }
        String type = event.path("event").asText();
        if (!type.equals("payment.captured") && !type.equals("order.paid")) return;
        JsonNode payment = event.at("/payload/payment/entity");
        String orderId = payment.path("order_id").asText(null);
        String paymentId = payment.path("id").asText(null);
        if (orderId == null || paymentId == null) return;
        payment(orderId).ifPresent(p -> {
            if (payment.path("amount").asInt(-1) != p.amountPaise()) {
                log.error("Webhook amount mismatch for order; not granting");
                return;
            }
            grant(p, paymentId);
        });
    }

    // ---- helpers ----

    private record Payment(long id, long userId, String period, int amountPaise, String status) {}

    private java.util.Optional<Payment> payment(String orderId) {
        return jdbc.query("SELECT id, user_id, period, amount_paise, status FROM payments WHERE razorpay_order_id = :o FOR UPDATE",
                        new MapSqlParameterSource("o", orderId),
                        (rs, i) -> new Payment(rs.getLong("id"), rs.getLong("user_id"), rs.getString("period"), rs.getInt("amount_paise"), rs.getString("status")))
                .stream().findFirst();
    }

    /** Idempotent: an order that's already paid changes nothing. Extends from the later of now or the current expiry. */
    private void grant(Payment p, String paymentId) {
        if ("PAID".equals(p.status())) return;
        var params = new MapSqlParameterSource().addValue("id", p.id()).addValue("pay", paymentId).addValue("u", p.userId())
                .addValue("interval", Period.valueOf(p.period()) == Period.MONTH ? "1 month" : "1 year");
        jdbc.update("UPDATE payments SET status = 'PAID', razorpay_payment_id = :pay, paid_at = now() WHERE id = :id", params);
        jdbc.update("""
                UPDATE users SET plan = 'PREMIUM',
                       plan_expires_at = GREATEST(COALESCE(plan_expires_at, now()), now()) + CAST(:interval AS interval)
                WHERE id = :u AND NOT (plan = 'PREMIUM' AND plan_expires_at IS NULL)""", params);
        log.info("Premium granted userId={} period={}", p.userId(), p.period());
    }

    private static String hmac(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
