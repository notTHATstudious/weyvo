package com.weyvo.api.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.weyvo.api.config.AppProperties;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * OpenStreetMap's Nominatim search. Calls are spaced at least 1.1 s apart and carry an identifying
 * User-Agent, as its usage policy requires. Callers cache results, so each place is looked up once.
 */
@Component
public class NominatimGeocoder implements Geocoder {

    private static final Logger log = LoggerFactory.getLogger(NominatimGeocoder.class);
    private static final long MIN_GAP_MS = 1100;

    private final RestClient http;
    private long lastCall;

    public NominatimGeocoder(AppProperties props, RestClient.Builder builder) {
        this.http = builder.baseUrl(props.geo().nominatimUrl()).defaultHeader("User-Agent", props.geo().userAgent()).build();
    }

    @Override
    public synchronized Optional<Result> lookup(String text) {
        waitTurn();
        try {
            JsonNode results = http.get()
                    .uri(u -> u.path("/search").queryParam("q", text).queryParam("format", "jsonv2").queryParam("limit", 1)
                            .queryParam("addressdetails", 1).queryParam("accept-language", "en").build())
                    .retrieve()
                    .body(JsonNode.class);
            if (results == null || !results.isArray() || results.isEmpty()) return Optional.empty();
            JsonNode r = results.get(0);
            String name = r.path("name").asText("");
            if (name.isBlank()) name = r.path("display_name").asText("").split(",")[0].trim();
            return Optional.of(new Result(name, r.path("address").path("country").asText(null),
                    r.path("lat").asDouble(), r.path("lon").asDouble()));
        } catch (RestClientException e) {
            log.warn("Place lookup failed ({})", e.getClass().getSimpleName());
            throw e;
        }
    }

    private void waitTurn() {
        long wait = lastCall + MIN_GAP_MS - System.currentTimeMillis();
        if (wait > 0) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastCall = System.currentTimeMillis();
    }
}
