package com.weyvo.api.auth;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.user.User;
import com.weyvo.api.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record SignupRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 10, max = 72, message = "Use 10 to 72 characters") String password,
            @NotBlank @Pattern(regexp = "^[a-zA-Z0-9_.]{3,30}$", message = "3–30 letters, numbers, dots or underscores") String username,
            @NotBlank @Size(max = 60) String displayName) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record MeResponse(long id, String username, String displayName, String bio) {
        static MeResponse of(User u) {
            return new MeResponse(u.getId(), u.getUsername(), u.getDisplayName(), u.getBio());
        }
    }

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final SessionCookie cookie;
    private final EmailPolicy emailPolicy;

    public AuthController(UserRepository users, PasswordEncoder passwords, JwtService jwt, SessionCookie cookie, EmailPolicy emailPolicy) {
        this.users = users;
        this.passwords = passwords;
        this.jwt = jwt;
        this.cookie = cookie;
        this.emailPolicy = emailPolicy;
    }

    @PostMapping("/signup")
    @Transactional
    public ResponseEntity<MeResponse> signup(@Valid @RequestBody SignupRequest req) {
        emailPolicy.requireAcceptable(req.email());
        if (users.existsByEmailIgnoreCase(req.email())) throw ApiException.conflict("That email is already registered");
        if (users.existsByUsernameIgnoreCase(req.username())) throw ApiException.conflict("That username is taken");
        User user = users.save(new User(req.email().trim(), passwords.encode(req.password()), req.username(), req.displayName().trim()));
        return withSession(user, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<MeResponse> login(@Valid @RequestBody LoginRequest req) {
        User user = users.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> passwords.matches(req.password(), u.getPasswordHash()))
                .filter(User::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect"));
        return withSession(user, HttpStatus.OK);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.clear().toString()).build();
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(@AuthenticationPrincipal CurrentUser current) {
        if (current == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return users.findById(current.id())
                .filter(User::isActive)
                .map(u -> ResponseEntity.ok(MeResponse.of(u)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    private ResponseEntity<MeResponse> withSession(User user, HttpStatus status) {
        String token = jwt.issue(new CurrentUser(user.getId(), user.getUsername()));
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie.create(token).toString())
                .body(MeResponse.of(user));
    }
}
