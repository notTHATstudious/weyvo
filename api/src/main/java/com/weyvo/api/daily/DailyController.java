package com.weyvo.api.daily;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.daily.DailyService.Quiz;
import com.weyvo.api.daily.DailyService.Today;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DailyController {

    public record Guess(String option) {}

    public record AnswerBody(String text, String place) {}

    public record Reminder(boolean on) {}

    private final DailyService daily;

    public DailyController(DailyService daily) {
        this.daily = daily;
    }

    /** The Today card. Signed-out readers see the quiz and question without playing. */
    @GetMapping("/api/daily")
    public Today today(@AuthenticationPrincipal CurrentUser user) {
        return daily.today(user == null ? null : user.id());
    }

    @PostMapping("/api/daily/guess")
    public Quiz guess(@AuthenticationPrincipal CurrentUser user, @RequestBody Guess body) {
        return daily.guess(user.id(), body == null ? null : body.option());
    }

    @PostMapping("/api/daily/answer")
    public ResponseEntity<Void> answer(@AuthenticationPrincipal CurrentUser user, @RequestBody AnswerBody body) {
        daily.answer(user.id(), body == null ? null : body.text(), body == null ? null : body.place());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/api/me/daily-reminder")
    public ResponseEntity<Void> reminder(@AuthenticationPrincipal CurrentUser user, @RequestBody Reminder body) {
        daily.reminder(user.id(), body != null && body.on());
        return ResponseEntity.noContent().build();
    }
}
