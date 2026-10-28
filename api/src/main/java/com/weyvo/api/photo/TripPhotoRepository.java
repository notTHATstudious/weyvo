package com.weyvo.api.photo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TripPhotoRepository extends JpaRepository<TripPhoto, Long> {

    List<TripPhoto> findByTripId(Long tripId);

    Optional<TripPhoto> findByTripIdAndRoleAndPosition(Long tripId, TripPhoto.Role role, int position);

    /** Candidate covers for feed cards: full-trip covers and the first photo of each short story. */
    @Query("""
            select p from TripPhoto p
            where p.tripId in ?1
              and (p.role = com.weyvo.api.photo.TripPhoto.Role.COVER
                   or (p.role = com.weyvo.api.photo.TripPhoto.Role.SECTION and p.position = 0))""")
    List<TripPhoto> findCoverCandidates(Collection<Long> tripIds);
}
