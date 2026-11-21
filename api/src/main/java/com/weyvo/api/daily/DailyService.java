package com.weyvo.api.daily;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.moderation.ContentFilter;
import com.weyvo.api.push.PushService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * The daily reasons to open Weyvo: "Where in the world?" (one photo from a public issue, four places, one guess),
 * a Wander streak with bonus points, and a question of the day. Each day's quiz and question are chosen once and
 * kept in memory; everyone gets the same ones. No AI: the photo's place is the one its author wrote.
 */
@Service
public class DailyService {

    public static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");
    static final int QUIZ_POINTS = 10;

    public record Quiz(String photoUrl, List<String> options, String myAnswer, Boolean correct, String answer, String tripSlug, Integer percentCorrect) {}

    public record Streak(int days, int nextBonusAt) {}

    public record Answer(String username, String body, String place) {}

    public record Question(String today, String myAnswer, String yesterday, List<Answer> yesterdayAnswers) {}

    public record Today(Quiz quiz, Streak streak, Question question, boolean reminder) {}

    /** One day's quiz: the photo, the right place and the four options in order. */
    private record DayQuiz(LocalDate day, long photoId, String place, String slug, List<String> options) {}

    private static final List<String> FALLBACK_PLACES = List.of("Manali", "Rishikesh", "Udaipur", "Hampi", "Munnar", "Gokarna", "Darjeeling",
            "Pondicherry", "Jaisalmer", "Coorg", "Shillong", "Varanasi", "Leh", "Alleppey", "Ooty", "Mahabaleshwar");

    static final List<String> QUESTIONS = List.of(
            "Best chai you've had on a trip?", "A place that looked better in real life than in photos?",
            "Your favourite train journey?", "The one thing you always pack?", "Best street food city?",
            "A sunrise worth waking up for?", "Hill station or beach this month?", "Most underrated place you've been?",
            "Your dream road trip route?", "Best homestay you've stayed in?", "A trip that changed your plans completely?",
            "Where would you go for a quiet weekend?", "Best monsoon destination?", "A local dish everyone should try?",
            "Favourite trek for beginners?", "The most beautiful drive you've done?", "Where did you see the best stars?",
            "A festival worth travelling for?", "Best place to travel solo?", "Your favourite old town or fort?",
            "Most memorable stranger you met travelling?", "A place you'd go back to tomorrow?", "Best waterfall you've seen?",
            "Favourite cafe on a trip?", "Cheapest great trip you've taken?", "Where did you get completely lost (happily)?",
            "Best place for a first trip with friends?", "A view that made you stop talking?", "Favourite island or lake?",
            "One travel mistake you won't repeat?", "Best market for shopping on a trip?", "Where would you take your parents?",
            "Mountains in winter or summer?", "Best overnight bus or train route?", "A temple, church or mosque that amazed you?",
            "Your perfect day trip from your city?", "Best place for wildlife?", "A small town you loved?",
            "What's next on your travel list?", "Best photo spot you know?");

    private final NamedParameterJdbcTemplate jdbc;
    private final ContentFilter filter;
    private final PushService push;
    private volatile DayQuiz quiz;
    /** Guesses so far today, for "62% got it", kept in memory and recounted after a restart. */
    private final Map<LocalDate, int[]> tally = new ConcurrentHashMap<>();
    /** When there was nothing to pick from, don't look again until this time (ms). */
    private volatile long noQuizUntil;

    public DailyService(NamedParameterJdbcTemplate jdbc, ContentFilter filter, PushService push) {
        this.jdbc = jdbc;
        this.filter = filter;
        this.push = push;
    }

    public static LocalDate today() {
        return LocalDate.now(INDIA);
    }

    // ---- the Today card ----

    public Today today(Long me) {
        LocalDate day = today();
        DayQuiz q = quiz(day);
        Quiz quizView = null;
        if (q != null) {
            var mine = me == null ? null : jdbc.query("SELECT answer, correct FROM daily_guesses WHERE user_id = :u AND day = :d",
                    new MapSqlParameterSource().addValue("u", me).addValue("d", day), (rs, i) -> new Object[] {rs.getString(1), rs.getBoolean(2)})
                    .stream().findFirst().orElse(null);
            boolean answered = mine != null;
            quizView = new Quiz("/api/photos/" + q.photoId() + "/large", q.options(),
                    answered ? (String) mine[0] : null, answered ? (Boolean) mine[1] : null,
                    answered ? q.place() : null, answered ? q.slug() : null, answered ? percent(day) : null);
        }
        Streak streak = me == null ? new Streak(0, 7) : streak(me, day);
        String myAnswer = me == null ? null : jdbc.query("SELECT body FROM daily_answers WHERE user_id = :u AND day = :d",
                new MapSqlParameterSource().addValue("u", me).addValue("d", day), (rs, i) -> rs.getString(1)).stream().findFirst().orElse(null);
        LocalDate yesterday = day.minusDays(1);
        List<Answer> answers = jdbc.query("""
                SELECT u.username, a.body, a.place FROM daily_answers a JOIN users u ON u.id = a.user_id AND u.status = 'ACTIVE'
                WHERE a.day = :d ORDER BY md5(a.user_id::text || a.day::text) LIMIT 5""",
                new MapSqlParameterSource("d", yesterday), (rs, i) -> new Answer(rs.getString(1), rs.getString(2), rs.getString(3)));
        boolean reminder = me != null && Boolean.TRUE.equals(jdbc.queryForObject("SELECT daily_reminder FROM users WHERE id = :u",
                new MapSqlParameterSource("u", me), Boolean.class));
        return new Today(quizView, streak, new Question(question(day), myAnswer, question(yesterday), answers), reminder);
    }

    // ---- quiz ----

    public Quiz guess(long me, String option) {
        LocalDate day = today();
        DayQuiz q = quiz(day);
        if (q == null) throw ApiException.notFound();
        if (option == null || q.options().stream().noneMatch(o -> o.equals(option))) throw ApiException.badRequest("Pick one of the four places");
        boolean correct = q.place().equals(option);
        try {
            jdbc.update("INSERT INTO daily_guesses (user_id, day, answer, correct) VALUES (:u, :d, :a, :c)",
                    new MapSqlParameterSource().addValue("u", me).addValue("d", day).addValue("a", option).addValue("c", correct));
        } catch (DuplicateKeyException e) {
            throw ApiException.badRequest("You've already played today. Come back tomorrow");
        }
        int[] t = tally(day);
        synchronized (t) { t[0]++; if (correct) t[1]++; }
        return new Quiz("/api/photos/" + q.photoId() + "/large", q.options(), option, correct, q.place(), q.slug(), percent(day));
    }

    private int percent(LocalDate day) {
        int[] t = tally(day);
        synchronized (t) { return t[0] == 0 ? 0 : Math.round(100f * t[1] / t[0]); }
    }

    private int[] tally(LocalDate day) {
        return tally.computeIfAbsent(day, d -> {
            var row = jdbc.queryForMap("SELECT count(*) AS n, count(*) FILTER (WHERE correct) AS ok FROM daily_guesses WHERE day = :d", new MapSqlParameterSource("d", d));
            return new int[] {((Number) row.get("n")).intValue(), ((Number) row.get("ok")).intValue()};
        });
    }

    /** The day's quiz, chosen once: a cover or place photo from a public issue, its place, and three other places. */
    DayQuiz quiz(LocalDate day) {
        DayQuiz q = quiz;
        if (q != null && q.day().equals(day)) return q;
        if (System.currentTimeMillis() < noQuizUntil) return null;
        List<Object[]> photos = jdbc.query("""
                SELECT p.id, t.slug, COALESCE(s.place, t.place) AS place
                FROM trip_photos p JOIN trips t ON t.id = p.trip_id
                LEFT JOIN trip_stops s ON p.role = 'STOP' AND s.trip_id = t.id AND s.position = p.position / 3
                WHERE t.kind = 'FULL' AND t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL
                  AND (p.role = 'COVER' OR (p.role = 'STOP' AND p.position < 3))
                ORDER BY p.id""", new MapSqlParameterSource(), (rs, i) -> new Object[] {rs.getLong(1), rs.getString(2), shortName(rs.getString(3))});
        if (photos.isEmpty()) {
            noQuizUntil = System.currentTimeMillis() + 600_000;
            return null;
        }
        Random random = new Random(day.toEpochDay() * 7919L);
        Object[] pick = photos.get(random.nextInt(photos.size()));
        String answer = (String) pick[2];
        Set<String> pool = new LinkedHashSet<>();
        jdbc.queryForList("SELECT DISTINCT split_part(name, ',', 1) FROM places WHERE found AND name IS NOT NULL", new MapSqlParameterSource(), String.class)
                .forEach(n -> pool.add(shortName(n)));
        photos.forEach(p -> pool.add((String) p[2]));
        pool.addAll(FALLBACK_PLACES);
        pool.removeIf(n -> n.isBlank() || n.equalsIgnoreCase(answer));
        List<String> others = new ArrayList<>(pool);
        Collections.shuffle(others, random);
        List<String> options = new ArrayList<>(others.subList(0, Math.min(3, others.size())));
        options.add(answer);
        Collections.shuffle(options, random);
        q = new DayQuiz(day, (Long) pick[0], answer, (String) pick[1], List.copyOf(options));
        quiz = q;
        return q;
    }

    /** Forgets today's pick, so the next request chooses again (used by tests). */
    void forgetQuiz() {
        quiz = null;
        noQuizUntil = 0;
    }

    /** "Candolim, North Goa, Goa" → "Candolim". */
    static String shortName(String place) {
        if (place == null) return "";
        String s = place.split(",")[0].strip();
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    // ---- streak ----

    /** Days in a row with Weyvo opened, ending today. Reaching 7 or 30 adds bonus Wey points once. */
    Streak streak(long me, LocalDate day) {
        List<LocalDate> days = jdbc.queryForList("SELECT day FROM user_activity_days WHERE user_id = :u AND day <= :d ORDER BY day DESC LIMIT 400",
                new MapSqlParameterSource().addValue("u", me).addValue("d", day), LocalDate.class);
        int n = 0;
        LocalDate expect = days.isEmpty() || !days.get(0).equals(day) ? day.minusDays(1) : day;
        for (LocalDate d : days) {
            if (!d.equals(expect)) break;
            n++;
            expect = expect.minusDays(1);
        }
        if (n == 7 || n == 30) {
            jdbc.update("INSERT INTO daily_bonuses (user_id, day, kind, points) VALUES (:u, :d, :k, :p) ON CONFLICT DO NOTHING",
                    new MapSqlParameterSource().addValue("u", me).addValue("d", day).addValue("k", "STREAK_" + n).addValue("p", n == 7 ? 20 : 50));
        }
        return new Streak(n, n < 7 ? 7 : n < 30 ? 30 : ((n / 30) + 1) * 30);
    }

    // ---- question of the day ----

    static String question(LocalDate day) {
        return QUESTIONS.get((int) Math.floorMod(day.toEpochDay(), QUESTIONS.size()));
    }

    public void answer(long me, String body, String place) {
        String text = body == null ? "" : body.strip();
        String where = place == null || place.isBlank() ? null : place.strip();
        if (text.isEmpty()) throw ApiException.badRequest("Write your answer first");
        if (text.length() > 140) throw ApiException.badRequest("Keep it to 140 characters");
        if (where != null && where.length() > 120) throw ApiException.badRequest("Keep the place short");
        if (filter.check(text, where == null ? "" : where).isPresent()) {
            throw ApiException.badRequest("Please keep it about travel, without links, phone numbers or rude words");
        }
        try {
            jdbc.update("INSERT INTO daily_answers (user_id, day, body, place) VALUES (:u, :d, :b, :p)",
                    new MapSqlParameterSource().addValue("u", me).addValue("d", today()).addValue("b", text).addValue("p", where));
        } catch (DuplicateKeyException e) {
            throw ApiException.badRequest("You've already answered today's question");
        }
    }

    // ---- reminder ----

    public void reminder(long me, boolean on) {
        jdbc.update("UPDATE users SET daily_reminder = :on WHERE id = :u", new MapSqlParameterSource().addValue("on", on).addValue("u", me));
    }

    /** 9 am India time: a nudge for people who asked for one. Sent spread out so the server stays smooth. */
    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Kolkata")
    public void remind() {
        List<Long> users = jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u JOIN push_subscriptions s ON s.user_id = u.id
                WHERE u.daily_reminder AND u.status = 'ACTIVE'""", new MapSqlParameterSource(), Long.class);
        for (long id : users) push.sendLater(id, new PushService.Message("Today's mystery place is up 🌍", "Guess where it is and keep your streak going", "/discover"));
    }

    /** Answers older than a month aren't shown anywhere, so they go. Guesses stay: right ones count in Wey points. */
    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Kolkata")
    public void tidy() {
        tally.keySet().removeIf(d -> d.isBefore(today()));
        jdbc.update("DELETE FROM daily_answers WHERE day < :d", new MapSqlParameterSource("d", today().minusDays(30)));
    }
}
