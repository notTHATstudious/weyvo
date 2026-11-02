package com.weyvo.api.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /**
     * Rejected requests are logged with the path, status and our own message or field names: never what
     * the user typed. 404s are skipped because they're routine (and private content returns 404 on purpose).
     */
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> handle(ApiException e, HttpServletRequest request) {
        if (e.getStatus() != HttpStatus.NOT_FOUND) {
            log.info("Rejected {} {}: {} {}", request.getMethod(), request.getRequestURI(), e.getStatus().value(), e.getMessage());
        }
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> handle(MethodArgumentNotValidException e, HttpServletRequest request) {
        Map<String, String> fields = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(f -> f.getField(), ApiExceptionHandler::friendly, (a, b) -> a));
        log.info("Rejected {} {}: 400 invalid fields {}", request.getMethod(), request.getRequestURI(), fields.keySet());
        return ResponseEntity.badRequest().body(Map.of("error", "A few details are missing. Fill in the boxes marked in red", "fields", fields));
    }

    /** What each field is called in a sentence, for "Please enter …". */
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("displayName", "your name"), Map.entry("username", "a username"), Map.entry("email", "your email"),
            Map.entry("password", "a password"), Map.entry("newPassword", "a new password"), Map.entry("currentPassword", "your current password"),
            Map.entry("code", "the 6-digit code"), Map.entry("title", "a title"), Map.entry("place", "a destination"),
            Map.entry("body", "some text"), Map.entry("reason", "a reason"));

    /**
     * Our own messages pass through; the validator's defaults ("must not be blank", "size must be between…")
     * become plain sentences.
     */
    static String friendly(org.springframework.validation.FieldError f) {
        String code = f.getCode() == null ? "" : f.getCode();
        String label = LABELS.getOrDefault(f.getField().replaceAll(".*\\.", ""), "this");
        String message = String.valueOf(f.getDefaultMessage());
        boolean ours = !(message.startsWith("must ") || message.startsWith("size must"));
        if (ours) return message;
        return switch (code) {
            case "NotBlank", "NotNull", "NotEmpty" -> "Please enter " + label;
            case "Email" -> "That doesn't look like an email address. Check for typos";
            case "Size" -> {
                var m = java.util.regex.Pattern.compile("between (\\d+) and (\\d+)").matcher(message);
                yield !m.find() ? "That's not the right length"
                        : m.group(1).equals("0") ? "Keep it to " + m.group(2) + " characters or fewer"
                        : "Use " + m.group(1) + " to " + m.group(2) + " characters";
            }
            case "Pattern" -> "Some characters here aren't allowed";
            default -> "Check this field";
        };
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, Object>> handle(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "That photo is over 15 MB. Choose a smaller one"));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    ResponseEntity<Map<String, Object>> handle(MissingServletRequestPartException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "Choose a photo to upload"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Map<String, Object>> handle(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid value for " + e.getName()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, Object>> handle(HttpMessageNotReadableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Malformed request body"));
    }
}
