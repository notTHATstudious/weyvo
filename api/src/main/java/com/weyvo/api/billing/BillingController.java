package com.weyvo.api.billing;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.billing.BillingService.Order;
import com.weyvo.api.billing.BillingService.Period;
import com.weyvo.api.billing.BillingService.Plans;
import com.weyvo.api.plan.PlanService;
import com.weyvo.api.plan.PlanService.Usage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BillingController {

    public record OrderRequest(@NotNull Period period) {}

    public record VerifyRequest(@NotBlank String orderId, @NotBlank String paymentId, @NotBlank String signature) {}

    private final BillingService billing;
    private final PlanService plans;

    public BillingController(BillingService billing, PlanService plans) {
        this.billing = billing;
        this.plans = plans;
    }

    @GetMapping("/api/billing/plans")
    public Plans plans() {
        return billing.plans();
    }

    @PostMapping("/api/billing/orders")
    public Order order(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody OrderRequest req) {
        return billing.createOrder(user.id(), req.period());
    }

    /** After a successful checkout: returns the updated plan. */
    @PostMapping("/api/billing/verify")
    public Usage verify(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody VerifyRequest req) {
        billing.verifyCheckout(user.id(), req.orderId(), req.paymentId(), req.signature());
        return plans.usage(user.id());
    }

    /** Razorpay calls this directly; the body is taken raw so the signature can be checked exactly. */
    @PostMapping("/api/billing/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String body, @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        billing.webhook(body, signature);
        return ResponseEntity.ok().build();
    }
}
