package com.weyvo.api.trip;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Request and response shapes for the trips API. Field limits follow the Phase One template. */
public final class TripDtos {

    private TripDtos() {}

    public record SectionInput(
            @Size(max = 60) String heading,
            @NotBlank @Size(max = 500) String body,
            @Size(max = 120) String photoCaption) {}

    public record TripRequest(
            @NotNull Trip.Kind kind,
            Trip.ShortTag shortTag,
            @NotBlank @Size(max = 60) String title,
            @NotBlank @Size(max = 120) String place,
            LocalDate startDate,
            LocalDate endDate,
            @Size(max = 250) String intro,
            @Size(max = 200) String finalNote,
            @NotNull Trip.Visibility visibility,
            @Size(max = 4) List<@Valid SectionInput> sections,
            @Size(max = 3) List<@NotBlank @Size(max = 120) String> moments) {}

    public record Author(String username, String displayName) {}

    public record Section(String heading, String body, String photoCaption) {}

    /** A single trip. When locked, sections hold only the free share and moments/finalNote are withheld. */
    public record TripView(
            long id, String slug, Trip.Kind kind, Trip.ShortTag shortTag, String title, String place,
            LocalDate startDate, LocalDate endDate, String intro, Author author,
            Trip.Visibility visibility, Trip.Status status, Instant publishedAt,
            List<Section> sections, int totalSections, List<String> moments, String finalNote,
            boolean locked, boolean owner) {}

    public record TripCard(
            long id, String slug, Trip.Kind kind, Trip.ShortTag shortTag, String title, String place,
            Author author, Trip.Visibility visibility, Trip.Status status, Instant publishedAt) {}
}
