package com.weyvo.api.social;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.social.NotificationService.Item;
import com.weyvo.api.social.QuestionService.Question;
import com.weyvo.api.social.QuestionService.Questions;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CommunityController {

    public record TextBody(String text) {}
    public record ReportBody(String reason) {}

    private final QuestionService questions;
    private final NotificationService notifications;
    private final CommentService comments;

    public CommunityController(QuestionService questions, NotificationService notifications, CommentService comments) {
        this.questions = questions;
        this.notifications = notifications;
        this.comments = comments;
    }

    // ---- Ask the traveller ----

    @GetMapping("/api/trips/{tripId}/questions")
    public Questions list(@PathVariable long tripId, @AuthenticationPrincipal CurrentUser user) {
        return questions.list(tripId, user == null ? null : user.id());
    }

    @PostMapping("/api/trips/{tripId}/questions")
    public ResponseEntity<Question> ask(@AuthenticationPrincipal CurrentUser user, @PathVariable long tripId, @RequestBody TextBody body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(questions.ask(user.id(), tripId, body.text()));
    }

    @PutMapping("/api/questions/{questionId}/answer")
    public Question answer(@AuthenticationPrincipal CurrentUser user, @PathVariable long questionId, @RequestBody TextBody body) {
        return questions.answer(user.id(), questionId, body.text());
    }

    @PutMapping("/api/questions/{questionId}/hidden")
    public Question hide(@AuthenticationPrincipal CurrentUser user, @PathVariable long questionId) {
        return questions.setHidden(user.id(), questionId, true);
    }

    @DeleteMapping("/api/questions/{questionId}/hidden")
    public Question unhide(@AuthenticationPrincipal CurrentUser user, @PathVariable long questionId) {
        return questions.setHidden(user.id(), questionId, false);
    }

    @DeleteMapping("/api/questions/{questionId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser user, @PathVariable long questionId) {
        questions.delete(user.id(), questionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/questions/{questionId}/reports")
    public ResponseEntity<Void> report(@AuthenticationPrincipal CurrentUser user, @PathVariable long questionId, @RequestBody ReportBody body) {
        questions.report(user.id(), questionId, body.reason());
        return ResponseEntity.noContent().build();
    }

    // ---- Comments ----

    public record CommentBody(String text, Long parentId) {}

    @GetMapping("/api/trips/{tripId}/comments")
    public CommentService.Comments comments(@PathVariable long tripId, @AuthenticationPrincipal CurrentUser user) {
        return comments.list(tripId, user == null ? null : user.id());
    }

    @PostMapping("/api/trips/{tripId}/comments")
    public ResponseEntity<CommentService.Comment> comment(@AuthenticationPrincipal CurrentUser user, @PathVariable long tripId, @RequestBody CommentBody body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(comments.post(user.id(), tripId, body.text(), body.parentId()));
    }

    @PutMapping("/api/comments/{commentId}/hidden")
    public CommentService.Comment hideComment(@AuthenticationPrincipal CurrentUser user, @PathVariable long commentId) {
        return comments.setHidden(user.id(), commentId, true);
    }

    @DeleteMapping("/api/comments/{commentId}/hidden")
    public CommentService.Comment unhideComment(@AuthenticationPrincipal CurrentUser user, @PathVariable long commentId) {
        return comments.setHidden(user.id(), commentId, false);
    }

    @DeleteMapping("/api/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@AuthenticationPrincipal CurrentUser user, @PathVariable long commentId) {
        comments.delete(user.id(), commentId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/comments/{commentId}/reports")
    public ResponseEntity<Void> reportComment(@AuthenticationPrincipal CurrentUser user, @PathVariable long commentId, @RequestBody ReportBody body) {
        comments.report(user.id(), commentId, body.reason());
        return ResponseEntity.noContent().build();
    }

    // ---- Notifications ----

    @GetMapping("/api/me/notifications")
    public List<Item> inbox(@AuthenticationPrincipal CurrentUser user) {
        return notifications.inbox(user.id(), 50);
    }

    @GetMapping("/api/me/notifications/unread-count")
    public Map<String, Integer> unread(@AuthenticationPrincipal CurrentUser user) {
        return Map.of("count", notifications.unreadCount(user.id()));
    }

    @PostMapping("/api/me/notifications/read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal CurrentUser user) {
        notifications.markAllRead(user.id());
        return ResponseEntity.noContent().build();
    }
}
