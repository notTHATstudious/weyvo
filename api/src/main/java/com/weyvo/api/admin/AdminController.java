package com.weyvo.api.admin;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.admin.ModerationService.Kind;
import com.weyvo.api.admin.ModerationService.Report;
import java.util.List;
import java.util.Locale;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** The report queue. SecurityConfig already limits /api/admin/** to admins; each handler checks again. */
@RestController
public class AdminController {

    private final ModerationService moderation;

    public AdminController(ModerationService moderation) {
        this.moderation = moderation;
    }

    @GetMapping("/api/admin/reports")
    public List<Report> reports(@AuthenticationPrincipal CurrentUser user) {
        requireAdmin(user);
        return moderation.queue();
    }

    @PostMapping("/api/admin/reports/{kind}/{id}/{decision}")
    public ResponseEntity<Void> decide(@AuthenticationPrincipal CurrentUser user, @PathVariable String kind, @PathVariable long id,
                                       @PathVariable String decision) {
        requireAdmin(user);
        Kind k;
        try {
            k = Kind.valueOf(kind.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.notFound();
        }
        switch (decision) {
            case "hide" -> moderation.decide(k, id, true);
            case "keep" -> moderation.decide(k, id, false);
            default -> throw ApiException.notFound();
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/admin/users/{username}/suspend")
    public ResponseEntity<Void> suspend(@AuthenticationPrincipal CurrentUser user, @PathVariable String username) {
        requireAdmin(user);
        moderation.suspend(user.id(), username);
        return ResponseEntity.noContent().build();
    }

    private static void requireAdmin(CurrentUser user) {
        if (user == null || !user.admin()) throw ApiException.notFound();
    }
}
