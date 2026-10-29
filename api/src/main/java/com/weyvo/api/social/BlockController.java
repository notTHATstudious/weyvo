package com.weyvo.api.social;

import com.weyvo.api.admin.ModerationService;
import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.social.BlockService.Blocked;
import com.weyvo.api.social.CommunityController.ReportBody;
import java.util.List;
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
public class BlockController {

    private final BlockService blocks;
    private final ModerationService moderation;

    public BlockController(BlockService blocks, ModerationService moderation) {
        this.blocks = blocks;
        this.moderation = moderation;
    }

    @PutMapping("/api/users/{username}/block")
    public ResponseEntity<Void> block(@AuthenticationPrincipal CurrentUser user, @PathVariable String username) {
        blocks.block(user.id(), username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/users/{username}/block")
    public ResponseEntity<Void> unblock(@AuthenticationPrincipal CurrentUser user, @PathVariable String username) {
        blocks.unblock(user.id(), username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/me/blocked")
    public List<Blocked> blocked(@AuthenticationPrincipal CurrentUser user) {
        return blocks.list(user.id());
    }

    @PostMapping("/api/trips/{tripId}/reports")
    public ResponseEntity<Void> reportTrip(@AuthenticationPrincipal CurrentUser user, @PathVariable long tripId, @RequestBody ReportBody body) {
        moderation.reportTrip(user.id(), tripId, body.reason());
        return ResponseEntity.noContent().build();
    }
}
