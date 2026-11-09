package com.weyvo.api.chat;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BiConsumer;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Live chat delivery and presence, both in memory.
 * <ul>
 *   <li>Delivery: one Server-Sent Events stream per open Chat screen.</li>
 *   <li>Presence ("who is in which chat") comes from the screen itself: it says "here" every 15 seconds and
 *       "left" when you go back, switch app or lock the phone. A stream can look alive behind a proxy long after
 *       the screen has gone, so it's never used for this. Without a "here" for 35 seconds you count as gone.</li>
 * </ul>
 */
@Component
public class ChatHub {

    static final int MAX_STREAMS = 1_000;
    static final int MAX_PER_PERSON = 3;
    static final Duration PRESENCE = Duration.ofSeconds(35);

    private record Listener(SseEmitter emitter, long userId) {}

    private record Seat(long userId, long chatId) {}

    private final List<Listener> listeners = new CopyOnWriteArrayList<>();
    /** A counter per chat that goes up whenever anything in it changes, so a screen can ask cheaply. */
    private final Map<Long, java.util.concurrent.atomic.AtomicLong> versions = new ConcurrentHashMap<>();
    /** People confirmed as members of a chat (when they opened it), so the cheap check needs no database. */
    private final Map<Seat, Boolean> members = new ConcurrentHashMap<>();
    /** Who is in which chat, and when they last said so. */
    private final Map<Seat, Long> here = new ConcurrentHashMap<>();
    /** Called with (userId, chatId) when someone leaves a chat. */
    private volatile BiConsumer<Long, Long> onLeave = (u, c) -> {};

    void onLeave(BiConsumer<Long, Long> callback) {
        this.onLeave = callback;
    }

    // ---- change counter ----

    public void bump(long chatId) {
        versions.computeIfAbsent(chatId, k -> new java.util.concurrent.atomic.AtomicLong()).incrementAndGet();
    }

    public long version(long chatId) {
        var v = versions.get(chatId);
        return v == null ? 0 : v.get();
    }

    void member(long userId, long chatId) {
        members.put(new Seat(userId, chatId), Boolean.TRUE);
    }

    public boolean isMember(long userId, long chatId) {
        return members.containsKey(new Seat(userId, chatId));
    }

    /** A chat that ended or was blocked: nobody may check it any more. */
    void forgetChat(long chatId) {
        members.keySet().removeIf(s -> s.chatId() == chatId);
        here.keySet().removeIf(s -> s.chatId() == chatId);
        versions.remove(chatId);
    }

    // ---- presence ----

    public void here(long userId, long chatId) {
        here.put(new Seat(userId, chatId), System.currentTimeMillis());
    }

    public void left(long userId, long chatId) {
        if (here.remove(new Seat(userId, chatId)) != null) onLeave.accept(userId, chatId);
    }

    public boolean isOpen(long userId, long chatId) {
        Long at = here.get(new Seat(userId, chatId));
        return at != null && at > System.currentTimeMillis() - PRESENCE.toMillis();
    }

    /** Anyone who stopped saying "here" (closed the app, lost signal) has left. */
    @Scheduled(fixedDelay = 10_000, initialDelay = 10_000)
    public void expire() {
        long cutoff = System.currentTimeMillis() - PRESENCE.toMillis();
        here.forEach((seat, at) -> {
            if (at < cutoff && here.remove(seat, at)) onLeave.accept(seat.userId(), seat.chatId());
        });
    }

    // ---- delivery ----

    /** A live stream, or null when too many are open (the screen then checks every few seconds). */
    public SseEmitter listen(long userId) {
        if (listeners.size() >= MAX_STREAMS || listeners.stream().filter(l -> l.userId() == userId).count() >= MAX_PER_PERSON) {
            // Drop this person's oldest stream rather than refuse: an old one is likely a screen that's gone.
            listeners.stream().filter(l -> l.userId() == userId).findFirst().ifPresent(this::close);
            if (listeners.size() >= MAX_STREAMS) return null;
        }
        SseEmitter emitter = new SseEmitter(Duration.ofMinutes(15).toMillis());
        Listener l = new Listener(emitter, userId);
        listeners.add(l);
        Runnable drop = () -> listeners.remove(l);
        emitter.onCompletion(drop);
        emitter.onTimeout(drop);
        emitter.onError(e -> drop.run());
        // Some proxies hold small streams back; a little padding up front, then "hello", lets the screen see
        // straight away whether live delivery works or it should check every few seconds instead.
        try {
            emitter.send(SseEmitter.event().comment(" ".repeat(2048)));
            emitter.send(SseEmitter.event().name("hello").data(0, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            close(l);
            return null;
        }
        return emitter;
    }

    public boolean isOnline(long userId) {
        return listeners.stream().anyMatch(l -> l.userId() == userId);
    }

    /** Sends an event to every open screen of this person. */
    public void send(long userId, String event, Object data) {
        for (Listener l : listeners) if (l.userId() == userId) emit(l, event, data);
    }

    @Scheduled(fixedDelay = 25_000, initialDelay = 25_000)
    public void heartbeat() {
        for (Listener l : listeners) emit(l, "ping", 0);
    }

    private void emit(Listener l, String event, Object data) {
        try {
            l.emitter().send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            close(l);
        }
    }

    private void close(Listener l) {
        listeners.remove(l);
        try { l.emitter().complete(); } catch (RuntimeException ignored) { /* already closed */ }
    }
}
