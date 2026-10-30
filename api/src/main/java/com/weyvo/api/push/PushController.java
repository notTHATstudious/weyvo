package com.weyvo.api.push;

import com.weyvo.api.auth.CurrentUser;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PushController {

    public record Subscription(String endpoint, Keys keys) {}
    public record Keys(String p256dh, String auth) {}
    public record Endpoint(String endpoint) {}

    private final PushService push;

    public PushController(PushService push) {
        this.push = push;
    }

    @GetMapping("/api/push/key")
    public Map<String, String> key() {
        return Map.of("publicKey", push.publicKey());
    }

    @PutMapping("/api/me/push")
    public ResponseEntity<Void> subscribe(@AuthenticationPrincipal CurrentUser user, @RequestBody Subscription sub) {
        if (sub == null || sub.endpoint() == null || sub.keys() == null || sub.keys().p256dh() == null || sub.keys().auth() == null) {
            throw com.weyvo.api.common.ApiException.badRequest("That notification subscription isn't valid");
        }
        push.subscribe(user.id(), sub.endpoint(), sub.keys().p256dh(), sub.keys().auth());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/me/push")
    public ResponseEntity<Void> unsubscribe(@AuthenticationPrincipal CurrentUser user, @RequestBody Endpoint body) {
        if (body != null && body.endpoint() != null) push.unsubscribe(user.id(), body.endpoint());
        return ResponseEntity.noContent().build();
    }
}
