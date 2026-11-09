package com.weyvo.api.chat;

import com.weyvo.api.moderation.ContentFilter;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Checks a private chat message before it's stored: text and emoji only, no links, phone numbers, abuse or
 * sexual words, and no flooding. Any topic is fine. Plain rules, no AI; speed limits are counted in memory.
 */
@Component
public class ChatFilter {

    static final int MAX_LENGTH = 500;
    static final int PER_MINUTE = 60;

    private static final Pattern CONTROL = Pattern.compile("[\\p{Cc}&&[^\\n]]");
    private static final Pattern REPEATS = Pattern.compile("(.)\\1{14,}");

    private final ContentFilter words;
    private final Map<Long, Deque<Long>> sends = new ConcurrentHashMap<>();

    public ChatFilter(ContentFilter words) {
        this.words = words;
    }

    /** The cleaned text, or throws ChatRejected with a plain reason. */
    public String check(long userId, String raw) {
        String text = raw == null ? "" : CONTROL.matcher(raw).replaceAll("").strip();
        if (text.isEmpty()) throw new ChatRejected("Write something first");
        if (text.length() > MAX_LENGTH) throw new ChatRejected("Keep it under " + MAX_LENGTH + " characters");
        var reason = words.check(text);
        if (reason.isPresent()) {
            switch (reason.get()) {
                case PROMOTION -> throw new ChatRejected("Links and phone numbers can't be sent in chat");
                case SEXUAL, ABUSE -> throw new ChatRejected("Please keep it friendly");
                case POLITICS -> { /* any topic is fine in a private chat */ }
            }
        }
        if (REPEATS.matcher(text).find()) throw new ChatRejected("That looks like spam");
        flood(userId);
        return text;
    }

    /** One message a second and 60 a minute: normal typing never notices, bots do. */
    private void flood(long userId) {
        long now = System.currentTimeMillis();
        Deque<Long> times = sends.computeIfAbsent(userId, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst() < now - 60_000) times.pollFirst();
            if (!times.isEmpty() && times.peekLast() > now - 1_000) throw new ChatRejected("Slow down a little");
            if (times.size() >= PER_MINUTE) throw new ChatRejected("You're sending a lot. Wait a moment");
            times.addLast(now);
        }
    }

    @Scheduled(fixedDelay = 600_000)
    public void forgetIdle() {
        long cutoff = System.currentTimeMillis() - 60_000;
        sends.entrySet().removeIf(e -> { synchronized (e.getValue()) { return e.getValue().isEmpty() || e.getValue().peekLast() < cutoff; } });
    }

    /** A message that wasn't accepted, with the reason to show the sender. */
    public static class ChatRejected extends RuntimeException {
        public ChatRejected(String message) { super(message, null, false, false); }
    }
}
