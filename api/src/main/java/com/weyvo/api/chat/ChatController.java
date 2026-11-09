package com.weyvo.api.chat;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.chat.ChatFilter.ChatRejected;
import com.weyvo.api.chat.ChatService.Inbox;
import com.weyvo.api.chat.ChatService.Message;
import com.weyvo.api.chat.ChatService.Status;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Private chat. Everything under /api/chats needs a signed-in, verified account. */
@RestController
public class ChatController {

    public record SendBody(String text) {}

    public record RequestBodyIn(String username) {}

    public record ChatReport(long id, String reporter, String reported, String transcript, Instant createdAt) {}

    private final ChatService chats;
    private final ChatHub hub;
    private final NamedParameterJdbcTemplate jdbc;

    public ChatController(ChatService chats, ChatHub hub, NamedParameterJdbcTemplate jdbc) {
        this.chats = chats;
        this.hub = hub;
        this.jdbc = jdbc;
    }

    @GetMapping("/api/chats")
    public Inbox inbox(@AuthenticationPrincipal CurrentUser user) {
        return chats.inbox(user.id());
    }

    @GetMapping("/api/chats/unread")
    public Map<String, Integer> unread(@AuthenticationPrincipal CurrentUser user) {
        return Map.of("count", chats.unread(user.id()));
    }

    @GetMapping("/api/chats/with/{username}")
    public Status status(@AuthenticationPrincipal CurrentUser user, @PathVariable String username) {
        return chats.status(user.id(), username);
    }

    @PostMapping("/api/chats/requests")
    public Status request(@AuthenticationPrincipal CurrentUser user, @RequestBody RequestBodyIn body) {
        return chats.request(user.id(), body == null ? null : body.username());
    }

    @PostMapping("/api/chats/requests/{id}/accept")
    public Status accept(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        return chats.accept(user.id(), id);
    }

    @PostMapping("/api/chats/requests/{id}/decline")
    public ResponseEntity<Void> decline(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        chats.decline(user.id(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/chats/{id}/messages")
    public List<Message> open(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        return chats.open(user.id(), id);
    }

    @PostMapping("/api/chats/{id}/messages")
    public Message send(@AuthenticationPrincipal CurrentUser user, @PathVariable long id, @RequestBody SendBody body) {
        return chats.send(user.id(), user.username(), id, body == null ? null : body.text());
    }

    /** The chat screen is open and visible; sent every 15 seconds. Anything waiting is now read. */
    @PostMapping("/api/chats/{id}/here")
    public ResponseEntity<Void> here(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        chats.viewing(user.id(), id);
        return ResponseEntity.noContent().build();
    }

    /** The chat screen closed (back, app switch, lock). Sent with sendBeacon, so it arrives even as the page goes. */
    @PostMapping("/api/chats/{id}/leave")
    public ResponseEntity<Void> leave(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        hub.left(user.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/chats/{id}/report")
    public ResponseEntity<Void> report(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        chats.report(user.id(), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/chats/{id}")
    public ResponseEntity<Void> end(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        chats.end(user.id(), id);
        return ResponseEntity.noContent().build();
    }

    /** Live events: request, accepted, message, seen, vanished, ended, ping. */
    @GetMapping(value = "/api/chats/stream", produces = "text/event-stream")
    public ResponseEntity<SseEmitter> stream(@AuthenticationPrincipal CurrentUser user) {
        SseEmitter emitter = hub.listen(user.id());
        if (emitter == null) return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        return ResponseEntity.ok().header("X-Accel-Buffering", "no").header("Cache-Control", "no-cache, no-transform").body(emitter);
    }

    // ---- admin: reported chats only (everything under /api/admin needs the admin role) ----

    @GetMapping("/api/admin/chat-reports")
    public List<ChatReport> reports() {
        return jdbc.query("""
                SELECT r.id, a.username AS reporter, b.username AS reported, r.transcript, r.created_at
                FROM chat_reports r JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.reported_id
                WHERE r.reviewed_at IS NULL ORDER BY r.created_at DESC LIMIT 100""", new MapSqlParameterSource(),
                (rs, i) -> new ChatReport(rs.getLong("id"), rs.getString("reporter"), rs.getString("reported"), rs.getString("transcript"),
                        rs.getTimestamp("created_at").toInstant()));
    }

    @PostMapping("/api/admin/chat-reports/{id}/done")
    public ResponseEntity<Void> reviewed(@PathVariable long id) {
        jdbc.update("UPDATE chat_reports SET reviewed_at = now() WHERE id = :id", new MapSqlParameterSource("id", id));
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(ChatRejected.class)
    ResponseEntity<Map<String, String>> rejected(ChatRejected e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}
