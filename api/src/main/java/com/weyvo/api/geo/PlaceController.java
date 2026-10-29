package com.weyvo.api.geo;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.trip.TripDtos.TripCard;
import com.weyvo.api.trip.TripService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlaceController {

    public record TripRef(String slug, String title) {}

    public record Pin(String placeSlug, String name, String country, double lat, double lng, List<TripRef> trips) {}

    /** want is null unless the viewer is looking at their own map: Want to go is a private list. */
    public record TravelMap(List<Pin> been, List<Pin> want, int countries, int places) {}

    public record PlaceSummary(String slug, String name, String country, double lat, double lng, int stories, int shorts) {}

    public record PlaceDetail(String slug, String name, String country, double lat, double lng,
                              int stories, int shorts, int wantToGo, int[] months, List<TripCard> trips, PlaceReactions reactions) {}

    /** Travellers who marked the destination itself, plus the viewer's own marks. */
    public record PlaceReactions(int been, int want, boolean beenByMe, boolean wantByMe) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final TripService trips;
    private final com.weyvo.api.social.BlockService blocks;

    public PlaceController(NamedParameterJdbcTemplate jdbc, TripService trips, com.weyvo.api.social.BlockService blocks) {
        this.jdbc = jdbc;
        this.trips = trips;
        this.blocks = blocks;
    }

    @GetMapping("/api/users/{username}/map")
    @Transactional(readOnly = true)
    public TravelMap map(@PathVariable String username, @AuthenticationPrincipal CurrentUser viewer) {
        Long ownerId = jdbc.query("SELECT id FROM users WHERE lower(username) = lower(:n) AND status = 'ACTIVE'",
                new MapSqlParameterSource("n", username), (rs, i) -> rs.getLong(1)).stream().findFirst().orElseThrow(ApiException::notFound);
        if (blocks.between(viewer == null ? null : viewer.id(), ownerId)) throw ApiException.notFound();
        boolean self = viewer != null && viewer.id() == ownerId;
        var p = new MapSqlParameterSource().addValue("u", ownerId).addValue("self", self);

        // Been: the person's own stories. Others see public published ones only.
        List<Pin> been = pins("""
                SELECT p.slug, p.name, p.country, p.lat, p.lng, t.slug AS trip_slug, t.title, t.created_at AS at
                FROM trips t JOIN places p ON p.id = t.place_id
                WHERE t.owner_id = :u AND (:self OR (t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL))
                UNION ALL
                SELECT p.slug, p.name, p.country, p.lat, p.lng, NULL, NULL, r.created_at
                FROM place_reactions r JOIN places p ON p.id = r.place_id
                WHERE r.user_id = :u AND r.type = 'BEEN'
                ORDER BY at DESC""", p);
        // Want to go: stories this person saved as "want", only on their own map.
        List<Pin> want = self ? pins("""
                SELECT p.slug, p.name, p.country, p.lat, p.lng, t.slug AS trip_slug, t.title, r.created_at AS at
                FROM trip_reactions r JOIN trips t ON t.id = r.trip_id JOIN places p ON p.id = t.place_id
                WHERE r.user_id = :u AND r.type = 'WANT' AND t.status = 'PUBLISHED' AND t.visibility <> 'PRIVATE' AND t.removed_at IS NULL
                UNION ALL
                SELECT p.slug, p.name, p.country, p.lat, p.lng, NULL, NULL, r.created_at
                FROM place_reactions r JOIN places p ON p.id = r.place_id
                WHERE r.user_id = :u AND r.type = 'WANT'
                ORDER BY at DESC""", p) : null;
        int countries = (int) been.stream().map(Pin::country).filter(c -> c != null).distinct().count();
        return new TravelMap(been, want, countries, been.size());
    }

    @GetMapping("/api/places")
    @Transactional(readOnly = true)
    public List<PlaceSummary> popular() {
        return jdbc.query("""
                SELECT p.slug, p.name, p.country, p.lat, p.lng,
                       count(*) FILTER (WHERE t.kind = 'FULL') AS stories, count(*) FILTER (WHERE t.kind = 'SHORT') AS shorts
                FROM places p JOIN trips t ON t.place_id = p.id AND t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL
                JOIN users o ON o.id = t.owner_id AND o.status = 'ACTIVE'
                WHERE p.found GROUP BY p.id ORDER BY count(*) DESC, p.name LIMIT 20""", new MapSqlParameterSource(),
                (rs, i) -> new PlaceSummary(rs.getString("slug"), rs.getString("name"), rs.getString("country"), rs.getDouble("lat"), rs.getDouble("lng"),
                        rs.getInt("stories"), rs.getInt("shorts")));
    }

    @GetMapping("/api/places/{slug}")
    @Transactional(readOnly = true)
    public PlaceDetail place(@PathVariable String slug, @AuthenticationPrincipal CurrentUser viewer) {
        var row = jdbc.query("SELECT id, slug, name, country, lat, lng FROM places WHERE slug = :s AND found",
                new MapSqlParameterSource("s", slug), (rs, i) -> new Object[] {rs.getLong("id"), rs.getString("slug"), rs.getString("name"),
                        rs.getString("country"), rs.getDouble("lat"), rs.getDouble("lng")}).stream().findFirst().orElseThrow(ApiException::notFound);
        long id = (long) row[0];
        var p = new MapSqlParameterSource("id", id);
        String visible = "t.place_id = :id AND t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL"
                + " AND EXISTS (SELECT 1 FROM users o WHERE o.id = t.owner_id AND o.status = 'ACTIVE')";
        Map<String, Object> counts = jdbc.queryForMap("SELECT count(*) FILTER (WHERE kind = 'FULL') AS stories, count(*) FILTER (WHERE kind = 'SHORT') AS shorts FROM trips t WHERE " + visible, p);
        Integer want = jdbc.queryForObject("SELECT count(*) FROM trip_reactions r JOIN trips t ON t.id = r.trip_id WHERE r.type = 'WANT' AND " + visible, p, Integer.class);
        int[] months = new int[12];
        jdbc.query("SELECT EXTRACT(MONTH FROM COALESCE(t.start_date, t.published_at::date))::int AS m, count(*) AS n FROM trips t WHERE "
                + visible + " GROUP BY 1", p, rs -> { months[rs.getInt("m") - 1] = rs.getInt("n"); });
        return new PlaceDetail((String) row[1], (String) row[2], (String) row[3], (double) row[4], (double) row[5],
                ((Number) counts.get("stories")).intValue(), ((Number) counts.get("shorts")).intValue(), want == null ? 0 : want, months,
                trips.atPlace(id, viewer == null ? null : viewer.id()), reactions(id, viewer == null ? null : viewer.id()));
    }

    @PutMapping("/api/places/{slug}/reactions/{type}")
    @Transactional
    public PlaceReactions react(@PathVariable String slug, @PathVariable String type, @AuthenticationPrincipal CurrentUser user) {
        return setReaction(slug, type, user, true);
    }

    @DeleteMapping("/api/places/{slug}/reactions/{type}")
    @Transactional
    public PlaceReactions unreact(@PathVariable String slug, @PathVariable String type, @AuthenticationPrincipal CurrentUser user) {
        return setReaction(slug, type, user, false);
    }

    private PlaceReactions setReaction(String slug, String type, CurrentUser user, boolean on) {
        String t = switch (type) {
            case "been" -> "BEEN";
            case "want" -> "WANT";
            default -> throw ApiException.notFound();
        };
        long placeId = jdbc.query("SELECT id FROM places WHERE slug = :s AND found", new MapSqlParameterSource("s", slug), (rs, i) -> rs.getLong(1))
                .stream().findFirst().orElseThrow(ApiException::notFound);
        var p = new MapSqlParameterSource().addValue("u", user.id()).addValue("p", placeId).addValue("t", t);
        jdbc.update(on ? "INSERT INTO place_reactions (user_id, place_id, type) VALUES (:u, :p, :t) ON CONFLICT DO NOTHING"
                : "DELETE FROM place_reactions WHERE user_id = :u AND place_id = :p AND type = :t", p);
        return reactions(placeId, user.id());
    }

    private PlaceReactions reactions(long placeId, Long viewerId) {
        var p = new MapSqlParameterSource().addValue("p", placeId).addValue("u", viewerId);
        return jdbc.queryForObject("""
                SELECT count(*) FILTER (WHERE type = 'BEEN') AS been, count(*) FILTER (WHERE type = 'WANT') AS want,
                       bool_or(user_id = :u AND type = 'BEEN') AS been_me, bool_or(user_id = :u AND type = 'WANT') AS want_me
                FROM place_reactions WHERE place_id = :p""", p,
                (rs, i) -> new PlaceReactions(rs.getInt("been"), rs.getInt("want"), rs.getBoolean("been_me"), rs.getBoolean("want_me")));
    }

    /** Groups rows into one pin per place, each listing its trips. */
    private List<Pin> pins(String sql, MapSqlParameterSource params) {
        Map<String, Pin> byPlace = new LinkedHashMap<>();
        jdbc.query(sql, params, rs -> {
            String slug = rs.getString("slug");
            byPlace.computeIfAbsent(slug, s -> {
                try {
                    return new Pin(s, rs.getString("name"), rs.getString("country"), rs.getDouble("lat"), rs.getDouble("lng"), new ArrayList<>());
                } catch (java.sql.SQLException e) {
                    throw new IllegalStateException(e);
                }
            });
            if (rs.getString("trip_slug") != null) byPlace.get(slug).trips().add(new TripRef(rs.getString("trip_slug"), rs.getString("title")));
        });
        return List.copyOf(byPlace.values());
    }
}
