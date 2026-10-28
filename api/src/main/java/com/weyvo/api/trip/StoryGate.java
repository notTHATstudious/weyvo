package com.weyvo.api.trip;

import com.weyvo.api.config.AppProperties;
import org.springframework.stereotype.Component;

/** The free-preview rule shared by trip text and trip photos, so both cut at the same place. */
@Component
public class StoryGate {

    private final double freeShare;

    public StoryGate(AppProperties props) {
        this.freeShare = props.story().freeShare();
    }

    /** Readers who are signed out and don't own the trip get the preview only. */
    public boolean locked(Trip trip, Long viewerId) {
        return viewerId == null && !trip.isOwnedBy(viewerId);
    }

    /** How many of {@code total} sections a locked reader sees: at least one, rounded up. */
    public int freeCount(int total) {
        if (total == 0) return 0;
        return Math.max(1, (int) Math.ceil(total * freeShare));
    }
}
