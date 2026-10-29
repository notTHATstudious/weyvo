package com.weyvo.api.user;

/** Where a user's profile picture is served. Null when they haven't uploaded one. */
public final class Avatars {

    private Avatars() {}

    public static String url(String username, Integer version) {
        return version == null ? null : "/api/users/" + username + "/avatar?v=" + version;
    }
}
