package com.weyvo.api.user;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.social.BlockService;
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
                             boolean premium, String avatarUrl, boolean blockedByMe) {}

    private final UserRepository users;
    private final FollowService follows;
    private final BlockService blocks;

    public UserController(UserRepository users, FollowService follows, BlockService blocks) {
        this.users = users;
        this.follows = follows;
        this.blocks = blocks;
    }

    @GetMapping("/api/users/{username}")
    @Transactional(readOnly = true)
    public PublicUser profile(@PathVariable String username, @AuthenticationPrincipal CurrentUser viewer) {
        User u = users.findByUsernameIgnoreCase(username).filter(User::isActive).orElseThrow(ApiException::notFound);
        Long viewerId = viewer == null ? null : viewer.id();
        // Someone who blocked the viewer looks like a missing account. Someone the viewer blocked stays findable, so they can unblock.
        boolean blockedByMe = blocks.blockedByMe(viewerId, u.getId());
        if (!blockedByMe && blocks.between(viewerId, u.getId())) throw ApiException.notFound();
        var stats = follows.stats(u.getId(), viewerId);
        return new PublicUser(u.getUsername(), u.getDisplayName(), blockedByMe ? null : u.getBio(), stats.followers(), stats.following(), stats.followedByMe(),
                u.effectivePlan(java.time.Instant.now()) == User.Plan.PREMIUM, u.getAvatarUrl(), blockedByMe);
    }
}
