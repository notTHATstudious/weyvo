package com.weyvo.api.mail;

import org.springframework.web.util.HtmlUtils;

/** Plain-text and HTML bodies for transactional email. User-supplied text is HTML-escaped. */
public final class Emails {

    private Emails() {}

    public record Message(String subject, String text, String html) {}

    public static Message verifyCode(String name, String code) {
        String subject = "Your Weyvo code: " + code;
        String text = "Hi " + name + ",\n\nYour Weyvo verification code is " + code + ".\nIt expires in 10 minutes.\n\n"
                + "If you didn't sign up for Weyvo, you can ignore this email.";
        return new Message(subject, text, layout(name, "Welcome to Weyvo. Enter this code to verify your email:", code,
                "It expires in 10 minutes. If you didn't sign up, you can ignore this email."));
    }

    public static Message resetCode(String name, String code) {
        String subject = "Reset your Weyvo password: " + code;
        String text = "Hi " + name + ",\n\nYour password reset code is " + code + ".\nIt expires in 10 minutes.\n\n"
                + "If you didn't ask to reset your password, ignore this email. Your password stays the same.";
        return new Message(subject, text, layout(name, "Use this code to reset your password:", code,
                "It expires in 10 minutes. If you didn't ask for this, ignore this email; your password stays the same."));
    }

    private static String layout(String name, String intro, String code, String footer) {
        String safeName = HtmlUtils.htmlEscape(name);
        return """
                <div style="font-family:Inter,Arial,sans-serif;background:#F3EEE5;padding:32px 16px;color:#1C1B18">
                  <div style="max-width:440px;margin:0 auto;background:#FBF8F2;border-radius:16px;padding:28px">
                    <p style="font-size:22px;font-weight:800;margin:0 0 18px">weyvo<span style="color:#E3A23B">.</span></p>
                    <p style="margin:0 0 12px">Hi %s,</p>
                    <p style="margin:0 0 18px">%s</p>
                    <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 18px">%s</p>
                    <p style="font-size:13px;color:#5E5A52;margin:0">%s</p>
                  </div>
                </div>""".formatted(safeName, intro, code, footer);
    }
}
