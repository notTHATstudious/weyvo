package com.weyvo.api.search;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.auth.RateLimiter;
import com.weyvo.api.trip.TripDtos.TripCard;
import com.weyvo.api.trip.TripService;
import com.weyvo.api.user.Avatars;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.List;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** One search box for travellers, destinations and stories. Only what the searcher could already see comes back. */
@RestController
public class SearchController {

    public record Person(String username, String displayName, String avatarUrl) {}
    public record Place(String slug, String name, String country, int stories) {}
    public record Results(List<Person> people, List<Place> places, List<TripCard> stories) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final TripService trips;
    private final RateLimiter limits;

    public SearchController(NamedParameterJdbcTemplate jdbc, TripService trips, RateLimiter limits) {
        this.jdbc = jdbc;
        this.trips = trips;
        this.limits = limits;
    }

    @GetMapping("/api/search")
    @Transactional(readOnly = true)
    public Results search(@RequestParam(defaultValue = "") String q, @AuthenticationPrincipal CurrentUser viewer, HttpServletRequest http) {
        String text = q.strip();
        if (text.length() < 2) return new Results(List.of(), List.of(), List.of());
        if (text.length() > 60) text = text.substring(0, 60);
        limits.attempt("search-ip", http.getRemoteAddr(), 120, Duration.ofMinutes(5), "Too many searches. Try again in a few minutes");
        String pattern = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Long viewerId = viewer == null ? null : viewer.id();
        var p = new MapSqlParameterSource().addValue("q", pattern).addValue("v", viewerId).addValue("starts", text.toLowerCase() + "%");

        // People: active accounts, minus anyone in a block with the viewer. Username prefix matches first.
        List<Person> people = jdbc.query("""
                SELECT u.username, u.display_name, u.avatar_version FROM users u
                WHERE u.status = 'ACTIVE' AND (u.username ILIKE :q OR u.display_name ILIKE :q)
                  AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = CAST(:v AS BIGINT) AND b.blocked_id = u.id)
                                                              OR (b.blocker_id = u.id AND b.blocked_id = CAST(:v AS BIGINT)))
                ORDER BY lower(u.username) LIKE :starts DESC, u.username LIMIT 8""", p,
                (rs, i) -> new Person(rs.getString("username"), rs.getString("display_name"),
                        Avatars.url(rs.getString("username"), (Integer) rs.getObject("avatar_version"))));

        List<Place> places = jdbc.query("""
                SELECT p.slug, p.name, p.country,
                       (SELECT count(*) FROM trips t JOIN users o ON o.id = t.owner_id AND o.status = 'ACTIVE'
                        WHERE t.place_id = p.id AND t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL) AS stories
                FROM places p WHERE p.found AND (p.name ILIKE :q OR p.country ILIKE :q)
                ORDER BY lower(p.name) LIKE :starts DESC, stories DESC, p.name LIMIT 8""", p,
                (rs, i) -> new Place(rs.getString("slug"), rs.getString("name"), rs.getString("country"), rs.getInt("stories")));

        return new Results(people, places, trips.search(pattern, viewerId));
    }
}
