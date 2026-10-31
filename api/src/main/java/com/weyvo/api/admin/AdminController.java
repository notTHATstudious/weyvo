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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The report queue. SecurityConfig already limits /api/admin/** to admins; each handler checks again. */
@RestController
public class AdminController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AdminController.class);

    private final ModerationService moderation;
    private final AdminStatsService stats;
    private final com.weyvo.api.photo.PhotoService photos;
    private final com.weyvo.api.user.UserRepository users;

    public AdminController(ModerationService moderation, AdminStatsService stats, com.weyvo.api.photo.PhotoService photos,
                           com.weyvo.api.user.UserRepository users) {
        this.moderation = moderation;
        this.stats = stats;
        this.photos = photos;
        this.users = users;
    }

    /**
     * The admin's own address as the API sees it, and the proxy headers that carried it. Used once after
     * deploying to pick APP_CLIENT_IP_HEADER; shows nothing about anyone else.
     */
    @GetMapping("/api/admin/request-info")
    public java.util.Map<String, String> requestInfo(@AuthenticationPrincipal CurrentUser user, jakarta.servlet.http.HttpServletRequest http) {
        requireAdmin(user);
        var out = new java.util.LinkedHashMap<String, String>();
        out.put("clientIp", http.getRemoteAddr());
        for (String h : List.of("X-Forwarded-For", "True-Client-IP", "CF-Connecting-IP", "X-Real-IP", "Forwarded")) {
            out.put(h, String.valueOf(http.getHeader(h)));
        }
        return out;
    }

    @GetMapping("/api/admin/stats")
    public AdminStatsService.Stats stats(@AuthenticationPrincipal CurrentUser user) {
        requireAdmin(user);
        return stats.stats();
    }

    @GetMapping("/api/admin/users")
    public List<AdminStatsService.UserRow> users(@AuthenticationPrincipal CurrentUser user, @RequestParam(defaultValue = "") String q) {
        requireAdmin(user);
        return stats.users(q);
    }

    public record DeletePhotos(String username, String confirm) {}

    /** Testing tool: delete all story photos, or one account's. The exact phrase must be typed to confirm. */
    @PostMapping("/api/admin/photos/delete")
    public java.util.Map<String, Integer> deletePhotos(@AuthenticationPrincipal CurrentUser user, @org.springframework.web.bind.annotation.RequestBody DeletePhotos body) {
        requireAdmin(user);
        if (body == null || !"DELETE PHOTOS".equals(body.confirm())) throw ApiException.badRequest("Type DELETE PHOTOS to confirm");
        Long ownerId = null;
        if (body.username() != null && !body.username().isBlank()) {
            ownerId = users.findByUsernameIgnoreCase(body.username().strip()).map(com.weyvo.api.user.User::getId).orElseThrow(ApiException::notFound);
        }
        int n = photos.deleteAllPhotos(ownerId);
        log.info("Admin {} deleted {} photos ({})", user.id(), n, ownerId == null ? "all accounts" : "account " + ownerId);
        return java.util.Map.of("deleted", n);
    }

    @PostMapping("/api/admin/users/{username}/restore")
    public ResponseEntity<Void> restore(@AuthenticationPrincipal CurrentUser user, @PathVariable String username) {
        requireAdmin(user);
        moderation.restore(username);
        return ResponseEntity.noContent().build();
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
