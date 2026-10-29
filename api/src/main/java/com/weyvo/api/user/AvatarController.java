package com.weyvo.api.user;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.auth.RateLimiter;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.photo.ImageProcessor;
import com.weyvo.api.photo.PhotoStorage;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Profile pictures. They're public like on any social app; trip photos keep their own access rules. */
@RestController
public class AvatarController {

    private final NamedParameterJdbcTemplate jdbc;
    private final PhotoStorage storage;
    private final ImageProcessor images;
    private final RateLimiter limits;

    public AvatarController(NamedParameterJdbcTemplate jdbc, PhotoStorage storage, ImageProcessor images, RateLimiter limits) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.images = images;
        this.limits = limits;
    }

    @PutMapping(path = "/api/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String, String> upload(@AuthenticationPrincipal CurrentUser user, @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) throw ApiException.badRequest("Choose a photo to upload");
        limits.attempt("avatar", "user:" + user.id(), 10, Duration.ofHours(1), "You've changed your picture a lot. Try again later");
        byte[] jpeg = images.avatar(file.getBytes(), 400);
        String key = "avatars/" + user.id() + "/" + UUID.randomUUID() + ".jpg";
        storage.put(key, jpeg, "image/jpeg");
        String old = currentKey(user.id());
        jdbc.update("UPDATE users SET avatar_key = :k, avatar_version = COALESCE(avatar_version, 0) + 1 WHERE id = :u",
                new MapSqlParameterSource().addValue("k", key).addValue("u", user.id()));
        deleteAfterCommit(old);
        return Map.of("avatarUrl", Avatars.url(user.username(), version(user.id())));
    }

    @DeleteMapping("/api/me/avatar")
    @Transactional
    public ResponseEntity<Void> remove(@AuthenticationPrincipal CurrentUser user) {
        String old = currentKey(user.id());
        jdbc.update("UPDATE users SET avatar_key = NULL, avatar_version = NULL WHERE id = :u", new MapSqlParameterSource("u", user.id()));
        deleteAfterCommit(old);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/users/{username}/avatar")
    public ResponseEntity<byte[]> read(@PathVariable String username) {
        String key = jdbc.query("SELECT avatar_key FROM users WHERE lower(username) = lower(:n) AND status = 'ACTIVE'",
                        new MapSqlParameterSource("n", username), (rs, i) -> rs.getString(1))
                .stream().filter(k -> k != null).findFirst().orElseThrow(ApiException::notFound);
        byte[] bytes = storage.get(key).orElseThrow(ApiException::notFound);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                // The URL carries ?v=<version>, so a long cache is safe: a new upload gets a new URL.
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .body(bytes);
    }

    private String currentKey(long userId) {
        return jdbc.queryForObject("SELECT avatar_key FROM users WHERE id = :u", new MapSqlParameterSource("u", userId), String.class);
    }

    private Integer version(long userId) {
        return jdbc.queryForObject("SELECT avatar_version FROM users WHERE id = :u", new MapSqlParameterSource("u", userId), Integer.class);
    }

    private void deleteAfterCommit(String key) {
        if (key == null) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storage.delete(key);
            }
        });
    }
}
