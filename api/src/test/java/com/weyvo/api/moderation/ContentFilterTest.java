package com.weyvo.api.moderation;

import static org.assertj.core.api.Assertions.assertThat;

import com.weyvo.api.moderation.ContentFilter.Reason;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;

class ContentFilterTest {

    private final ContentFilter filter = new ContentFilter();

    /** Ordinary travel writing must never be held. */
    @ParameterizedTest
    @ValueSource(strings = {
            "Sunset at Narendra Modi Stadium was unreal",
            "Booked our stay on Booking.com, paid about 2500 a night",
            "Built in 400 BC, the fort looks sexy at golden hour",
            "We drove 1200 km from Lund to Oslo in 2024",
            "They call us the slow travellers. Best time to go: Oct-Mar",
            "Check-in at 14:00, train 12951 leaves at 16:35",
            "The Congress Hall in Shimla and the old church",
            "Got 20 percent cheaper tickets by going on a weekday",
    })
    void travelIsFine(String text) {
        assertThat(filter.check(text)).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "'DM for price, best Goa packages', PROMOTION",
            "'call 98765 43210 for bookings', PROMOTION",
            "'visit https://cheap-trips.example now', PROMOTION",
            "'Use code GOA20 for 20% off', PROMOTION",
            "'vote for bjp this time', POLITICS",
            "'this is f*ck amazing', ABUSE",
            "'p0rn link here', SEXUAL",
    })
    void otherStuffIsHeld(String text, Reason reason) {
        assertThat(filter.check(text)).contains(reason);
    }
}
