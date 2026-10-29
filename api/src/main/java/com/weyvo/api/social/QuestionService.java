package com.weyvo.api.social;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import com.weyvo.api.trip.StoryGate;
import com.weyvo.api.trip.Trip;
import com.weyvo.api.trip.TripRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** "Ask the traveller": public questions on a trip, answered and moderated by its author. */
@Service
public class QuestionService {

    static final int MAX_QUESTION = 300;
    static final int MAX_ANSWER = 500;

    public enum Reason { SPAM, ABUSE, OFF_TOPIC, OTHER }

    public record Asker(String username, String displayName) {}

    /** status is filled in only for the trip's author; everyone else sees visible questions only. */
    public record Question(long id, String body, Asker asker, String answer, Instant answeredAt, Instant createdAt,
                           String status, boolean mine) {}

    /** When locked (signed-out preview), only the count is returned, like the rest of the full story. */
    public record Questions(boolean locked, int count, List<Question> items) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final TripRepository trips;
    private final StoryGate gate;
    private final NotificationService notifications;
    private final AppProperties.Community rules;

    public QuestionService(NamedParameterJdbcTemplate jdbc, TripRepository trips, StoryGate gate,
                           NotificationService notifications, AppProperties props) {
        this.jdbc = jdbc;
        this.trips = trips;
        this.gate = gate;
        this.notifications = notifications;
        this.rules = props.community();
    }

    @Transactional(readOnly = true)
    public Questions list(long tripId, Long viewerId) {
        Trip trip = visibleTrip(tripId, viewerId);
        boolean owner = trip.isOwnedBy(viewerId);
        var params = new MapSqlParameterSource().addValue("t", tripId).addValue("v", viewerId).addValue("owner", owner);
        String filter = "q.trip_id = :t AND (:owner OR q.status = 'VISIBLE')";
        if (gate.locked(trip, viewerId)) {
            Integer n = jdbc.queryForObject("SELECT count(*) FROM trip_questions q WHERE " + filter, params, Integer.class);
            return new Questions(true, n == null ? 0 : n, List.of());
        }
        List<Question> items = jdbc.query("""
                SELECT q.id, q.body, q.answer, q.answered_at, q.created_at, q.status, q.asker_id, u.username, u.display_name
                FROM trip_questions q JOIN users u ON u.id = q.asker_id
                WHERE """ + " " + filter + " ORDER BY q.created_at", params, (rs, i) -> new Question(
                rs.getLong("id"), rs.getString("body"), new Asker(rs.getString("username"), rs.getString("display_name")),
                rs.getString("answer"),
                rs.getTimestamp("answered_at") == null ? null : rs.getTimestamp("answered_at").toInstant(),
                rs.getTimestamp("created_at").toInstant(),
                owner ? rs.getString("status") : null,
                viewerId != null && rs.getLong("asker_id") == viewerId));
        return new Questions(false, items.size(), items);
    }

    @Transactional
    public Question ask(long userId, long tripId, String body) {
        Trip trip = visibleTrip(tripId, userId);
        if (trip.getStatus() != Trip.Status.PUBLISHED) throw ApiException.notFound();
        if (trip.isOwnedBy(userId)) throw ApiException.badRequest("You can't ask a question on your own story");
        String text = clean(body, MAX_QUESTION, "question");
        Integer recent = jdbc.queryForObject("SELECT count(*) FROM trip_questions WHERE asker_id = :u AND created_at > now() - interval '1 hour'",
                new MapSqlParameterSource("u", userId), Integer.class);
        if (recent != null && recent >= rules.questionsPerHour()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "You've asked a lot in the last hour. Try again later");
        }
        Long id = jdbc.queryForObject("INSERT INTO trip_questions (trip_id, asker_id, body) VALUES (:t, :u, :b) RETURNING id",
                new MapSqlParameterSource().addValue("t", tripId).addValue("u", userId).addValue("b", text), Long.class);
        notifications.notify(trip.getOwner().getId(), userId, NotificationService.Type.QUESTION, tripId, id);
        return one(id, userId, false);
    }

    /** The trip's author answers, or edits their answer. */
    @Transactional
    public Question answer(long ownerId, long questionId, String answer) {
        Row q = ownedQuestion(ownerId, questionId);
        String text = clean(answer, MAX_ANSWER, "answer");
        jdbc.update("UPDATE trip_questions SET answer = :a, answered_at = now() WHERE id = :id",
                new MapSqlParameterSource().addValue("a", text).addValue("id", questionId));
        notifications.notify(q.askerId(), ownerId, NotificationService.Type.ANSWER, q.tripId(), questionId);
        return one(questionId, ownerId, true);
    }

    @Transactional
    public Question setHidden(long ownerId, long questionId, boolean hidden) {
        ownedQuestion(ownerId, questionId);
        jdbc.update("UPDATE trip_questions SET status = :s WHERE id = :id",
                new MapSqlParameterSource().addValue("s", hidden ? "HIDDEN_BY_AUTHOR" : "VISIBLE").addValue("id", questionId));
        return one(questionId, ownerId, true);
    }

    /** The asker can remove their own question; the trip's author can remove any on their trip. */
    @Transactional
    public void delete(long userId, long questionId) {
        Row q = row(questionId);
        Trip trip = trips.findById(q.tripId()).orElseThrow(ApiException::notFound);
        if (q.askerId() != userId && !trip.isOwnedBy(userId)) throw ApiException.notFound();
        jdbc.update("DELETE FROM trip_questions WHERE id = :id", new MapSqlParameterSource("id", questionId));
    }

    /** One report per person; enough different reporters hide the question automatically. */
    @Transactional
    public void report(long userId, long questionId, String reason) {
        Row q = row(questionId);
        visibleTrip(q.tripId(), userId);
        if (q.askerId() == userId) throw ApiException.badRequest("You can't report your own question");
        Reason r;
        try {
            r = Reason.valueOf(reason == null ? "OTHER" : reason.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Pick a reason for the report");
        }
        var params = new MapSqlParameterSource().addValue("q", questionId).addValue("u", userId).addValue("r", r.name())
                .addValue("n", rules.reportsToHide());
        jdbc.update("INSERT INTO question_reports (question_id, reporter_id, reason) VALUES (:q, :u, :r) ON CONFLICT DO NOTHING", params);
        jdbc.update("""
                UPDATE trip_questions SET status = 'HIDDEN_BY_REPORTS'
                WHERE id = :q AND status = 'VISIBLE'
                  AND (SELECT count(*) FROM question_reports WHERE question_id = :q) >= :n""", params);
    }

    // ---- helpers ----

    private record Row(long id, long tripId, long askerId) {}

    private Row row(long questionId) {
        return jdbc.query("SELECT id, trip_id, asker_id FROM trip_questions WHERE id = :id", new MapSqlParameterSource("id", questionId),
                        (rs, i) -> new Row(rs.getLong("id"), rs.getLong("trip_id"), rs.getLong("asker_id")))
                .stream().findFirst().orElseThrow(ApiException::notFound);
    }

    private Row ownedQuestion(long ownerId, long questionId) {
        Row q = row(questionId);
        trips.findById(q.tripId()).filter(t -> t.isOwnedBy(ownerId)).orElseThrow(ApiException::notFound);
        return q;
    }

    private Trip visibleTrip(long tripId, Long viewerId) {
        return trips.findById(tripId).filter(t -> t.isVisibleTo(viewerId)).orElseThrow(ApiException::notFound);
    }

    private Question one(long questionId, long viewerId, boolean owner) {
        return jdbc.query("""
                SELECT q.id, q.body, q.answer, q.answered_at, q.created_at, q.status, q.asker_id, u.username, u.display_name
                FROM trip_questions q JOIN users u ON u.id = q.asker_id WHERE q.id = :id""",
                new MapSqlParameterSource("id", questionId), (rs, i) -> new Question(
                        rs.getLong("id"), rs.getString("body"), new Asker(rs.getString("username"), rs.getString("display_name")),
                        rs.getString("answer"),
                        rs.getTimestamp("answered_at") == null ? null : rs.getTimestamp("answered_at").toInstant(),
                        rs.getTimestamp("created_at").toInstant(),
                        owner ? rs.getString("status") : null,
                        rs.getLong("asker_id") == viewerId)).get(0);
    }

    private static String clean(String text, int max, String what) {
        String t = text == null ? "" : text.strip();
        if (t.isEmpty()) throw ApiException.badRequest("Write your " + what + " first");
        if (t.length() > max) throw ApiException.badRequest("Keep your " + what + " under " + max + " characters");
        return t;
    }
}
