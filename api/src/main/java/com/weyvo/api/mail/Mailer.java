package com.weyvo.api.mail;

/** Sends transactional email. */
public interface Mailer {

    void send(String to, String subject, String text, String html);
}
