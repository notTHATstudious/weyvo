package com.weyvo.api.photo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "trip_photos")
public class TripPhoto {

    /** COVER is a full trip's cover; SECTION photos sit with the story section at the same position. */
    public enum Role { COVER, SECTION }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trip_id", nullable = false)
    private Long tripId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private int position;

    @Column(name = "large_key", nullable = false)
    private String largeKey;

    @Column(name = "thumb_key", nullable = false)
    private String thumbKey;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    protected TripPhoto() {}

    public TripPhoto(Long tripId, Role role, int position, String largeKey, String thumbKey, int width, int height, int sizeBytes) {
        this.tripId = tripId;
        this.role = role;
        this.position = position;
        this.largeKey = largeKey;
        this.thumbKey = thumbKey;
        this.width = width;
        this.height = height;
        this.sizeBytes = sizeBytes;
    }

    public Long getId() { return id; }
    public Long getTripId() { return tripId; }
    public Role getRole() { return role; }
    public int getPosition() { return position; }
    public String getLargeKey() { return largeKey; }
    public String getThumbKey() { return thumbKey; }
    public int getWidth() { return width; }
    public int getHeight() { return height; }
}
