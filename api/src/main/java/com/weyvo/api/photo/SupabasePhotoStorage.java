package com.weyvo.api.photo;

import com.weyvo.api.config.AppProperties;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Supabase Storage in a private bucket. The service key stays on the server; browsers only ever
 * receive photos through the API, which applies trip visibility rules.
 */
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "supabase")
public class SupabasePhotoStorage implements PhotoStorage {

    private final RestClient http;
    private final String bucket;

    public SupabasePhotoStorage(AppProperties props, RestClient.Builder builder) {
        var cfg = props.storage();
        this.bucket = cfg.supabaseBucket();
        this.http = builder
                .baseUrl(cfg.supabaseUrl() + "/storage/v1")
                .defaultHeader("Authorization", "Bearer " + cfg.supabaseServiceKey())
                .defaultHeader("apikey", cfg.supabaseServiceKey())
                .build();
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        http.post().uri("/object/{bucket}/{key}", bucket, key)
                .header("x-upsert", "true")
                .contentType(MediaType.parseMediaType(contentType))
                .body(bytes)
                .retrieve()
                .toBodilessEntity();
    }

    @Override
    public Optional<byte[]> get(String key) {
        try {
            return Optional.ofNullable(http.get().uri("/object/{bucket}/{key}", bucket, key).retrieve().body(byte[].class));
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND || e.getStatusCode() == HttpStatus.BAD_REQUEST) return Optional.empty();
            throw e;
        }
    }

    @Override
    public void delete(String key) {
        http.delete().uri("/object/{bucket}/{key}", bucket, key).retrieve().toBodilessEntity();
    }
}
