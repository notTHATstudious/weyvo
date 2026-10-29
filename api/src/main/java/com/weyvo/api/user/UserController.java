package com.weyvo.api.user;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.social.FollowService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

    /** Public profile fields only; email and account status never leave the server. */
    public record PublicUser(String username, String displayName, String bio, int followers, int following, boolean followedByMe,
                             boolean premium, String avatarUrl) {}

    private final UserRepository users;
    private final FollowService follows;

    public UserController(UserRepository users, FollowService follows) {
        this.users = users;
        this.follows = follows;
    }

    @GetMapping("/api/users/{username}")
    @Transactional(readOnly = true)
    public PublicUser profile(@PathVariable String username, @AuthenticationPrincipal CurrentUser viewer) {
        User u = users.findByUsernameIgnoreCase(username).filter(User::isActive).orElseThrow(ApiException::notFound);
        var stats = follows.stats(u.getId(), viewer == null ? null : viewer.id());
        return new PublicUser(u.getUsername(), u.getDisplayName(), u.getBio(), stats.followers(), stats.following(), stats.followedByMe(),
                u.effectivePlan(java.time.Instant.now()) == User.Plan.PREMIUM, u.getAvatarUrl());
    }
}
