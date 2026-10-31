package com.weyvo.api.config;

import io.sentry.SentryOptions;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Error reports never carry a story's slug: an unlisted story's address is its secret link. Applies to the
 * request address, the transaction name and log breadcrumbs. Query strings are dropped too.
 */
@Configuration
public class SentryScrubbing {

    private static final Pattern SLUG = Pattern.compile("(/(?:api/)?(?:trips|share)/)(?!\\d+(?:/|$))[^/\\s?#\"')]+");

    static String scrub(String s) {
        if (s == null) return null;
        String noQuery = s.split("[?#]", 2)[0];
        return SLUG.matcher(noQuery).replaceAll("$1:slug");
    }

    @Bean
    SentryOptions.BeforeSendCallback sentryBeforeSend() {
        return (event, hint) -> {
            if (event.getRequest() != null) {
                event.getRequest().setUrl(scrub(event.getRequest().getUrl()));
                event.getRequest().setQueryString(null);
            }
            if (event.getTransaction() != null) event.setTransaction(scrub(event.getTransaction()));
            return event;
        };
    }

    @Bean
    SentryOptions.BeforeBreadcrumbCallback sentryBeforeBreadcrumb() {
        return (crumb, hint) -> {
            if (crumb.getMessage() != null) crumb.setMessage(SLUG.matcher(crumb.getMessage()).replaceAll("$1:slug"));
            return crumb;
        };
    }
}
