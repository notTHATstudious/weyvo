package com.weyvo.api.points;

import com.weyvo.api.auth.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PointsController {

    private final PointsService points;

    public PointsController(PointsService points) {
        this.points = points;
    }

    /** Your own Wey points; nobody else's are ever shown. */
    @GetMapping("/api/me/points")
    public PointsService.Balance mine(@AuthenticationPrincipal CurrentUser user) {
        return points.balance(user.id());
    }
}
