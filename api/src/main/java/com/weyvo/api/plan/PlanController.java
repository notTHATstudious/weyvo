package com.weyvo.api.plan;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.plan.PlanService.Usage;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlanController {

    private final PlanService plans;

    public PlanController(PlanService plans) {
        this.plans = plans;
    }

    /** The signed-in user's plan, its limits and current usage, so forms show the real numbers. */
    @GetMapping("/api/me/plan")
    public Usage plan(@AuthenticationPrincipal CurrentUser user) {
        return plans.usage(user.id());
    }
}
