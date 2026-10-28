package com.weyvo.api.social;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.social.FollowService.FollowStats;
import com.weyvo.api.social.ReactionService.Reactions;
import java.util.Locale;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SocialController {

    private final ReactionService reactions;
    private final FollowService follows;

    public SocialController(ReactionService reactions, FollowService follows) {
        this.reactions = reactions;
        this.follows = follows;
    }

    @PutMapping("/api/trips/{tripId}/reactions/{type}")
    public Reactions react(@AuthenticationPrincipal CurrentUser user, @PathVariable long tripId, @PathVariable String type) {
        return reactions.set(user.id(), tripId, parse(type), true);
    }

    @DeleteMapping("/api/trips/{tripId}/reactions/{type}")
    public Reactions unreact(@AuthenticationPrincipal CurrentUser user, @PathVariable long tripId, @PathVariable String type) {
        return reactions.set(user.id(), tripId, parse(type), false);
    }

    @PutMapping("/api/users/{username}/follow")
    public FollowStats follow(@AuthenticationPrincipal CurrentUser user, @PathVariable String username) {
        return follows.set(user.id(), username, true);
    }

    @DeleteMapping("/api/users/{username}/follow")
    public FollowStats unfollow(@AuthenticationPrincipal CurrentUser user, @PathVariable String username) {
        return follows.set(user.id(), username, false);
    }

    static ReactionService.Type parse(String type) {
        try {
            return ReactionService.Type.valueOf(type.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.notFound();
        }
    }
}
