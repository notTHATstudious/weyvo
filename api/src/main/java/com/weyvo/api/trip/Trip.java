package com.weyvo.api.trip;

import com.weyvo.api.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "trips")
public class Trip {

    public enum Kind { FULL, SHORT }
    public enum ShortTag { WEEKEND, ONE_NIGHT, LONG_DRIVE, DAY_TRIP }
    public enum Visibility { PUBLIC, UNLISTED, PRIVATE }
    public enum Status { DRAFT, PUBLISHED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false, unique = true)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "short_tag")
    private ShortTag shortTag;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String place;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    private String intro;

    @Column(name = "final_note")
    private String finalNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Visibility visibility = Visibility.PRIVATE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.DRAFT;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "published_at")
    private Instant publishedAt;

    /** Set when an admin takes the story down after reports. Only its author still sees it. */
    @Column(name = "removed_at", insertable = false, updatable = false)
    private Instant removedAt;

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<TripSection> sections = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "trip_moments", joinColumns = @JoinColumn(name = "trip_id"))
    @OrderColumn(name = "position")
    @Column(name = "text", nullable = false)
    private List<String> moments = new ArrayList<>();

    protected Trip() {}

    public Trip(User owner, String slug, Kind kind) {
        this.owner = owner;
        this.slug = slug;
        this.kind = kind;
    }

    public boolean isOwnedBy(Long userId) {
        return userId != null && owner.getId().equals(userId);
    }

    /**
     * Drafts, private and removed trips exist only for their owner; published public and unlisted trips for anyone,
     * unless the author's account is suspended.
     */
    public boolean isVisibleTo(Long userId) {
        return isOwnedBy(userId) || (status == Status.PUBLISHED && visibility != Visibility.PRIVATE && removedAt == null && owner.isActive());
    }

    public boolean isRemoved() { return removedAt != null; }

    public void replaceSections(List<TripSection> next) {
        sections.clear();
        sections.addAll(next);
        next.forEach(s -> s.attachTo(this));
    }

    public void replaceMoments(List<String> next) {
        moments.clear();
        moments.addAll(next);
    }

    public void publish() {
        if (status != Status.PUBLISHED) {
            status = Status.PUBLISHED;
            publishedAt = Instant.now();
        }
        touch();
    }

    public void touch() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public String getSlug() { return slug; }
    public Kind getKind() { return kind; }
    public ShortTag getShortTag() { return shortTag; }
    public void setShortTag(ShortTag shortTag) { this.shortTag = shortTag; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getPlace() { return place; }
    public void setPlace(String place) { this.place = place; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public String getIntro() { return intro; }
    public void setIntro(String intro) { this.intro = intro; }
    public String getFinalNote() { return finalNote; }
    public void setFinalNote(String finalNote) { this.finalNote = finalNote; }
    public Visibility getVisibility() { return visibility; }
    public void setVisibility(Visibility visibility) { this.visibility = visibility; }
    public Status getStatus() { return status; }
    public Instant getPublishedAt() { return publishedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<TripSection> getSections() { return sections; }
    public List<String> getMoments() { return moments; }
}
