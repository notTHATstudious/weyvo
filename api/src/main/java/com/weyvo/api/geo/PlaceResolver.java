package com.weyvo.api.geo;

import com.weyvo.api.config.AppProperties;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

/**
 * Background job: links trips to places. Saving a story never waits on the map lookup; trips whose place
 * text is new or changed are picked up here, a few at a time.
 */
@Service
public class PlaceResolver {

    private static final Logger log = LoggerFactory.getLogger(PlaceResolver.class);
    private static final int BATCH = 20;

    private final NamedParameterJdbcTemplate jdbc;
    private final Geocoder geocoder;
    private final boolean enabled;

    public PlaceResolver(NamedParameterJdbcTemplate jdbc, Geocoder geocoder, AppProperties props) {
        this.jdbc = jdbc;
        this.geocoder = geocoder;
        this.enabled = props.geo().enabled();
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 15_000)
    public void scheduled() {
        if (enabled) resolvePending();
    }

    /** Resolves trips whose place text hasn't been looked up yet. Returns how many trips were updated. */
    public int resolvePending() {
        record Pending(long id, String place) {}
        List<Pending> pending = jdbc.query("""
                SELECT id, place FROM trips WHERE geocoded_text IS NULL OR geocoded_text <> place ORDER BY id LIMIT :n""",
                new MapSqlParameterSource("n", BATCH), (rs, i) -> new Pending(rs.getLong("id"), rs.getString("place")));
        int done = 0;
        for (Pending p : pending) {
            try {
                Long placeId = placeFor(p.place()).orElse(null);
                jdbc.update("UPDATE trips SET place_id = :pl, geocoded_text = :txt WHERE id = :id AND place = :txt",
                        new MapSqlParameterSource().addValue("pl", placeId).addValue("txt", p.place()).addValue("id", p.id()));
                done++;
            } catch (RestClientException e) {
                break; // the map service is unreachable; try again on the next run
            }
        }
        if (done > 0) log.info("Linked {} trips to places", done);
        return done;
    }

    /** The place for this text, looking it up once and remembering misses too. */
    private Optional<Long> placeFor(String text) {
        String key = key(text);
        var existing = jdbc.query("SELECT id, found FROM places WHERE query_key = :k", new MapSqlParameterSource("k", key),
                (rs, i) -> rs.getBoolean("found") ? Optional.of(rs.getLong("id")) : Optional.<Long>empty());
        if (!existing.isEmpty()) return existing.get(0);

        Optional<Geocoder.Result> hit = geocoder.lookup(text);
        if (hit.isEmpty()) {
            jdbc.update("INSERT INTO places (query_key, found) VALUES (:k, false) ON CONFLICT (query_key) DO NOTHING", new MapSqlParameterSource("k", key));
            return Optional.empty();
        }
        Geocoder.Result r = hit.get();
        Long id = jdbc.queryForObject("""
                INSERT INTO places (query_key, found, name, country, lat, lng) VALUES (:k, true, :name, :country, :lat, :lng)
                ON CONFLICT (query_key) DO UPDATE SET query_key = EXCLUDED.query_key RETURNING id""",
                new MapSqlParameterSource().addValue("k", key).addValue("name", trim(r.name(), 120)).addValue("country", trim(r.country(), 80))
                        .addValue("lat", r.lat()).addValue("lng", r.lng()), Long.class);
        jdbc.update("UPDATE places SET slug = :s WHERE id = :id AND slug IS NULL",
                new MapSqlParameterSource().addValue("s", uniqueSlug(r.name(), id)).addValue("id", id));
        return Optional.of(id);
    }

    private String uniqueSlug(String name, long id) {
        String base = slugify(name);
        Boolean taken = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM places WHERE slug = :s)", new MapSqlParameterSource("s", base), Boolean.class);
        return Boolean.TRUE.equals(taken) ? base + "-" + id : base;
    }

    static String key(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    static String slugify(String text) {
        String s = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (s.length() > 100) s = s.substring(0, 100);
        return s.isEmpty() ? "place" : s;
    }

    private static String trim(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }
}
