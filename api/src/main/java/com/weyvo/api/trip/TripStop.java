package com.weyvo.api.trip;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** One place inside a full issue: where, and a short note. Its photos are trip photos with role STOP. */
@Embeddable
public class TripStop {

    /** Photos per place; a stop's photos sit at positions stop * PHOTOS .. stop * PHOTOS + PHOTOS - 1. */
    public static final int PHOTOS = 3;

    @Column(name = "place", nullable = false, length = 120)
    private String place;

    @Column(name = "note", length = 300)
    private String note;

    protected TripStop() {}

    public TripStop(String place, String note) {
        this.place = place;
        this.note = note;
    }

    public String getPlace() { return place; }
    public String getNote() { return note; }
}
