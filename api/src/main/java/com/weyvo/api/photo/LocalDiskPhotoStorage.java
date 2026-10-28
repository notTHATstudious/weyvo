package com.weyvo.api.photo;

import com.weyvo.api.config.AppProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Development storage on the local disk. */
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "local", matchIfMissing = true)
public class LocalDiskPhotoStorage implements PhotoStorage {

    private final Path root;

    public LocalDiskPhotoStorage(AppProperties props) {
        this.root = Path.of(props.storage().localDir()).toAbsolutePath().normalize();
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        try {
            Path file = resolve(key);
            Files.createDirectories(file.getParent());
            Files.write(file, bytes);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public Optional<byte[]> get(String key) {
        try {
            return Optional.of(Files.readAllBytes(resolve(key)));
        } catch (NoSuchFileException e) {
            return Optional.empty();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Defence in depth: keys are server-generated, but never let one escape the storage root. */
    private Path resolve(String key) {
        Path file = root.resolve(key).normalize();
        if (!file.startsWith(root)) throw new IllegalArgumentException("Invalid storage key");
        return file;
    }
}
