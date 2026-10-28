package com.weyvo.api.user;

import com.weyvo.api.common.ApiException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

    /** Public profile fields only; email and account status never leave the server. */
    public record PublicUser(String username, String displayName, String bio) {}

    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/api/users/{username}")
    @Transactional(readOnly = true)
    public PublicUser profile(@PathVariable String username) {
        return users.findByUsernameIgnoreCase(username)
                .filter(User::isActive)
                .map(u -> new PublicUser(u.getUsername(), u.getDisplayName(), u.getBio()))
                .orElseThrow(ApiException::notFound);
    }
}
