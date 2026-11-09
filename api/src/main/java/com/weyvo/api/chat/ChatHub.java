package com.weyvo.api.chat;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BiConsumer;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Live delivery for chat over Server-Sent Events: one stream per open Chat screen, kept in memory. It also knows
 * who has which chat open, which decides when read messages vanish.
 */
@Component
public class ChatHub {

    static final int MAX_STREAMS = 1_000;
    static final int MAX_PER_PERSON = 3;

    /** One open Chat screen; openChat is the conversation on screen, or null for the inbox. */
    private record Listener(SseEmitter emitter, long userId, Long openChat) {}

    private final List<Listener> listeners = new CopyOnWriteArrayList<>();
    /** Called with (userId, chatId) when someone's last screen showing that chat closes. */
    private volatile BiConsumer<Long, Long> onLeave = (u, c) -> {};

    void onLeave(BiConsumer<Long, Long> callback) {
        this.onLeave = callback;
    }

    /** A live stream, or null when too many are open (the screen then checks every few seconds). */
    public SseEmitter listen(long userId, Long openChat) {
        if (listeners.size() >= MAX_STREAMS || listeners.stream().filter(l -> l.userId() == userId).count() >= MAX_PER_PERSON) return null;
        SseEmitter emitter = new SseEmitter(Duration.ofMinutes(15).toMillis());
        Listener l = new Listener(emitter, userId, openChat);
        listeners.add(l);
        Runnable drop = () -> forget(l);
        emitter.onCompletion(drop);
        emitter.onTimeout(drop);
        emitter.onError(e -> drop.run());
        return emitter;
    }

    public boolean isOpen(long userId, long chatId) {
        return listeners.stream().anyMatch(l -> l.userId() == userId && l.openChat() != null && l.openChat() == chatId);
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
            forget(l);
            try { l.emitter().complete(); } catch (RuntimeException ignored) { /* already closed */ }
        }
    }

    private void forget(Listener l) {
        if (!listeners.remove(l) || l.openChat() == null) return;
        if (!isOpen(l.userId(), l.openChat())) onLeave.accept(l.userId(), l.openChat());
    }
}
