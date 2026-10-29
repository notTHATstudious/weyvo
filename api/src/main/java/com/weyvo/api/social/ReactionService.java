package com.weyvo.api.social;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.trip.Trip;
import com.weyvo.api.trip.TripRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Been there / Want to go / Save. One reaction of each type per reader per trip. */
@Service
public class ReactionService {

    public enum Type { BEEN, WANT, SAVE }

    /** Public counts for Been and Want; Save is a private bookmark, so only the reader's own state is shown. */
    public record Reactions(int been, int want, boolean beenByMe, boolean wantByMe, boolean savedByMe) {
        public static final Reactions NONE = new Reactions(0, 0, false, false, false);
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final TripRepository trips;
    private final NotificationService notifications;
    private final BlockService blocks;

    public ReactionService(NamedParameterJdbcTemplate jdbc, TripRepository trips, NotificationService notifications, BlockService blocks) {
        this.blocks = blocks;
        this.jdbc = jdbc;
        this.trips = trips;
        this.notifications = notifications;
    }

    /** Adds or removes a reaction. Only published trips the reader can see accept reactions. */
    @Transactional
    public Reactions set(long userId, long tripId, Type type, boolean on) {
        Trip trip = trips.findById(tripId)
                .filter(t -> t.isVisibleTo(userId) && t.getStatus() == Trip.Status.PUBLISHED && !blocks.between(userId, t.getOwner().getId()))
                .orElseThrow(ApiException::notFound);
        var params = new MapSqlParameterSource().addValue("u", userId).addValue("t", trip.getId()).addValue("type", type.name());
        if (on) {
            jdbc.update("INSERT INTO trip_reactions (user_id, trip_id, type) VALUES (:u, :t, :type) ON CONFLICT DO NOTHING", params);
            // Save is a private bookmark, so it never notifies the author.
            if (type != Type.SAVE) {
                notifications.notify(trip.getOwner().getId(), userId, NotificationService.Type.valueOf(type.name()), trip.getId(), null);
            }
        } else {
            jdbc.update("DELETE FROM trip_reactions WHERE user_id = :u AND trip_id = :t AND type = :type", params);
        }
        return forTrips(List.of(trip.getId()), userId).get(trip.getId());
    }

    /** Counts and the viewer's own state for many trips in two queries. */
    @Transactional(readOnly = true)
    public Map<Long, Reactions> forTrips(Collection<Long> tripIds, Long viewerId) {
        Map<Long, int[]> counts = new HashMap<>();
        Map<Long, boolean[]> mine = new HashMap<>();
        if (!tripIds.isEmpty()) {
            var params = new MapSqlParameterSource().addValue("ids", tripIds).addValue("u", viewerId);
            jdbc.query("""
                    SELECT trip_id, type, count(*) AS n FROM trip_reactions
                    WHERE trip_id IN (:ids) AND type IN ('BEEN', 'WANT') GROUP BY trip_id, type""", params, rs -> {
                int[] c = counts.computeIfAbsent(rs.getLong("trip_id"), k -> new int[2]);
                c["BEEN".equals(rs.getString("type")) ? 0 : 1] = rs.getInt("n");
            });
            if (viewerId != null) {
                jdbc.query("SELECT trip_id, type FROM trip_reactions WHERE user_id = :u AND trip_id IN (:ids)", params, rs -> {
                    boolean[] m = mine.computeIfAbsent(rs.getLong("trip_id"), k -> new boolean[3]);
                    m[Type.valueOf(rs.getString("type")).ordinal()] = true;
                });
            }
        }
        Map<Long, Reactions> result = new HashMap<>();
        for (Long id : tripIds) {
            int[] c = counts.getOrDefault(id, new int[2]);
            boolean[] m = mine.getOrDefault(id, new boolean[3]);
            result.put(id, new Reactions(c[0], c[1], m[0], m[1], m[2]));
        }
        return result;
    }

    /** Trip ids a reader reacted to with {@code type}, newest first. */
    @Transactional(readOnly = true)
    public List<Long> tripIds(long userId, Type type, int limit) {
        var params = new MapSqlParameterSource().addValue("u", userId).addValue("type", type.name()).addValue("n", limit);
        return jdbc.queryForList("SELECT trip_id FROM trip_reactions WHERE user_id = :u AND type = :type ORDER BY created_at DESC LIMIT :n", params, Long.class);
    }
}
