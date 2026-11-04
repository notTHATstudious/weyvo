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

    public record UsernameRequest(@NotBlank String username) {}

    /** Whether you can change your username now, and when you next can. available is for the name in ?check=. */
    public record UsernameStatus(boolean canChange, java.time.Instant nextChangeAt, Boolean available, String problem) {}

    static final java.time.Duration USERNAME_COOLDOWN = java.time.Duration.ofDays(90);
    private static final java.util.regex.Pattern USERNAME = java.util.regex.Pattern.compile("^[a-zA-Z0-9_.]{3,30}$");
    /** Names that would look official or clash with app pages. */
    private static final java.util.Set<String> RESERVED = java.util.Set.of(
            "weyvo", "admin", "administrator", "support", "help", "team", "official", "moderator", "staff", "me", "settings",
            "premium", "atlas", "bubdub", "root", "system", "null", "undefined");

    private static final Logger log = LoggerFactory.getLogger(AccountController.class);

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final SessionCookie cookie;
    private final RateLimiter limits;
    private final PhotoService photos;
    private final NamedParameterJdbcTemplate jdbc;
    private final com.weyvo.api.photo.PhotoStorage photoStorage;

    public AccountController(UserRepository users, PasswordEncoder passwords, JwtService jwt, SessionCookie cookie,
                             RateLimiter limits, PhotoService photos, NamedParameterJdbcTemplate jdbc,
                             com.weyvo.api.photo.PhotoStorage photoStorage) {
        this.photoStorage = photoStorage;
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

    /** Can you change your username yet; with ?check=name, also whether that name is free. */
    @GetMapping("/api/me/username")
    public UsernameStatus usernameStatus(@AuthenticationPrincipal CurrentUser current,
                                         @org.springframework.web.bind.annotation.RequestParam(required = false) String check) {
        java.time.Instant next = nextUsernameChange(current.id());
        boolean can = next == null || !next.isAfter(java.time.Instant.now());
        if (check == null || check.isBlank()) return new UsernameStatus(can, next, null, null);
        limits.attempt("username-check", "user:" + current.id(), 60, Duration.ofMinutes(5), "Slow down a little and try again");
        String problem = usernameProblem(current, check.strip());
        return new UsernameStatus(can, next, problem == null, problem);
    }

    /** A new username: free, allowed, and at most once every 90 days. Old profile links stop working. */
    @PutMapping("/api/me/username")
    @Transactional
    public Profile changeUsername(@AuthenticationPrincipal CurrentUser current, @Valid @RequestBody UsernameRequest req) {
        limits.attempt("username-change", "user:" + current.id(), 10, Duration.ofHours(1), "Too many tries. Wait a little and try again");
        String name = req.username().strip();
        java.time.Instant next = nextUsernameChange(current.id());
        if (next != null && next.isAfter(java.time.Instant.now())) {
            throw ApiException.badRequest("You can change your username again on "
                    + java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy").withZone(java.time.ZoneId.of("Asia/Kolkata")).format(next));
        }
        String problem = usernameProblem(current, name);
        if (problem != null) throw problem.contains("taken") ? ApiException.conflict(problem) : ApiException.badRequest(problem);
        try {
            jdbc.update("UPDATE users SET username = :n, username_changed_at = now() WHERE id = :u",
                    new MapSqlParameterSource().addValue("n", name).addValue("u", current.id()));
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw ApiException.conflict("That username is taken");
        }
        log.info("Username changed userId={}", current.id());
        User user = me(current);
        return new Profile(name, user.getDisplayName(), user.getBio());
    }

    private java.time.Instant nextUsernameChange(long userId) {
        java.sql.Timestamp at = jdbc.queryForObject("SELECT username_changed_at FROM users WHERE id = :u",
                new MapSqlParameterSource("u", userId), java.sql.Timestamp.class);
        return at == null ? null : at.toInstant().plus(USERNAME_COOLDOWN);
    }

    /** Why a name can't be used, in plain words, or null when it's fine. */
    private String usernameProblem(CurrentUser current, String name) {
        if (!USERNAME.matcher(name).matches()) return "Use 3 to 30 letters, numbers, dots or underscores";
        if (name.equals(current.username())) return "That's already your username";
        String lower = name.toLowerCase(java.util.Locale.ROOT);
        if (RESERVED.contains(lower) || lower.startsWith("weyvo")) return "That username isn't available";
        Integer others = jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(username) = :n AND id <> :u",
                new MapSqlParameterSource().addValue("n", lower).addValue("u", current.id()), Integer.class);
        return others != null && others > 0 ? "That username is taken" : null;
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
        data.put("blocked", jdbc.queryForList("""
                SELECT u.username, b.created_at FROM user_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = :u""", p));
        data.put("reportsMade", jdbc.queryForList("SELECT trip_id, reason, created_at FROM trip_reports WHERE reporter_id = :u", p));
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
        String avatarKey = jdbc.queryForObject("SELECT avatar_key FROM users WHERE id = :u", new MapSqlParameterSource("u", user.getId()), String.class);
        if (avatarKey != null) photoStorage.delete(avatarKey);
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
