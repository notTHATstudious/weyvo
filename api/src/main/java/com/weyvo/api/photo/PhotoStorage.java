package com.weyvo.api.photo;

import java.util.Optional;

/** Where processed photo bytes live. Keys are generated server-side and never come from the client. */
public interface PhotoStorage {

    void put(String key, byte[] bytes, String contentType);

    Optional<byte[]> get(String key);

    void delete(String key);
}
