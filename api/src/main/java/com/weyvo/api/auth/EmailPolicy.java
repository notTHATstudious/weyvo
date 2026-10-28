package com.weyvo.api.auth;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Hashtable;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import javax.naming.CommunicationException;
import javax.naming.NameNotFoundException;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.InitialDirContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Sign-up email rules: no throwaway inboxes, and the domain must be able to receive mail (MX, or A as the
 * RFC 5321 fallback). This proves the domain is real, not the mailbox; a verification link does that later.
 */
@Component
public class EmailPolicy {

    private static final Logger log = LoggerFactory.getLogger(EmailPolicy.class);

    private final Set<String> disposable;
    private final boolean checkMailDomain;

    public EmailPolicy(AppProperties props) {
        this.disposable = loadDisposableDomains();
        this.checkMailDomain = props.signup().checkMailDomain();
    }

    public void requireAcceptable(String email) {
        String domain = domainOf(email);
        if (isDisposable(domain)) {
            throw ApiException.badRequest("Use your real email address. Temporary inboxes aren't allowed");
        }
        if (checkMailDomain && !acceptsMail(domain)) {
            throw ApiException.badRequest("That email domain can't receive mail. Check for typos");
        }
    }

    boolean isDisposable(String domain) {
        for (String d = domain; d.contains("."); d = d.substring(d.indexOf('.') + 1)) {
            if (disposable.contains(d)) return true;
        }
        return false;
    }

    private boolean acceptsMail(String domain) {
        var env = new Hashtable<String, String>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", "2000");
        env.put("com.sun.jndi.dns.timeout.retries", "1");
        try {
            var ctx = new InitialDirContext(env);
            try {
                Attribute mx = ctx.getAttributes(domain, new String[] {"MX"}).get("MX");
                if (mx != null && mx.size() > 0) {
                    // "0 ." is a null MX (RFC 7505): the domain explicitly accepts no mail.
                    return !(mx.size() == 1 && String.valueOf(mx.get()).trim().matches("0\\s+\\.?"));
                }
                Attribute a = ctx.getAttributes(domain, new String[] {"A"}).get("A");
                return a != null && a.size() > 0;
            } finally {
                ctx.close();
            }
        } catch (NameNotFoundException e) {
            return false;
        } catch (CommunicationException e) {
            // DNS itself is unreachable: don't block every sign-up on our own network trouble.
            log.warn("DNS check unavailable for sign-up domain; allowing", e);
            return true;
        } catch (NamingException e) {
            return false;
        }
    }

    private static String domainOf(String email) {
        int at = email.lastIndexOf('@');
        return email.substring(at + 1).trim().toLowerCase(Locale.ROOT);
    }

    private static Set<String> loadDisposableDomains() {
        var file = new ClassPathResource("disposable-email-domains.txt");
        try (var reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines()
                    .map(String::trim)
                    .filter(l -> !l.isEmpty() && !l.startsWith("#"))
                    .map(l -> l.toLowerCase(Locale.ROOT))
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
