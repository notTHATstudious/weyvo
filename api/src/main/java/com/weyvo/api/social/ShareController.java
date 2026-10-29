package com.weyvo.api.social;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.auth.RateLimiter;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.trip.Trip;
import com.weyvo.api.trip.TripRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Locale;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Counts shares of a story for the admin totals. Signed-out readers can share too, within a rate limit. */
@RestController
public class ShareController {

    public record ShareBody(String kind) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final TripRepository trips;
    private final RateLimiter limits;

    public ShareController(NamedParameterJdbcTemplate jdbc, TripRepository trips, RateLimiter limits) {
        this.jdbc = jdbc;
        this.trips = trips;
        this.limits = limits;
    }

    @PostMapping("/api/trips/{tripId}/shares")
    @Transactional
    public ResponseEntity<Void> share(@PathVariable long tripId, @RequestBody ShareBody body, @AuthenticationPrincipal CurrentUser user,
                                      HttpServletRequest http) {
        Long userId = user == null ? null : user.id();
        limits.attempt("share-ip", http.getRemoteAddr(), 60, Duration.ofHours(1), "Too many shares. Try again later");
        String kind = body.kind() == null ? "LINK" : body.kind().toUpperCase(Locale.ROOT);
        if (!kind.equals("LINK") && !kind.equals("IMAGE")) throw ApiException.badRequest("Unknown share type");
        trips.findById(tripId).filter(t -> t.isVisibleTo(userId) && t.getStatus() == Trip.Status.PUBLISHED).orElseThrow(ApiException::notFound);
        jdbc.update("INSERT INTO trip_shares (trip_id, user_id, kind) VALUES (:t, :u, :k)",
                new MapSqlParameterSource().addValue("t", tripId).addValue("u", userId).addValue("k", kind));
        return ResponseEntity.noContent().build();
    }
}
