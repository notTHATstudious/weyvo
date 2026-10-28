package com.weyvo.api.photo;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.trip.StoryGate;
import com.weyvo.api.trip.Trip;
import com.weyvo.api.trip.TripRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class PhotoService {

    public enum Size { LARGE, THUMB }

    public record PhotoRef(long id, String url, String thumbUrl, int width, int height) {
        static PhotoRef of(TripPhoto p) {
            return new PhotoRef(p.getId(), "/api/photos/" + p.getId() + "/large", "/api/photos/" + p.getId() + "/thumb", p.getWidth(), p.getHeight());
        }
    }

    private final TripPhotoRepository photos;
    private final TripRepository trips;
    private final PhotoStorage storage;
    private final ImageProcessor processor;
    private final StoryGate gate;

    public PhotoService(TripPhotoRepository photos, TripRepository trips, PhotoStorage storage, ImageProcessor processor, StoryGate gate) {
        this.photos = photos;
        this.trips = trips;
        this.storage = storage;
        this.processor = processor;
        this.gate = gate;
    }

    // ---- writes (owner only) ----

    /** Puts a processed photo in a trip slot, replacing whatever was there. */
    @Transactional
    public PhotoRef upload(long ownerId, long tripId, TripPhoto.Role role, int position, byte[] upload) {
        Trip trip = trips.findById(tripId).filter(t -> t.isOwnedBy(ownerId)).orElseThrow(ApiException::notFound);
        if (role == TripPhoto.Role.COVER) {
            if (trip.getKind() != Trip.Kind.FULL) throw ApiException.badRequest("Short stories use their first photo as the cover");
            position = 0;
        } else if (position < 0 || position >= trip.getSections().size()) {
            throw ApiException.badRequest("Add the caption or section before its photo");
        }

        ImageProcessor.Processed img = processor.process(upload);
        String base = "trips/" + tripId + "/" + UUID.randomUUID();
        storage.put(base + "-large.jpg", img.large(), "image/jpeg");
        storage.put(base + "-thumb.jpg", img.thumb(), "image/jpeg");

        photos.findByTripIdAndRoleAndPosition(tripId, role, position).ifPresent(old -> {
            photos.delete(old);
            photos.flush();
            deleteFilesAfterCommit(List.of(old));
        });
        TripPhoto saved = photos.save(new TripPhoto(tripId, role, position, base + "-large.jpg", base + "-thumb.jpg",
                img.width(), img.height(), img.large().length + img.thumb().length));
        trip.touch();
        return PhotoRef.of(saved);
    }

    @Transactional
    public void delete(long ownerId, long tripId, long photoId) {
        trips.findById(tripId).filter(t -> t.isOwnedBy(ownerId)).orElseThrow(ApiException::notFound);
        TripPhoto photo = photos.findById(photoId).filter(p -> p.getTripId() == tripId).orElseThrow(ApiException::notFound);
        photos.delete(photo);
        deleteFilesAfterCommit(List.of(photo));
    }

    /** Removes section photos whose section no longer exists. Caller has already checked ownership. */
    @Transactional
    public void pruneSections(long tripId, int sectionCount) {
        List<TripPhoto> gone = photos.findByTripId(tripId).stream()
                .filter(p -> p.getRole() == TripPhoto.Role.SECTION && p.getPosition() >= sectionCount)
                .toList();
        photos.deleteAll(gone);
        deleteFilesAfterCommit(gone);
    }

    /** Storage cleanup for a trip being deleted (rows go with the trip's ON DELETE CASCADE). */
    @Transactional
    public void deleteAllFor(long tripId) {
        deleteFilesAfterCommit(photos.findByTripId(tripId));
    }

    // ---- reads ----

    /** Photo bytes if the viewer may see this photo; 404 otherwise, exactly like a missing photo. */
    @Transactional(readOnly = true)
    public byte[] read(long photoId, Size size, Long viewerId) {
        TripPhoto photo = photos.findById(photoId).orElseThrow(ApiException::notFound);
        Trip trip = trips.findById(photo.getTripId()).orElseThrow(ApiException::notFound);
        if (!trip.isVisibleTo(viewerId)) throw ApiException.notFound();
        if (photo.getRole() == TripPhoto.Role.SECTION && gate.locked(trip, viewerId)
                && photo.getPosition() >= gate.freeCount(trip.getSections().size())) {
            throw ApiException.notFound();
        }
        return storage.get(size == Size.LARGE ? photo.getLargeKey() : photo.getThumbKey()).orElseThrow(ApiException::notFound);
    }

    public record TripPhotos(PhotoRef cover, Map<Integer, PhotoRef> sections) {}

    @Transactional(readOnly = true)
    public TripPhotos forTrip(Trip trip) {
        Map<Integer, PhotoRef> sections = new HashMap<>();
        PhotoRef cover = null;
        for (TripPhoto p : photos.findByTripId(trip.getId())) {
            if (p.getRole() == TripPhoto.Role.COVER) cover = PhotoRef.of(p);
            else sections.put(p.getPosition(), PhotoRef.of(p));
        }
        if (cover == null && trip.getKind() == Trip.Kind.SHORT) cover = sections.get(0);
        return new TripPhotos(cover, sections);
    }

    /** Cover per trip id for feed cards. Full trips use their cover; short stories their first photo. */
    @Transactional(readOnly = true)
    public Map<Long, PhotoRef> coversFor(Collection<Trip> list) {
        Map<Long, Trip.Kind> kinds = new HashMap<>();
        list.forEach(t -> kinds.put(t.getId(), t.getKind()));
        Map<Long, PhotoRef> covers = new HashMap<>();
        if (kinds.isEmpty()) return covers;
        for (TripPhoto p : photos.findCoverCandidates(kinds.keySet())) {
            boolean wanted = kinds.get(p.getTripId()) == Trip.Kind.FULL ? p.getRole() == TripPhoto.Role.COVER : p.getRole() == TripPhoto.Role.SECTION;
            if (wanted) covers.put(p.getTripId(), PhotoRef.of(p));
        }
        return covers;
    }

    /** Storage isn't transactional, so files are removed only once the database change has committed. */
    private void deleteFilesAfterCommit(Collection<TripPhoto> removed) {
        if (removed.isEmpty()) return;
        List<String> keys = new ArrayList<>();
        removed.forEach(p -> { keys.add(p.getLargeKey()); keys.add(p.getThumbKey()); });
        Runnable cleanup = () -> keys.forEach(storage::delete);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanup.run();
                }
            });
        } else {
            cleanup.run();
        }
    }
}
