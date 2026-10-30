package com.weyvo.api.trip;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TripRepository extends JpaRepository<Trip, Long> {

    @EntityGraph(attributePaths = {"owner", "sections"})
    Optional<Trip> findBySlug(String slug);

    boolean existsBySlug(String slug);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select t from Trip t
            where t.status = com.weyvo.api.trip.Trip.Status.PUBLISHED
              and t.visibility = com.weyvo.api.trip.Trip.Visibility.PUBLIC
              and t.removedAt is null
              and t.owner.status = 'ACTIVE'
              and (?1 is null or t.kind = ?1)
            order by t.publishedAt desc""")
    List<Trip> findPublicFeed(Trip.Kind kind, Pageable page);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select t from Trip t
            where lower(t.owner.username) = lower(?1)
              and t.status = com.weyvo.api.trip.Trip.Status.PUBLISHED
              and t.visibility = com.weyvo.api.trip.Trip.Visibility.PUBLIC
              and t.removedAt is null
              and t.owner.status = 'ACTIVE'
            order by t.publishedAt desc""")
    List<Trip> findPublicByUsername(String username, Pageable page);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select t from Trip t
            where t.owner.id in ?1
              and t.status = com.weyvo.api.trip.Trip.Status.PUBLISHED
              and t.visibility = com.weyvo.api.trip.Trip.Visibility.PUBLIC
              and t.removedAt is null
              and t.owner.status = 'ACTIVE'
            order by t.publishedAt desc""")
    List<Trip> findPublicByOwnerIds(java.util.Collection<Long> ownerIds, Pageable page);

    // Native query: entity graphs aren't supported here; authors load lazily inside the read transaction.
    @Query(value = """
            SELECT t.* FROM trips t
            WHERE t.place_id = ?1 AND t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL
              AND EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id AND u.status = 'ACTIVE')
            ORDER BY t.published_at DESC LIMIT 50""", nativeQuery = true)
    List<Trip> findPublicByPlace(long placeId);

    /** Public stories whose title or place contains the pattern (already escaped, with % around it). */
    @Query(value = """
            SELECT t.id FROM trips t JOIN users o ON o.id = t.owner_id AND o.status = 'ACTIVE'
            WHERE t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL
              AND (t.title ILIKE ?1 ESCAPE '\\' OR t.place ILIKE ?1 ESCAPE '\\')
            ORDER BY t.published_at DESC LIMIT 12""", nativeQuery = true)
    List<Long> searchPublicIds(String pattern);

    /**
     * The week's most loved public stories: reactions count once and comments twice, over the last 7 days.
     * New stories with no activity yet still qualify, so the list isn't empty on a quiet week.
     */
    @Query(value = """
            SELECT t.id FROM trips t
            JOIN users o ON o.id = t.owner_id AND o.status = 'ACTIVE'
            LEFT JOIN (SELECT trip_id, count(*) AS n FROM trip_reactions
                       WHERE created_at > now() - interval '7 days' GROUP BY trip_id) r ON r.trip_id = t.id
            LEFT JOIN (SELECT trip_id, count(*) AS n FROM trip_comments
                       WHERE created_at > now() - interval '7 days' AND status = 'VISIBLE' GROUP BY trip_id) c ON c.trip_id = t.id
            WHERE t.status = 'PUBLISHED' AND t.visibility = 'PUBLIC' AND t.removed_at IS NULL
              AND (COALESCE(r.n, 0) + COALESCE(c.n, 0) > 0 OR t.published_at > now() - interval '7 days')
            ORDER BY COALESCE(r.n, 0) + 2 * COALESCE(c.n, 0) DESC, t.published_at DESC
            LIMIT 10""", nativeQuery = true)
    List<Long> findTopThisWeekIds();

    @EntityGraph(attributePaths = "owner")
    @Query("select t from Trip t where t.id in ?1")
    List<Trip> findAllWithOwnerByIdIn(java.util.Collection<Long> ids);

    @EntityGraph(attributePaths = "owner")
    @Query("select t from Trip t where t.owner.id = ?1 order by t.updatedAt desc")
    List<Trip> findAllByOwner(Long ownerId, Pageable page);
}
