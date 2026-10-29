package com.weyvo.api.billing;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Creates Razorpay orders with the server-side key pair. The key secret never leaves the server. */
@Component
public class RazorpayGateway {

    private static final Logger log = LoggerFactory.getLogger(RazorpayGateway.class);

    private final RestClient http;
    private final boolean configured;

    public RazorpayGateway(AppProperties props, RestClient.Builder builder) {
        var cfg = props.payments();
        this.configured = cfg.configured();
        String basic = configured
                ? Base64.getEncoder().encodeToString((cfg.razorpayKeyId() + ":" + cfg.razorpayKeySecret()).getBytes(StandardCharsets.UTF_8))
                : "";
        this.http = builder.baseUrl("https://api.razorpay.com/v1").defaultHeader("Authorization", "Basic " + basic).build();
    }

    /** Returns the new order's id. */
    public String createOrder(int amountPaise, String currency, String receipt, Map<String, String> notes) {
        if (!configured) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Payments aren't set up yet");
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> order = http.post().uri("/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("amount", amountPaise, "currency", currency, "receipt", receipt, "notes", notes))
                    .retrieve()
                    .body(Map.class);
            return String.valueOf(order.get("id"));
        } catch (RestClientException e) {
            log.error("Razorpay order failed ({})", e.getClass().getSimpleName());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Payments are unavailable right now. Try again in a minute");
        }
    }
}
