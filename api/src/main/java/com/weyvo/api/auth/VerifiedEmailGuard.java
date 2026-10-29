package com.weyvo.api.auth;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Unverified accounts can read everything but change nothing (post, upload, react, follow, ask) until they
 * verify their email. Account endpoints under /api/auth stay open so they can verify, reset or sign out.
 */
@Configuration
public class VerifiedEmailGuard implements WebMvcConfigurer, HandlerInterceptor {

    private final boolean required;

    public VerifiedEmailGuard(AppProperties props) {
        this.required = props.auth().requireVerifiedEmail();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/**").excludePathPatterns("/api/auth/**");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!required || "GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod()) || "OPTIONS".equals(request.getMethod())) {
            return true;
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CurrentUser user && !user.emailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Verify your email to do that");
        }
        return true;
    }
}
