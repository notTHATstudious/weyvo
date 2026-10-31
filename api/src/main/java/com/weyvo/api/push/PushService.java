package com.weyvo.api.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import io.jsonwebtoken.Jwts;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Sends Weyvo notifications to the phones and browsers people turned them on for. Messages are encrypted
 * for each device and only ever go to the big browser push services. Sending happens after the database
 * change commits, on a background thread, so it never slows or breaks the action that caused it.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    /** Push services of Chrome/Android, Firefox, Safari/iPhone and Edge. Nothing else is ever contacted. */
    private static final List<String> PUSH_HOSTS = List.of("fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com");

    public record Message(String title, String body, String url) {}

    private record Keys(ECPublicKey publicKey, ECPrivateKey privateKey, String publicB64) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;
    private final String contact;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ExecutorService sender = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "web-push");
        t.setDaemon(true);
        return t;
    });
    private volatile Keys keys;

    public PushService(NamedParameterJdbcTemplate jdbc, ObjectMapper json, AppProperties props) {
        this.jdbc = jdbc;
        this.json = json;
        this.contact = props.mail().appUrl().replaceAll("/+$", "");
    }

    /** The public half of the server's push key, which browsers need to subscribe. */
    public String publicKey() {
        return keys().publicB64();
    }

    @Transactional
    public void subscribe(long userId, String endpoint, String p256dh, String auth) {
        if (!allowed(endpoint)) throw ApiException.badRequest("This browser's push service isn't supported");
        try {
            if (WebPush.unb64(auth).length != 16) throw new IllegalArgumentException();
            WebPush.publicKey(WebPush.unb64(p256dh));
        } catch (RuntimeException | GeneralSecurityException e) {
            throw ApiException.badRequest("That notification subscription isn't valid");
        }
        // One device belongs to one account: signing in as someone else on it moves the subscription.
        // At most 10 devices per account; the oldest goes first.
        jdbc.update("""
                DELETE FROM push_subscriptions WHERE id IN (
                  SELECT id FROM push_subscriptions WHERE user_id = :u AND endpoint <> :e ORDER BY created_at DESC OFFSET 9)""",
                new MapSqlParameterSource().addValue("u", userId).addValue("e", endpoint));
        jdbc.update("""
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (:u, :e, :p, :a)
                ON CONFLICT (endpoint) DO UPDATE SET user_id = :u, p256dh = :p, auth = :a""",
                new MapSqlParameterSource().addValue("u", userId).addValue("e", endpoint).addValue("p", p256dh).addValue("a", auth));
    }

    @Transactional
    public void unsubscribe(long userId, String endpoint) {
        jdbc.update("DELETE FROM push_subscriptions WHERE user_id = :u AND endpoint = :e",
                new MapSqlParameterSource().addValue("u", userId).addValue("e", endpoint));
    }

    /** Queues a message for every device of this person, sent once the current transaction commits. */
    public void sendLater(long userId, Message message) {
        Runnable send = () -> sender.execute(() -> sendNow(userId, message));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    void sendNow(long userId, Message message) {
        List<Map<String, Object>> subs = jdbc.queryForList("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = :u",
                new MapSqlParameterSource("u", userId));
        if (subs.isEmpty()) return;
        byte[] payload;
        try {
            payload = json.writeValueAsBytes(message);
        } catch (Exception e) {
            return;
        }
        for (Map<String, Object> s : subs) {
            String endpoint = (String) s.get("endpoint");
            if (!allowed(endpoint)) continue;
            try {
                byte[] body = WebPush.encrypt(payload, WebPush.unb64((String) s.get("p256dh")), WebPush.unb64((String) s.get("auth")));
                HttpRequest req = HttpRequest.newBuilder(URI.create(endpoint))
                        .timeout(Duration.ofSeconds(15))
                        .header("Content-Encoding", "aes128gcm")
                        .header("Content-Type", "application/octet-stream")
                        .header("TTL", "86400")
                        .header("Urgency", "normal")
                        .header("Authorization", "vapid t=" + vapidToken(endpoint) + ", k=" + keys().publicB64())
                        .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                        .build();
                int status = http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
                // Gone or unknown: the person turned notifications off or the device is gone.
                if (status == 404 || status == 410) {
                    jdbc.update("DELETE FROM push_subscriptions WHERE id = :id", new MapSqlParameterSource("id", s.get("id")));
                } else if (status >= 400) {
                    log.warn("Push refused: status={} host={}", status, URI.create(endpoint).getHost());
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.warn("Push failed: {} host={}", e.getClass().getSimpleName(), URI.create(endpoint).getHost());
            }
        }
    }

    /** Short-lived signed token proving the message comes from this server (VAPID, RFC 8292). */
    private String vapidToken(String endpoint) {
        URI uri = URI.create(endpoint);
        return Jwts.builder()
                .header().add("typ", "JWT").and()
                .audience().single(uri.getScheme() + "://" + uri.getHost())
                .expiration(Date.from(Instant.now().plus(Duration.ofHours(12))))
                .subject(contact.startsWith("https://") ? contact : "mailto:hello@weyvo.in")
                .signWith(keys().privateKey(), Jwts.SIG.ES256)
                .compact();
    }

    static boolean allowed(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            String host = uri.getHost();
            return "https".equals(uri.getScheme()) && host != null && endpoint.length() <= 1000
                    && PUSH_HOSTS.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Loads the server's push key, making and storing one the first time. */
    private Keys keys() {
        Keys k = keys;
        if (k != null) return k;
        synchronized (this) {
            if (keys != null) return keys;
            try {
                var rows = jdbc.queryForList("SELECT public_key, private_key FROM push_keys WHERE id = 1", new MapSqlParameterSource());
                if (rows.isEmpty()) {
                    KeyPair pair = WebPush.newKeyPair();
                    jdbc.update("INSERT INTO push_keys (id, public_key, private_key) VALUES (1, :pub, :priv) ON CONFLICT (id) DO NOTHING",
                            new MapSqlParameterSource()
                                    .addValue("pub", WebPush.b64(WebPush.raw((ECPublicKey) pair.getPublic())))
                                    .addValue("priv", WebPush.b64(WebPush.raw((ECPrivateKey) pair.getPrivate()))));
                    rows = jdbc.queryForList("SELECT public_key, private_key FROM push_keys WHERE id = 1", new MapSqlParameterSource());
                }
                String pub = (String) rows.get(0).get("public_key");
                byte[] pubRaw = WebPush.unb64(pub);
                keys = new Keys(WebPush.publicKey(pubRaw), WebPush.privateKey(WebPush.unb64((String) rows.get(0).get("private_key"))), pub);
                return keys;
            } catch (GeneralSecurityException e) {
                throw new IllegalStateException("Push keys unavailable", e);
            }
        }
    }
}
