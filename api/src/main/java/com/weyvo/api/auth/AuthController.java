package com.weyvo.api.auth;

import com.weyvo.api.auth.EmailCodeService.Purpose;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import com.weyvo.api.mail.Emails;
import com.weyvo.api.mail.Mailer;
import com.weyvo.api.user.User;
import com.weyvo.api.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    public record CodeRequest(@NotBlank String code) {}

    public record ForgotRequest(@NotBlank @Email String email) {}

    public record ResetRequest(
            @NotBlank @Email String email,
            @NotBlank String code,
            @NotBlank @Size(min = 10, max = 72, message = "Use 10 to 72 characters") String password) {}

    public record MeResponse(long id, String username, String displayName, String bio, boolean emailVerified, String avatarUrl, boolean admin) {
        static MeResponse of(User u) {
            return new MeResponse(u.getId(), u.getUsername(), u.getDisplayName(), u.getBio(), u.isEmailVerified(), u.getAvatarUrl(), u.isAdmin());
        }
    }

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private static final Duration FIFTEEN_MIN = Duration.ofMinutes(15);
    private static final Duration HOUR = Duration.ofHours(1);
    private static final String SLOW_DOWN = "Too many attempts. Wait a few minutes and try again";

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final SessionCookie cookie;
    private final EmailPolicy emailPolicy;
    private final EmailCodeService codes;
    private final Mailer mailer;
    private final RateLimiter limits;
    private final AppProperties.Auth rules;

    public AuthController(UserRepository users, PasswordEncoder passwords, JwtService jwt, SessionCookie cookie, EmailPolicy emailPolicy,
                          EmailCodeService codes, Mailer mailer, RateLimiter limits, AppProperties props) {
        this.users = users;
        this.passwords = passwords;
        this.jwt = jwt;
        this.cookie = cookie;
        this.emailPolicy = emailPolicy;
        this.codes = codes;
        this.mailer = mailer;
        this.limits = limits;
        this.rules = props.auth();
    }

    @PostMapping("/signup")
    @Transactional
    public ResponseEntity<MeResponse> signup(@Valid @RequestBody SignupRequest req, HttpServletRequest http) {
        limits.attempt("signup-ip", http.getRemoteAddr(), rules.signupsPerIpPerHour(), HOUR, SLOW_DOWN);
        emailPolicy.requireAcceptable(req.email());
        if (users.existsByEmailIgnoreCase(req.email())) throw ApiException.conflict("That email is already registered");
        if (users.existsByUsernameIgnoreCase(req.username())) throw ApiException.conflict("That username is taken");
        User user = users.save(new User(req.email().trim(), passwords.encode(req.password()), req.username(), req.displayName().trim()));
        log.info("Account created userId={}", user.getId());
        sendCode(user, Purpose.VERIFY, false);
        return withSession(user, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<MeResponse> login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        limits.attempt("login-ip", http.getRemoteAddr(), rules.loginPerIpPer15Min(), FIFTEEN_MIN, SLOW_DOWN);
        limits.attempt("login-email", req.email(), rules.loginPerEmailPer15Min(), FIFTEEN_MIN, SLOW_DOWN);
        User user = users.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> passwords.matches(req.password(), u.getPasswordHash()))
                .filter(User::isActive)
                .orElse(null);
        if (user == null) {
            // Never log the email or password; a burst of these lines is the signal for a rate limit.
            log.warn("Failed sign-in attempt");
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect");
        }
        log.info("Signed in userId={}", user.getId());
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

    // ---- email verification ----

    @PostMapping("/verify-email")
    @Transactional(noRollbackFor = ApiException.class) // a wrong code must still count as an attempt
    public MeResponse verifyEmail(@AuthenticationPrincipal CurrentUser current, @Valid @RequestBody CodeRequest req) {
        User user = signedIn(current);
        if (!user.isEmailVerified()) {
            codes.consume(user.getId(), Purpose.VERIFY, req.code());
            user.markEmailVerified(Instant.now());
            log.info("Email verified userId={}", user.getId());
        }
        return MeResponse.of(user);
    }

    @PostMapping("/verify-email/resend")
    @Transactional
    public ResponseEntity<Void> resendVerification(@AuthenticationPrincipal CurrentUser current) {
        User user = signedIn(current);
        if (user.isEmailVerified()) throw ApiException.badRequest("Your email is already verified");
        sendCode(user, Purpose.VERIFY, true);
        return ResponseEntity.noContent().build();
    }

    // ---- password reset ----

    /** Always the same reply, so this can't be used to find out which emails have accounts. */
    @PostMapping("/password/forgot")
    @Transactional
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotRequest req, HttpServletRequest http) {
        limits.attempt("forgot-ip", http.getRemoteAddr(), 10, HOUR, SLOW_DOWN);
        users.findByEmailIgnoreCase(req.email().trim()).filter(User::isActive).ifPresent(user -> {
            try {
                sendCode(user, Purpose.RESET, true);
            } catch (ApiException e) {
                // Cooldown or mail failure: stay silent so the reply doesn't reveal the account exists.
                log.info("Reset code not sent userId={} ({})", user.getId(), e.getStatus().value());
            }
        });
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password/reset")
    @Transactional(noRollbackFor = ApiException.class)
    public ResponseEntity<MeResponse> resetPassword(@Valid @RequestBody ResetRequest req, HttpServletRequest http) {
        limits.attempt("reset-ip", http.getRemoteAddr(), rules.loginPerIpPer15Min(), FIFTEEN_MIN, SLOW_DOWN);
        limits.attempt("reset-email", req.email(), rules.loginPerEmailPer15Min(), FIFTEEN_MIN, SLOW_DOWN);
        User user = users.findByEmailIgnoreCase(req.email().trim()).filter(User::isActive)
                .orElseThrow(() -> ApiException.badRequest("That code has expired. Ask for a new one"));
        codes.consume(user.getId(), Purpose.RESET, req.code());
        user.changePassword(passwords.encode(req.password()));
        user.markEmailVerified(Instant.now()); // they just proved they read this inbox
        users.saveAndFlush(user);
        log.info("Password reset userId={}; other sessions revoked", user.getId());
        return withSession(user, HttpStatus.OK);
    }

    // ---- helpers ----

    private void sendCode(User user, Purpose purpose, boolean failLoudly) {
        String code = codes.issue(user.getId(), purpose);
        var msg = purpose == Purpose.VERIFY ? Emails.verifyCode(user.getDisplayName(), code) : Emails.resetCode(user.getDisplayName(), code);
        try {
            mailer.send(user.getEmail(), msg.subject(), msg.text(), msg.html());
        } catch (ApiException e) {
            // At sign-up the account still exists; the reader can ask for a new code from the verify screen.
            if (failLoudly) throw e;
        }
    }

    private User signedIn(CurrentUser current) {
        if (current == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Sign in again");
        return users.findById(current.id()).filter(User::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Sign in again"));
    }

    private ResponseEntity<MeResponse> withSession(User user, HttpStatus status) {
        String token = jwt.issue(user.getId(), user.getSessionVersion());
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie.create(token).toString())
                .body(MeResponse.of(user));
    }
}
