package com.weyvo.api.mail;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Email through Resend. With no API key configured (local development) nothing is sent and only the
 * subject is logged: never the address or the message, which may contain a one-time code.
 */
@Component
public class ResendMailer implements Mailer {

    private static final Logger log = LoggerFactory.getLogger(ResendMailer.class);

    private final RestClient http;
    private final String from;
    private final String site;
    private final boolean enabled;

    public ResendMailer(AppProperties props, RestClient.Builder builder) {
        var cfg = props.mail();
        this.from = cfg.from();
        this.site = cfg.appUrl().replaceAll("/+$", "");
        this.enabled = cfg.resendApiKey() != null && !cfg.resendApiKey().isBlank();
        this.http = builder.baseUrl("https://api.resend.com")
                .defaultHeader("Authorization", "Bearer " + (enabled ? cfg.resendApiKey() : ""))
                .build();
    }

    @Override
    public void send(String to, String subject, String text, String html) {
        String safeSubject = redact(subject);
        if (!enabled) {
            log.warn("Email not sent (RESEND_API_KEY not set): {}", safeSubject);
            return;
        }
        try {
            http.post().uri("/emails")
                    .contentType(MediaType.APPLICATION_JSON)
                    // Templates point images at {{site}}: the web address emails link back to.
                    .body(Map.of("from", from, "to", List.of(to), "subject", subject, "text", text, "html", html.replace("{{site}}", site)))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Email sent: {}", safeSubject);
        } catch (RestClientException e) {
            log.error("Email failed: {} ({})", safeSubject, e.getClass().getSimpleName());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "We couldn't send the email right now. Try again in a minute");
        }
    }

    /** Subjects carry one-time codes; logs must never contain them. */
    static String redact(String subject) {
        return subject.replaceAll("\\d{4,}", "######");
    }
}
