package com.weyvo.api.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String username;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    private String bio;

    @Column(nullable = false)
    private String status = "ACTIVE";

    public enum Plan { FREE, PREMIUM }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Plan plan = Plan.FREE;

    @Column(name = "plan_expires_at")
    private Instant planExpiresAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {}

    public User(String email, String passwordHash, String username, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.username = username;
        this.displayName = displayName;
    }

    public boolean isActive() {
        return "ACTIVE".equals(status);
    }

    /** Premium counts only while it hasn't expired; a lapsed subscription falls back to Free. */
    public Plan effectivePlan(Instant now) {
        return plan == Plan.PREMIUM && (planExpiresAt == null || planExpiresAt.isAfter(now)) ? Plan.PREMIUM : Plan.FREE;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getUsername() { return username; }
    public String getDisplayName() { return displayName; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
