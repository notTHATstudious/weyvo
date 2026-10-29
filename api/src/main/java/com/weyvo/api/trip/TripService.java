package com.weyvo.api.trip;

import com.weyvo.api.common.ApiException;
import com.weyvo.api.config.AppProperties.PlanLimits;
import com.weyvo.api.photo.PhotoService;
import com.weyvo.api.plan.PlanService;
import com.weyvo.api.photo.PhotoService.PhotoRef;
import com.weyvo.api.social.BlockService;
import com.weyvo.api.social.FollowService;
import com.weyvo.api.social.ReactionService;
import com.weyvo.api.trip.TripDtos.Author;
import com.weyvo.api.trip.TripDtos.Section;
import com.weyvo.api.trip.TripDtos.SectionInput;
import com.weyvo.api.trip.TripDtos.TripCard;
import com.weyvo.api.trip.TripDtos.TripRequest;
import com.weyvo.api.trip.TripDtos.TripView;
import com.weyvo.api.user.User;
import com.weyvo.api.user.UserRepository;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.IntStream;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TripService {

    static final int MAX_SHORT_CAPTION = 140;
    private static final int PAGE_SIZE = 20;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final TripRepository trips;
    private final UserRepository users;
    private final StoryGate gate;
    private final PhotoService photos;
    private final ReactionService reactions;
    private final FollowService follows;
    private final PlanService plans;
    private final BlockService blocks;

    public TripService(TripRepository trips, UserRepository users, StoryGate gate, PhotoService photos,
                       ReactionService reactions, FollowService follows, PlanService plans, BlockService blocks) {
        this.blocks = blocks;
        this.plans = plans;
        this.trips = trips;
        this.users = users;
        this.gate = gate;
        this.photos = photos;
        this.reactions = reactions;
        this.follows = follows;
    }

    // ---- reads ----

    /**
     * Returns a trip as the viewer may see it. Drafts and private trips exist only for their owner;
     * everyone else gets 404 so ids and slugs reveal nothing. Signed-out readers get the free share.
     */
    @Transactional(readOnly = true)
    public TripView view(String slug, Long viewerId) {
        Trip trip = trips.findBySlug(slug).orElseThrow(ApiException::notFound);
        if (!trip.isVisibleTo(viewerId) || blocks.between(viewerId, trip.getOwner().getId())) throw ApiException.notFound();

        boolean locked = gate.locked(trip, viewerId);
        PhotoService.TripPhotos pics = photos.forTrip(trip);
        List<Section> all = trip.getSections().stream()
                .map(s -> new Section(s.getHeading(), s.getBody(), s.getPhotoCaption(), pics.sections().get(s.getPosition())))
                .toList();
        List<Section> shown = locked ? all.subList(0, gate.freeCount(all.size())) : all;

        return new TripView(trip.getId(), trip.getSlug(), trip.getKind(), trip.getShortTag(), trip.getTitle(), trip.getPlace(),
                trip.getStartDate(), trip.getEndDate(), trip.getIntro(), author(trip.getOwner()),
                trip.getVisibility(), trip.getStatus(), trip.getPublishedAt(), pics.cover(),
                shown, all.size(), locked ? List.of() : List.copyOf(trip.getMoments()), locked ? null : trip.getFinalNote(),
                locked, trip.isOwnedBy(viewerId), reactions.forTrips(List.of(trip.getId()), viewerId).get(trip.getId()));
    }

    @Transactional(readOnly = true)
    public List<TripCard> feed(Trip.Kind kind, Long viewerId) {
        return cards(trips.findPublicFeed(kind, PageRequest.of(0, PAGE_SIZE)), viewerId);
    }

    /** Public trips from people the reader follows, newest first. */
    @Transactional(readOnly = true)
    public List<TripCard> following(long viewerId) {
        List<Long> followees = follows.followeeIds(viewerId);
        if (followees.isEmpty()) return List.of();
        return cards(trips.findPublicByOwnerIds(followees, PageRequest.of(0, PAGE_SIZE)), viewerId);
    }

    @Transactional(readOnly = true)
    public List<TripCard> byUser(String username, Long viewerId) {
        return cards(trips.findPublicByUsername(username, PageRequest.of(0, PAGE_SIZE)), viewerId);
    }

    /** Public stories at a place, newest first. */
    @Transactional(readOnly = true)
    public List<TripCard> atPlace(long placeId, Long viewerId) {
        return cards(trips.findPublicByPlace(placeId), viewerId);
    }

    @Transactional(readOnly = true)
    public List<TripCard> mine(long ownerId) {
        return cards(trips.findAllByOwner(ownerId, PageRequest.of(0, 100)), ownerId);
    }

    /**
     * Trips the reader saved or wants to visit, most recent first. A trip that has since gone private or
     * back to draft drops out of the list rather than leaking.
     */
    @Transactional(readOnly = true)
    public List<TripCard> reacted(long userId, ReactionService.Type type) {
        List<Long> ids = reactions.tripIds(userId, type, 100);
        Map<Long, Trip> byId = new java.util.HashMap<>();
        trips.findAllWithOwnerByIdIn(ids).forEach(t -> byId.put(t.getId(), t));
        List<Trip> ordered = ids.stream().map(byId::get)
                .filter(t -> t != null && t.isVisibleTo(userId) && t.getStatus() == Trip.Status.PUBLISHED)
                .toList();
        return cards(ordered, userId);
    }

    // ---- writes (owner only) ----

    @Transactional
    public TripView create(long ownerId, TripRequest req) {
        validateTemplate(req, plans.limitsFor(ownerId));
        User owner = users.findById(ownerId).orElseThrow(() -> new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Sign in again"));
        Trip trip = new Trip(owner, uniqueSlug(req.title()), req.kind());
        apply(trip, req);
        trips.save(trip);
        return view(trip.getSlug(), ownerId);
    }

    @Transactional
    public TripView update(long ownerId, long tripId, TripRequest req) {
        Trip trip = owned(ownerId, tripId);
        if (req.kind() != trip.getKind()) throw ApiException.badRequest("A trip's kind can't change after it's created");
        validateTemplate(req, plans.limitsFor(ownerId));
        // Hibernate flushes inserts before orphan deletes; clear first so new rows can reuse positions.
        trip.replaceSections(List.of());
        trips.flush();
        apply(trip, req);
        trip.touch();
        photos.pruneSections(trip.getId(), trip.getSections().size());
        return view(trip.getSlug(), ownerId);
    }

    @Transactional
    public TripView publish(long ownerId, long tripId) {
        Trip trip = owned(ownerId, tripId);
        if (trip.getSections().isEmpty()) throw ApiException.badRequest("Add at least one section or photo caption before publishing");
        trip.publish();
        return view(trip.getSlug(), ownerId);
    }

    @Transactional
    public void delete(long ownerId, long tripId) {
        Trip trip = owned(ownerId, tripId);
        photos.deleteAllFor(trip.getId());
        trips.delete(trip);
    }

    /** Loads a trip only if the caller owns it. Someone else's trip looks exactly like a missing one. */
    private Trip owned(long ownerId, long tripId) {
        return trips.findById(tripId).filter(t -> t.isOwnedBy(ownerId)).orElseThrow(ApiException::notFound);
    }

    private void apply(Trip trip, TripRequest req) {
        trip.setShortTag(req.kind() == Trip.Kind.SHORT ? req.shortTag() : null);
        trip.setTitle(req.title().trim());
        trip.setPlace(req.place().trim());
        trip.setStartDate(req.startDate());
        trip.setEndDate(req.endDate());
        trip.setIntro(blankToNull(req.intro()));
        trip.setVisibility(req.visibility());
        List<SectionInput> sections = req.sections() == null ? List.of() : req.sections();
        if (req.kind() == Trip.Kind.FULL) {
            trip.setFinalNote(blankToNull(req.finalNote()));
            trip.replaceMoments(req.moments() == null ? List.of() : req.moments().stream().map(String::trim).toList());
        } else {
            trip.setFinalNote(null);
            trip.replaceMoments(List.of());
        }
        trip.replaceSections(IntStream.range(0, sections.size())
                .mapToObj(i -> {
                    SectionInput s = sections.get(i);
                    String heading = req.kind() == Trip.Kind.FULL ? blankToNull(s.heading()) : null;
                    return new TripSection(i, heading, s.body().trim(), blankToNull(s.photoCaption()));
                })
                .toList());
    }

    /** Template rules, with section and photo counts taken from the owner's plan. */
    private void validateTemplate(TripRequest req, PlanLimits limits) {
        int sections = req.sections() == null ? 0 : req.sections().size();
        if (req.startDate() != null && req.endDate() != null && req.startDate().isAfter(req.endDate())) {
            throw ApiException.badRequest("The trip can't end before it starts");
        }
        if (req.kind() == Trip.Kind.FULL) {
            if (req.shortTag() != null) throw ApiException.badRequest("Only short stories have a tag");
            if (sections > limits.fullTripSections()) throw ApiException.badRequest("Your plan allows up to " + limits.fullTripSections() + " story sections");
        } else {
            if (req.shortTag() == null) throw ApiException.badRequest("Pick what kind of escape this was");
            if (sections > limits.shortStoryPhotos()) throw ApiException.badRequest("Your plan allows up to " + limits.shortStoryPhotos() + " photos in a short story");
            boolean longCaption = req.sections() != null && req.sections().stream().anyMatch(s -> s.body().trim().length() > MAX_SHORT_CAPTION);
            if (longCaption) throw ApiException.badRequest("Short story captions are up to " + MAX_SHORT_CAPTION + " characters");
            if (req.moments() != null && !req.moments().isEmpty()) throw ApiException.badRequest("Favourite moments are for full trips");
        }
    }

    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

    /**
     * 8 random characters (36^8, about 2.8 trillion). Unlisted stories are shared by link only, so the
     * link must not be guessable from the title.
     */
    static String randomSuffix() {
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    private String uniqueSlug(String title) {
        String base = Normalizer.normalize(title, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.length() > 60) base = base.substring(0, 60).replaceAll("-$", "");
        if (base.isEmpty()) base = "trip";
        String slug;
        do {
            slug = base + "-" + randomSuffix();
        } while (trips.existsBySlug(slug));
        return slug;
    }

    /** Stories by people the viewer blocked, or who blocked the viewer, never appear in a list. */
    private List<TripCard> cards(List<Trip> all, Long viewerId) {
        java.util.Set<Long> hidden = blocks.hiddenFor(viewerId);
        List<Trip> list = hidden.isEmpty() ? all : all.stream().filter(t -> !hidden.contains(t.getOwner().getId())).toList();
        Map<Long, PhotoRef> covers = photos.coversFor(list);
        Map<Long, ReactionService.Reactions> counts = reactions.forTrips(list.stream().map(Trip::getId).toList(), viewerId);
        return list.stream()
                .map(t -> new TripCard(t.getId(), t.getSlug(), t.getKind(), t.getShortTag(), t.getTitle(), t.getPlace(),
                        author(t.getOwner()), t.getVisibility(), t.getStatus(), t.getPublishedAt(), covers.get(t.getId()),
                        counts.get(t.getId())))
                .toList();
    }

    private static Author author(User u) {
        return new Author(u.getUsername(), u.getDisplayName(), u.getAvatarUrl());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
