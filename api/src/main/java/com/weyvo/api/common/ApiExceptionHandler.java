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
                .collect(Collectors.toMap(f -> f.getField(), f -> String.valueOf(f.getDefaultMessage()), (a, b) -> a));
        log.info("Rejected {} {}: 400 invalid fields {}", request.getMethod(), request.getRequestURI(), fields.keySet());
        return ResponseEntity.badRequest().body(Map.of("error", "Check the highlighted fields", "fields", fields));
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
