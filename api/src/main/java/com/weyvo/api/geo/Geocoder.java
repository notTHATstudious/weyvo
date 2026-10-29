package com.weyvo.api.geo;

import java.util.Optional;

/** Turns free text like "Hampi, Karnataka" into a named point. */
public interface Geocoder {

    record Result(String name, String country, double lat, double lng) {}

    Optional<Result> lookup(String text);
}
