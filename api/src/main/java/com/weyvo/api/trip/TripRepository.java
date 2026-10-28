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
              and (?1 is null or t.kind = ?1)
            order by t.publishedAt desc""")
    List<Trip> findPublicFeed(Trip.Kind kind, Pageable page);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select t from Trip t
            where lower(t.owner.username) = lower(?1)
              and t.status = com.weyvo.api.trip.Trip.Status.PUBLISHED
              and t.visibility = com.weyvo.api.trip.Trip.Visibility.PUBLIC
            order by t.publishedAt desc""")
    List<Trip> findPublicByUsername(String username, Pageable page);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select t from Trip t
            where t.owner.id in ?1
              and t.status = com.weyvo.api.trip.Trip.Status.PUBLISHED
              and t.visibility = com.weyvo.api.trip.Trip.Visibility.PUBLIC
            order by t.publishedAt desc""")
    List<Trip> findPublicByOwnerIds(java.util.Collection<Long> ownerIds, Pageable page);

    @EntityGraph(attributePaths = "owner")
    @Query("select t from Trip t where t.id in ?1")
    List<Trip> findAllWithOwnerByIdIn(java.util.Collection<Long> ids);

    @EntityGraph(attributePaths = "owner")
    @Query("select t from Trip t where t.owner.id = ?1 order by t.updatedAt desc")
    List<Trip> findAllByOwner(Long ownerId, Pageable page);
}
