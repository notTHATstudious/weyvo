package com.weyvo.api.user;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.auth.JwtService;
import com.weyvo.api.auth.RateLimiter;
import com.weyvo.api.auth.SessionCookie;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.photo.PhotoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's own account: profile, password, data export and deletion. */
@RestController
public class AccountController {

    public record ProfileRequest(@NotBlank @Size(max = 60) String displayName, @Size(max = 160) String bio) {}

    public record PasswordChange(@NotBlank String currentPassword,
                                 @NotBlank @Size(min = 10, max = 72, message = "Use 10 to 72 characters") String newPassword) {}

    public record DeleteRequest(@NotBlank String password) {}

    public record Profile(String username, String displayName, String bio) {}

    private static final Logger log = LoggerFactory.getLogger(AccountController.class);

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final SessionCookie cookie;
    private final RateLimiter limits;
    private final PhotoService photos;
    private final NamedParameterJdbcTemplate jdbc;

    public AccountController(UserRepository users, PasswordEncoder passwords, JwtService jwt, SessionCookie cookie,
                             RateLimiter limits, PhotoService photos, NamedParameterJdbcTemplate jdbc) {
        this.users = users;
        this.passwords = passwords;
        this.jwt = jwt;
        this.cookie = cookie;
        this.limits = limits;
        this.photos = photos;
        this.jdbc = jdbc;
    }

    @PutMapping("/api/me/profile")
    @Transactional
    public Profile updateProfile(@AuthenticationPrincipal CurrentUser current, @Valid @RequestBody ProfileRequest req) {
        User user = me(current);
        user.setDisplayName(req.displayName().strip());
        user.setBio(req.bio() == null || req.bio().isBlank() ? null : req.bio().strip());
        return new Profile(user.getUsername(), user.getDisplayName(), user.getBio());
    }

    /** Signs out every other device; this one gets a fresh session. */
    @PostMapping("/api/auth/password/change")
    @Transactional
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal CurrentUser current, @Valid @RequestBody PasswordChange req) {
        User user = me(current);
        checkPassword(user, req.currentPassword());
        user.changePassword(passwords.encode(req.newPassword()));
        users.saveAndFlush(user);
        log.info("Password changed userId={}; other sessions revoked", user.getId());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie.create(jwt.issue(user.getId(), user.getSessionVersion())).toString())
                .build();
    }

    /** Signs out every device, including this one, e.g. after losing a phone. */
    @PostMapping("/api/auth/logout-everywhere")
    @Transactional
    public ResponseEntity<Void> logoutEverywhere(@AuthenticationPrincipal CurrentUser current) {
        User user = me(current);
        user.revokeSessions();
        log.info("All sessions revoked userId={}", user.getId());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.clear().toString()).build();
    }

    /** Everything we hold about the user, as JSON (right of access). */
    @GetMapping("/api/me/export")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> export(@AuthenticationPrincipal CurrentUser current) {
        User user = me(current);
        var p = new MapSqlParameterSource("u", user.getId());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportedAt", Instant.now().toString());
        data.put("account", jdbc.queryForMap("""
                SELECT username, email, display_name, bio, plan, plan_expires_at, email_verified_at, created_at
                FROM users WHERE id = :u""", p));
        List<Map<String, Object>> trips = jdbc.queryForList("""
                SELECT id, slug, kind, short_tag, title, place, start_date, end_date, intro, final_note, visibility, status,
                       created_at, published_at FROM trips WHERE owner_id = :u ORDER BY created_at""", p);
        for (Map<String, Object> t : trips) {
            var tp = new MapSqlParameterSource("t", t.get("id"));
            t.put("sections", jdbc.queryForList("SELECT position, heading, body, photo_caption FROM trip_sections WHERE trip_id = :t ORDER BY position", tp));
            t.put("moments", jdbc.queryForList("SELECT text FROM trip_moments WHERE trip_id = :t ORDER BY position", tp, String.class));
            t.put("photos", jdbc.queryForList("SELECT role, position, width, height, created_at FROM trip_photos WHERE trip_id = :t", tp));
        }
        data.put("trips", trips);
        data.put("questionsAsked", jdbc.queryForList("SELECT trip_id, body, answer, created_at FROM trip_questions WHERE asker_id = :u ORDER BY created_at", p));
        data.put("reactions", jdbc.queryForList("SELECT trip_id, type, created_at FROM trip_reactions WHERE user_id = :u ORDER BY created_at", p));
        data.put("following", jdbc.queryForList("""
                SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = :u""", p));
        log.info("Data export userId={}", user.getId());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"weyvo-export.json\"")
                .body(data);
    }

    /** Permanently deletes the account and everything it owns, including photo files. */
    @DeleteMapping("/api/me")
    @Transactional
    public ResponseEntity<Void> deleteAccount(@AuthenticationPrincipal CurrentUser current, @Valid @RequestBody DeleteRequest req) {
        User user = me(current);
        checkPassword(user, req.password());
        List<Long> tripIds = jdbc.queryForList("SELECT id FROM trips WHERE owner_id = :u", new MapSqlParameterSource("u", user.getId()), Long.class);
        tripIds.forEach(photos::deleteAllFor); // files are removed after commit; rows go with the cascade
        users.delete(user);
        log.info("Account deleted userId={} trips={}", user.getId(), tripIds.size());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.clear().toString()).build();
    }

    private void checkPassword(User user, String password) {
        limits.attempt("password-check", "user:" + user.getId(), 8, Duration.ofMinutes(15), "Too many attempts. Wait a few minutes and try again");
        if (!passwords.matches(password, user.getPasswordHash())) throw ApiException.badRequest("That password isn't right");
    }

    private User me(CurrentUser current) {
        if (current == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Sign in again");
        return users.findById(current.id()).filter(User::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Sign in again"));
    }
}
