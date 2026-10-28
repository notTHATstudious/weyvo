package com.weyvo.api.trip;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "trip_sections")
public class TripSection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Column(nullable = false)
    private short position;

    private String heading;

    @Column(nullable = false)
    private String body;

    @Column(name = "photo_caption")
    private String photoCaption;

    protected TripSection() {}

    public TripSection(int position, String heading, String body, String photoCaption) {
        this.position = (short) position;
        this.heading = heading;
        this.body = body;
        this.photoCaption = photoCaption;
    }

    void attachTo(Trip trip) {
        this.trip = trip;
    }

    public int getPosition() { return position; }
    public String getHeading() { return heading; }
    public String getBody() { return body; }
    public String getPhotoCaption() { return photoCaption; }
}
