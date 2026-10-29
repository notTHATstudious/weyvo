package com.weyvo.api.auth;

/**
 * The signed-in user, rebuilt from the database on every request: an account that was suspended, or
 * whose sessions were revoked by a password reset, stops being signed in immediately.
 */
public record CurrentUser(long id, String username, boolean emailVerified, boolean admin) {}
