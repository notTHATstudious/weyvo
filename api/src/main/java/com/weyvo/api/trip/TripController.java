package com.weyvo.api.trip;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.social.ReactionService;
import com.weyvo.api.trip.TripDtos.TripCard;
import com.weyvo.api.trip.TripDtos.TripRequest;
import com.weyvo.api.trip.TripDtos.TripView;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TripController {

    private final TripService service;

    public TripController(TripService service) {
        this.service = service;
    }

    @GetMapping("/api/trips")
    public List<TripCard> feed(@RequestParam(required = false) Trip.Kind kind, @AuthenticationPrincipal CurrentUser user) {
        return service.feed(kind, idOf(user));
    }

    @GetMapping("/api/trips/{slug}")
    public TripView view(@PathVariable String slug, @AuthenticationPrincipal CurrentUser user) {
        return service.view(slug, idOf(user));
    }

    @GetMapping("/api/users/{username}/trips")
    public List<TripCard> byUser(@PathVariable String username, @AuthenticationPrincipal CurrentUser user) {
        return service.byUser(username, idOf(user));
    }

    @GetMapping("/api/me/trips")
    public List<TripCard> mine(@AuthenticationPrincipal CurrentUser user) {
        return service.mine(user.id());
    }

    @GetMapping("/api/me/following")
    public List<TripCard> following(@AuthenticationPrincipal CurrentUser user) {
        return service.following(user.id());
    }

    /** The reader's private lists: {@code save} (bookmarks) and {@code want} (Want to go). */
    @GetMapping("/api/me/reactions/{type}")
    public List<TripCard> reacted(@AuthenticationPrincipal CurrentUser user, @PathVariable String type) {
        ReactionService.Type t = switch (type) {
            case "save" -> ReactionService.Type.SAVE;
            case "want" -> ReactionService.Type.WANT;
            case "been" -> ReactionService.Type.BEEN;
            default -> throw ApiException.notFound();
        };
        return service.reacted(user.id(), t);
    }

    private static Long idOf(CurrentUser user) {
        return user == null ? null : user.id();
    }

    @PostMapping("/api/trips")
    public ResponseEntity<TripView> create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody TripRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(user.id(), req));
    }

    @PutMapping("/api/trips/{id}")
    public TripView update(@AuthenticationPrincipal CurrentUser user, @PathVariable long id, @Valid @RequestBody TripRequest req) {
        return service.update(user.id(), id, req);
    }

    @PostMapping("/api/trips/{id}/publish")
    public TripView publish(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        return service.publish(user.id(), id);
    }

    @DeleteMapping("/api/trips/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        service.delete(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
