package com.weyvo.api.auth;

/** The signed-in user as known from the session token. Set as the security principal. */
public record CurrentUser(long id, String username) {}
