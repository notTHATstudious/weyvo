package com.weyvo.api.moderation;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * A plain word-and-pattern check for things that don't belong on a travel magazine: sexual content, abuse,
 * party politics, and selling (phone numbers, links, "DM for price"). It never rejects anything; a match only
 * means an admin looks before the post goes public. Lists are kept short and specific so ordinary travel
 * writing ("sexy sunset", "Modi stadium", "check the link on the gate") isn't caught by accident.
 */
@Component
public class ContentFilter {

    public enum Reason { SEXUAL, ABUSE, POLITICS, PROMOTION }

    private record Rule(Reason reason, Pattern pattern) {}

    private static Pattern words(String... list) {
        return Pattern.compile("\\b(" + String.join("|", list) + ")\\b");
    }

    private static final List<Rule> RULES = List.of(
            new Rule(Reason.SEXUAL, words(
                    "porn\\w*", "xxx", "nudes?", "naked pics?", "onlyfans", "escorts? service", "call ?girls?", "hook ?ups?",
                    "horny", "boobs?", "tits", "dick pics?", "pussy", "blow ?jobs?", "sex chat", "sex video", "sexting",
                    "chut", "rand(i|ee)khana")),
            new Rule(Reason.ABUSE, words(
                    "fuck\\w*", "fck\\w*", "fuk\\w*", "phuck\\w*", "motherfucker\\w*", "bitch\\w*", "bastards?", "sluts?", "whores?", "cunts?", "retards?",
                    "madarchod", "maderchod", "behenchod", "bhenchod", "chutiya\\w*", "bhosd\\w*", "gaand\\w*", "harami", "kamina")),
            new Rule(Reason.POLITICS, words(
                    "vote for", "voting for", "election campaign", "bjp", "aam aadmi party", "shiv sena", "trinamool", "tmc party",
                    "congress party", "rss", "hindutva", "khalistan\\w*", "jihad\\w*", "anti[- ]national", "political party",
                    "godi media", "andh ?bhakts?", "bhakts")),
            new Rule(Reason.PROMOTION, words(
                    "dm (me )?for (price|prices|rates?|details|booking|orders?)", "dm to (buy|order|book)", "whats ?app (me|us|now|on)",
                    "call now", "buy now", "order now", "shop now", "promo ?codes?", "coupon ?codes?", "use code",
                    "\\d{1,2} ?% ?off", "flat \\d+ ?off", "link in (my )?bio", "telegram", "earn money", "work from home",
                    "crypto\\w*", "bitcoin", "forex", "betting", "casino", "follow for follow", "f4f", "sub4sub")));

    /** Phone numbers (Indian mobiles and most international formats). */
    private static final Pattern PHONE = Pattern.compile("(\\+?\\d[\\d\\s-]{8,}\\d)");
    /** Links: http(s) or www., or a bare shop-style domain. "Booked on Booking.com" is fine. */
    private static final Pattern LINK = Pattern.compile(
            "(https?://|www\\.)\\S+|\\b[a-z0-9-]{2,}\\.(shop|store|xyz|link|ly|site|online|biz)\\b(/\\S*)?");

    /** The first reason any of the texts needs a look, or empty when everything is fine. */
    public Optional<Reason> check(List<String> texts) {
        for (String raw : texts) {
            if (raw == null || raw.isBlank()) continue;
            // Checked as typed (so "20% off" keeps its digits) and with disguises undone (so "s3x" reads "sex").
            String plain = raw.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
            String text = normalise(raw);
            for (Rule r : RULES) {
                if (r.pattern().matcher(plain).find() || r.pattern().matcher(text).find()) return Optional.of(r.reason());
            }
            if (LINK.matcher(plain).find()) return Optional.of(Reason.PROMOTION);
            var phone = PHONE.matcher(raw);
            while (phone.find()) {
                // Ten or more digits is a phone number; years, dates and distances are shorter.
                if (phone.group().replaceAll("\\D", "").length() >= 10) return Optional.of(Reason.PROMOTION);
            }
        }
        return Optional.empty();
    }

    public Optional<Reason> check(String... texts) {
        return check(List.of(texts).stream().map(t -> t == null ? "" : t).toList());
    }

    /** Lower case, accents off, and the usual disguises undone: f*ck, s3x, p.o.r.n. */
    static String normalise(String s) {
        String t = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        t = t.replace('0', 'o').replace('1', 'i').replace('3', 'e').replace('4', 'a').replace('5', 's').replace('@', 'a').replace('$', 's');
        t = t.replaceAll("(?<=\\p{L})[*._](?=\\p{L})", "");
        return t.replaceAll("\\s+", " ");
    }
}
