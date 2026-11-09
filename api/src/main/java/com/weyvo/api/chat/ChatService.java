package com.weyvo.api.chat;

import com.weyvo.api.chat.ChatFilter.ChatRejected;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.push.PushService;
import com.weyvo.api.user.Avatars;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Private chat: requests (only your followers can ask), messages that vanish once read and both people have left,
 * and the limits that keep it light. A chat is an accepted row in chat_requests.
 */
@Service
public class ChatService {

    public record Person(String username, String displayName, String avatarUrl) {}

    public record Request(long id, Person from, Instant createdAt) {}

    public record ChatSummary(long id, Person with, int unread, Instant lastAt) {}

    public record Inbox(List<Request> requests, List<Person> sent, List<ChatSummary> chats) {}

    public record Message(long id, long chatId, String sender, String body, Instant createdAt, Instant readAt) {}

    /** Between you and someone: NONE, CAN_REQUEST, REQUESTED, INCOMING, CHAT, or NEEDS_FOLLOW. */
    public record Status(String state, Long chatId) {}

    static final int REQUESTS_PER_DAY = 10;
    static final int DECLINE_WAIT_DAYS = 30;
    static final int MAX_CHATS = 100;
    static final int MAX_UNREAD_IN_CHAT = 30;
    static final int MAX_UNREAD_FOR_PERSON = 300;
    private static final int TRANSCRIPT = 20;

    private final NamedParameterJdbcTemplate jdbc;
    private final ChatFilter filter;
    private final ChatHub hub;
    private final PushService push;

    public ChatService(NamedParameterJdbcTemplate jdbc, ChatFilter filter, ChatHub hub, PushService push) {
        this.jdbc = jdbc;
        this.filter = filter;
        this.hub = hub;
        this.push = push;
        hub.onLeave(this::left);
    }

    // ---- inbox and requests ----

    @Transactional(readOnly = true)
    public Inbox inbox(long me) {
        var p = new MapSqlParameterSource("me", me);
        List<Request> requests = jdbc.query("""
                SELECT r.id, r.created_at, u.username, u.display_name, u.avatar_version FROM chat_requests r JOIN users u ON u.id = r.from_id
                WHERE r.to_id = :me AND r.status = 'PENDING' AND u.status = 'ACTIVE' ORDER BY r.created_at DESC""", p,
                (rs, i) -> new Request(rs.getLong("id"), person(rs.getString("username"), rs.getString("display_name"), (Integer) rs.getObject("avatar_version")),
                        rs.getTimestamp("created_at").toInstant()));
        List<Person> sent = jdbc.query("""
                SELECT u.username, u.display_name, u.avatar_version FROM chat_requests r JOIN users u ON u.id = r.to_id
                WHERE r.from_id = :me AND r.status = 'PENDING' ORDER BY r.created_at DESC""", p,
                (rs, i) -> person(rs.getString("username"), rs.getString("display_name"), (Integer) rs.getObject("avatar_version")));
        List<ChatSummary> chats = jdbc.query("""
                SELECT r.id, u.username, u.display_name, u.avatar_version,
                       (SELECT count(*) FROM chat_messages m WHERE m.chat_id = r.id AND m.sender_id <> :me AND m.read_at IS NULL) AS unread,
                       COALESCE((SELECT max(m.created_at) FROM chat_messages m WHERE m.chat_id = r.id), r.decided_at) AS last_at
                FROM chat_requests r JOIN users u ON u.id = CASE WHEN r.from_id = :me THEN r.to_id ELSE r.from_id END
                WHERE (r.from_id = :me OR r.to_id = :me) AND r.status = 'ACCEPTED' AND u.status = 'ACTIVE'
                ORDER BY last_at DESC NULLS LAST""", p,
                (rs, i) -> new ChatSummary(rs.getLong("id"), person(rs.getString("username"), rs.getString("display_name"), (Integer) rs.getObject("avatar_version")),
                        rs.getInt("unread"), rs.getTimestamp("last_at") == null ? null : rs.getTimestamp("last_at").toInstant()));
        return new Inbox(requests, sent, chats);
    }

    /** What the Message button on someone's profile should do. */
    @Transactional(readOnly = true)
    public Status status(long me, String username) {
        long them = userId(username);
        if (them == me) return new Status("NONE", null);
        if (blocked(me, them)) return new Status("NONE", null);
        var row = pair(me, them);
        if (row != null) {
            switch (row.status()) {
                case "ACCEPTED": return new Status("CHAT", row.id());
                case "PENDING": return new Status(row.fromId() == me ? "REQUESTED" : "INCOMING", row.id());
                default: break;
            }
        }
        return new Status(follows(me, them) ? "CAN_REQUEST" : "NEEDS_FOLLOW", null);
    }

    @Transactional
    public Status request(long me, String username) {
        long them = userId(username);
        if (them == me) throw ApiException.badRequest("You can't message yourself");
        if (blocked(me, them)) throw ApiException.notFound();
        if (!follows(me, them)) throw ApiException.badRequest("Follow them first. Only followers can send a chat request");
        var row = pair(me, them);
        if (row != null && row.status().equals("ACCEPTED")) return new Status("CHAT", row.id());
        if (row != null && row.status().equals("PENDING")) {
            // They already asked you: asking back simply accepts.
            if (row.fromId() == them) return accept(me, row.id());
            return new Status("REQUESTED", row.id());
        }
        if (row != null && row.status().equals("DECLINED") && row.fromId() == me
                && row.decidedAt() != null && row.decidedAt().isAfter(Instant.now().minusSeconds(DECLINE_WAIT_DAYS * 86_400L))) {
            throw ApiException.badRequest("They said no for now. You can ask again after " + DECLINE_WAIT_DAYS + " days");
        }
        Integer today = jdbc.queryForObject("SELECT count(*) FROM chat_requests WHERE from_id = :me AND created_at > now() - interval '1 day'",
                new MapSqlParameterSource("me", me), Integer.class);
        if (today != null && today >= REQUESTS_PER_DAY) throw ApiException.badRequest("You've sent " + REQUESTS_PER_DAY + " chat requests today. Try again tomorrow");
        if (openChats(me) >= MAX_CHATS) throw ApiException.badRequest("You have " + MAX_CHATS + " open chats. End one to start another");
        Long id = jdbc.queryForObject("""
                INSERT INTO chat_requests (from_id, to_id) VALUES (:me, :them)
                ON CONFLICT (LEAST(from_id, to_id), GREATEST(from_id, to_id))
                DO UPDATE SET from_id = :me, to_id = :them, status = 'PENDING', created_at = now(), decided_at = NULL
                RETURNING id""", new MapSqlParameterSource().addValue("me", me).addValue("them", them), Long.class);
        hub.send(them, "request", Map.of("id", id));
        push.sendLater(them, new PushService.Message("New chat request", "Someone wants to chat with you on Weyvo", "/chat"));
        return new Status("REQUESTED", id);
    }

    @Transactional
    public Status accept(long me, long requestId) {
        var row = pending(me, requestId);
        if (openChats(me) >= MAX_CHATS) throw ApiException.badRequest("You have " + MAX_CHATS + " open chats. End one to start another");
        jdbc.update("UPDATE chat_requests SET status = 'ACCEPTED', decided_at = now() WHERE id = :id", new MapSqlParameterSource("id", requestId));
        hub.send(row.fromId(), "accepted", Map.of("id", requestId));
        return new Status("CHAT", requestId);
    }

    @Transactional
    public void decline(long me, long requestId) {
        pending(me, requestId);
        jdbc.update("UPDATE chat_requests SET status = 'DECLINED', decided_at = now() WHERE id = :id", new MapSqlParameterSource("id", requestId));
    }

    /** Ends a chat for both people; everything in it is deleted. */
    @Transactional
    public void end(long me, long chatId) {
        Chat c = chat(me, chatId);
        jdbc.update("DELETE FROM chat_requests WHERE id = :id", new MapSqlParameterSource("id", chatId));
        hub.send(c.other(me), "ended", Map.of("chatId", chatId));
    }

    // ---- messages ----

    /** Opens a chat: everything waiting for you is now read, and the sender is told. */
    @Transactional
    public List<Message> open(long me, long chatId) {
        Chat c = chat(me, chatId);
        markRead(c, me);
        return jdbc.query("SELECT m.id, m.chat_id, u.username, m.body, m.created_at, m.read_at FROM chat_messages m JOIN users u ON u.id = m.sender_id WHERE m.chat_id = :c ORDER BY m.id",
                new MapSqlParameterSource("c", chatId), (rs, i) -> message(rs));
    }

    @Transactional
    public Message send(long me, String myUsername, long chatId, String raw) {
        Chat c = chat(me, chatId);
        long them = c.other(me);
        if (blocked(me, them)) throw ApiException.notFound();
        String text = filter.check(me, raw);
        var p = new MapSqlParameterSource().addValue("c", chatId).addValue("me", me).addValue("them", them);
        Integer waitingHere = jdbc.queryForObject("SELECT count(*) FROM chat_messages WHERE chat_id = :c AND sender_id = :me AND read_at IS NULL", p, Integer.class);
        if (waitingHere != null && waitingHere >= MAX_UNREAD_IN_CHAT) throw new ChatRejected("They have " + MAX_UNREAD_IN_CHAT + " unread messages from you. Wait for them to catch up");
        Integer waitingForThem = jdbc.queryForObject("""
                SELECT count(*) FROM chat_messages m JOIN chat_requests r ON r.id = m.chat_id
                WHERE m.read_at IS NULL AND m.sender_id <> :them AND (r.from_id = :them OR r.to_id = :them)""", p, Integer.class);
        if (waitingForThem != null && waitingForThem >= MAX_UNREAD_FOR_PERSON) throw new ChatRejected("Their inbox is full right now. Try again later");
        boolean seenNow = hub.isOpen(them, chatId);
        var row = jdbc.queryForMap("INSERT INTO chat_messages (chat_id, sender_id, body, read_at) VALUES (:c, :me, :b, CASE WHEN :seen THEN now() END) RETURNING id, created_at, read_at",
                p.addValue("b", text).addValue("seen", seenNow));
        Message m = new Message((Long) row.get("id"), chatId, myUsername, text, ((java.sql.Timestamp) row.get("created_at")).toInstant(),
                row.get("read_at") == null ? null : ((java.sql.Timestamp) row.get("read_at")).toInstant());
        hub.send(them, "message", m);
        if (!hub.isOnline(them)) push.sendLater(them, new PushService.Message("New message", "You have a new message on Weyvo", "/chat/" + chatId));
        return m;
    }

    /** Keeps a copy of the last messages for the admin, since the chat will vanish. */
    @Transactional
    public void report(long me, long chatId) {
        Chat c = chat(me, chatId);
        List<String> lines = new ArrayList<>(jdbc.query("""
                SELECT u.username, m.body FROM chat_messages m JOIN users u ON u.id = m.sender_id
                WHERE m.chat_id = :c ORDER BY m.id DESC LIMIT :n""", new MapSqlParameterSource().addValue("c", chatId).addValue("n", TRANSCRIPT),
                (rs, i) -> rs.getString(1) + ": " + rs.getString(2)));
        java.util.Collections.reverse(lines);
        jdbc.update("INSERT INTO chat_reports (reporter_id, reported_id, transcript) VALUES (:me, :them, :t)",
                new MapSqlParameterSource().addValue("me", me).addValue("them", c.other(me))
                        .addValue("t", lines.isEmpty() ? "(no messages left at the time of the report)" : String.join("\n", lines)));
    }

    // ---- vanishing ----

    /** Someone closed the chat. If the other person isn't in it either, every read message goes. */
    void left(long userId, long chatId) {
        Chat c = jdbc.query("SELECT id, from_id, to_id FROM chat_requests WHERE id = :id AND status = 'ACCEPTED'", new MapSqlParameterSource("id", chatId),
                (rs, i) -> new Chat(rs.getLong(1), rs.getLong(2), rs.getLong(3))).stream().findFirst().orElse(null);
        if (c == null || hub.isOpen(c.other(userId), chatId)) return;
        vanish(c, "chat_id = :c AND read_at IS NOT NULL", new MapSqlParameterSource("c", chatId));
    }

    /**
     * Every 5 minutes: unread messages older than 12 hours, read ones older than 2 hours, and read ones in chats
     * nobody has open (for example after a restart).
     */
    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000)
    public void sweep() {
        jdbc.query("SELECT DISTINCT r.id, r.from_id, r.to_id FROM chat_messages m JOIN chat_requests r ON r.id = m.chat_id", new MapSqlParameterSource(),
                (rs, i) -> new Chat(rs.getLong(1), rs.getLong(2), rs.getLong(3))).forEach(c -> {
            boolean nobodyIn = !hub.isOpen(c.fromId(), c.id()) && !hub.isOpen(c.toId(), c.id());
            vanish(c, """
                    chat_id = :c AND ((read_at IS NULL AND created_at < now() - interval '12 hours')
                                   OR read_at < now() - interval '2 hours'
                                   OR (read_at IS NOT NULL AND :nobodyIn))""",
                    new MapSqlParameterSource().addValue("c", c.id()).addValue("nobodyIn", nobodyIn));
        });
    }

    private void vanish(Chat c, String where, MapSqlParameterSource p) {
        List<Long> ids = jdbc.queryForList("DELETE FROM chat_messages WHERE " + where + " RETURNING id", p, Long.class);
        if (ids.isEmpty()) return;
        Map<String, Object> event = Map.of("chatId", c.id(), "ids", ids);
        hub.send(c.fromId(), "vanished", event);
        hub.send(c.toId(), "vanished", event);
    }

    private void markRead(Chat c, long me) {
        List<Long> ids = jdbc.queryForList("UPDATE chat_messages SET read_at = now() WHERE chat_id = :c AND sender_id <> :me AND read_at IS NULL RETURNING id",
                new MapSqlParameterSource().addValue("c", c.id()).addValue("me", me), Long.class);
        if (!ids.isEmpty()) hub.send(c.other(me), "seen", Map.of("chatId", c.id(), "ids", ids));
    }

    /** Called when a stream opens on a chat: anything that arrived meanwhile is now read. */
    @Transactional
    public void viewing(long me, long chatId) {
        markRead(chat(me, chatId), me);
    }

    // ---- helpers ----

    private record Chat(long id, long fromId, long toId) {
        long other(long me) { return me == fromId ? toId : fromId; }
    }

    private record Pair(long id, long fromId, String status, Instant decidedAt) {}

    private Chat chat(long me, long chatId) {
        return jdbc.query("SELECT id, from_id, to_id FROM chat_requests WHERE id = :id AND status = 'ACCEPTED' AND (from_id = :me OR to_id = :me)",
                new MapSqlParameterSource().addValue("id", chatId).addValue("me", me),
                (rs, i) -> new Chat(rs.getLong(1), rs.getLong(2), rs.getLong(3))).stream().findFirst().orElseThrow(ApiException::notFound);
    }

    private Pair pending(long me, long requestId) {
        return jdbc.query("SELECT id, from_id, status, decided_at FROM chat_requests WHERE id = :id AND to_id = :me AND status = 'PENDING'",
                new MapSqlParameterSource().addValue("id", requestId).addValue("me", me), (rs, i) -> pairRow(rs)).stream().findFirst().orElseThrow(ApiException::notFound);
    }

    private Pair pair(long a, long b) {
        return jdbc.query("SELECT id, from_id, status, decided_at FROM chat_requests WHERE LEAST(from_id, to_id) = LEAST(:a, :b) AND GREATEST(from_id, to_id) = GREATEST(:a, :b)",
                new MapSqlParameterSource().addValue("a", a).addValue("b", b), (rs, i) -> pairRow(rs)).stream().findFirst().orElse(null);
    }

    private static Pair pairRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Pair(rs.getLong("id"), rs.getLong("from_id"), rs.getString("status"),
                rs.getTimestamp("decided_at") == null ? null : rs.getTimestamp("decided_at").toInstant());
    }

    /** Only your followers can send you a request: the sender must follow the receiver. */
    private boolean follows(long sender, long receiver) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM follows WHERE follower_id = :s AND followee_id = :r",
                new MapSqlParameterSource().addValue("s", sender).addValue("r", receiver), Integer.class);
        return n != null && n > 0;
    }

    private boolean blocked(long a, long b) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM user_blocks WHERE (blocker_id = :a AND blocked_id = :b) OR (blocker_id = :b AND blocked_id = :a)",
                new MapSqlParameterSource().addValue("a", a).addValue("b", b), Integer.class);
        return n != null && n > 0;
    }

    private int openChats(long me) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM chat_requests WHERE (from_id = :me OR to_id = :me) AND status = 'ACCEPTED'",
                new MapSqlParameterSource("me", me), Integer.class);
        return n == null ? 0 : n;
    }

    private long userId(String username) {
        return jdbc.query("SELECT id FROM users WHERE lower(username) = lower(:n) AND status = 'ACTIVE'", new MapSqlParameterSource("n", username == null ? "" : username),
                (rs, i) -> rs.getLong(1)).stream().findFirst().orElseThrow(ApiException::notFound);
    }

    private static Person person(String username, String displayName, Integer avatarVersion) {
        return new Person(username, displayName, Avatars.url(username, avatarVersion));
    }

    private static Message message(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Message(rs.getLong("id"), rs.getLong("chat_id"), rs.getString("username"), rs.getString("body"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("read_at") == null ? null : rs.getTimestamp("read_at").toInstant());
    }
}
