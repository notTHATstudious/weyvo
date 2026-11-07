package com.weyvo.api.trip;

import com.weyvo.api.photo.PhotoService;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Deletes short stories, with their photos, once their 7 days are up. Full issues never expire. */
@Component
public class ShortStoryExpiry {

    private static final Logger log = LoggerFactory.getLogger(ShortStoryExpiry.class);

    private final NamedParameterJdbcTemplate jdbc;
    private final TripRepository trips;
    private final PhotoService photos;
    private final TransactionTemplate tx;

    public ShortStoryExpiry(NamedParameterJdbcTemplate jdbc, TripRepository trips, PhotoService photos, TransactionTemplate tx) {
        this.jdbc = jdbc;
        this.trips = trips;
        this.photos = photos;
        this.tx = tx;
    }

    @Scheduled(fixedDelay = 900_000, initialDelay = 30_000)
    public void run() {
        List<Long> due = jdbc.queryForList("SELECT id FROM trips WHERE expires_at <= now() ORDER BY expires_at LIMIT 500",
                new MapSqlParameterSource(), Long.class);
        for (long id : due) {
            try {
                tx.executeWithoutResult(s -> expire(id));
            } catch (RuntimeException e) {
                // One bad story never stops the rest; it's tried again next run.
                log.warn("Could not expire story id={}: {}", id, e.getClass().getSimpleName());
            }
        }
        if (!due.isEmpty()) log.info("Expired {} short stories", due.size());
    }

    private void expire(long id) {
        // A story an admin took down, or one still held for a check, earns nothing.
        jdbc.update("""
                INSERT INTO expired_short_stories (user_id, published_at)
                SELECT owner_id, published_at FROM trips WHERE id = :id AND removed_at IS NULL AND published_at IS NOT NULL""",
                new MapSqlParameterSource("id", id));
        photos.deleteAllFor(id);
        trips.deleteById(id);
    }
}
