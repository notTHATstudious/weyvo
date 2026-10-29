package com.weyvo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weyvo.api.geo.Geocoder;
import com.weyvo.api.geo.PlaceResolver;
import jakarta.servlet.http.Cookie;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.auth.require-verified-email=false", "app.auth.signups-per-ip-per-hour=1000"})
@AutoConfigureMockMvc
@Testcontainers
class PlacesIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean Geocoder geocoder;
    @Autowired PlaceResolver resolver;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private record Account(Cookie cookie, String username) {}

    @Test
    void storiesGetPinnedAndPrivacyRulesApplyToTheMap() throws Exception {
        String town = "Testville " + UUID.randomUUID().toString().substring(0, 6);
        when(geocoder.lookup(anyString())).thenAnswer(inv -> Optional.of(new Geocoder.Result(town, "India", 15.33, 76.46)));

        Account maya = signup("maya");
        Account reader = signup("reader");
        String publicSlug = publish(maya, town + ", Karnataka", "PUBLIC");
        publish(maya, town + ", Karnataka", "PRIVATE");
        resolver.resolvePending();
        verify(geocoder, times(1)).lookup(anyString()); // same place text: looked up once

        mvc.perform(get("/api/users/" + maya.username() + "/map").cookie(reader.cookie()))
                .andExpect(jsonPath("$.been", hasSize(1)))
                .andExpect(jsonPath("$.been[0].trips", hasSize(1)))
                .andExpect(jsonPath("$.been[0].trips[0].slug").value(publicSlug))
                .andExpect(jsonPath("$.want").value(nullValue()));
        mvc.perform(get("/api/users/" + maya.username() + "/map").cookie(maya.cookie()))
                .andExpect(jsonPath("$.been[0].trips", hasSize(2)))
                .andExpect(jsonPath("$.countries").value(1));

        // Want to go shows on the reader's own map only.
        long tripId = json.readTree(mvc.perform(get("/api/trips/" + publicSlug)).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/trips/" + tripId + "/reactions/want").cookie(reader.cookie())).andExpect(status().isOk());
        mvc.perform(get("/api/users/" + reader.username() + "/map").cookie(reader.cookie())).andExpect(jsonPath("$.want", hasSize(1)));
        mvc.perform(get("/api/users/" + reader.username() + "/map").cookie(maya.cookie())).andExpect(jsonPath("$.want").value(nullValue()));

        String placeSlug = json.readTree(mvc.perform(get("/api/users/" + maya.username() + "/map").cookie(reader.cookie()))
                .andReturn().getResponse().getContentAsString()).at("/been/0/placeSlug").asText();
        mvc.perform(get("/api/places/" + placeSlug))
                .andExpect(jsonPath("$.name").value(town))
                .andExpect(jsonPath("$.stories").value(1))
                .andExpect(jsonPath("$.wantToGo").value(1))
                .andExpect(jsonPath("$.trips", hasSize(1)));
    }

    @Test
    void markingADestinationPutsItOnYourMap() throws Exception {
        String town = "Markville " + UUID.randomUUID().toString().substring(0, 6);
        when(geocoder.lookup(anyString())).thenAnswer(inv -> Optional.of(new Geocoder.Result(town, "India", 12.0, 77.0)));
        Account author = signup("author");
        Account visitor = signup("visitor");
        Account other = signup("other");
        publish(author, town, "PUBLIC");
        resolver.resolvePending();
        String placeSlug = json.readTree(mvc.perform(get("/api/users/" + author.username() + "/map"))
                .andReturn().getResponse().getContentAsString()).at("/been/0/placeSlug").asText();

        mvc.perform(put("/api/places/" + placeSlug + "/reactions/been")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/places/" + placeSlug + "/reactions/been").cookie(visitor.cookie()))
                .andExpect(jsonPath("$.been").value(1)).andExpect(jsonPath("$.beenByMe").value(true));
        mvc.perform(put("/api/places/" + placeSlug + "/reactions/want").cookie(visitor.cookie())).andExpect(jsonPath("$.wantByMe").value(true));

        mvc.perform(get("/api/users/" + visitor.username() + "/map").cookie(other.cookie()))
                .andExpect(jsonPath("$.been", hasSize(1)))
                .andExpect(jsonPath("$.been[0].trips", hasSize(0)))
                .andExpect(jsonPath("$.want").value(nullValue()));
        mvc.perform(get("/api/users/" + visitor.username() + "/map").cookie(visitor.cookie())).andExpect(jsonPath("$.want", hasSize(1)));
        mvc.perform(get("/api/places/" + placeSlug).cookie(visitor.cookie()))
                .andExpect(jsonPath("$.reactions.been").value(1)).andExpect(jsonPath("$.reactions.wantByMe").value(true));

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/places/" + placeSlug + "/reactions/been").cookie(visitor.cookie()))
                .andExpect(jsonPath("$.been").value(0));
        mvc.perform(get("/api/users/" + visitor.username() + "/map")).andExpect(jsonPath("$.been", hasSize(0)));
    }

    @Test
    void unknownPlacesAreRememberedAndNotLookedUpAgain() throws Exception {
        String nowhere = "Nowhere " + UUID.randomUUID();
        when(geocoder.lookup(nowhere)).thenReturn(Optional.empty());
        Account a = signup("lost");
        publish(a, nowhere, "PUBLIC");
        publish(a, nowhere, "PUBLIC");
        resolver.resolvePending();
        resolver.resolvePending();
        verify(geocoder, times(1)).lookup(nowhere);
        mvc.perform(get("/api/users/" + a.username() + "/map")).andExpect(jsonPath("$.been", hasSize(0)));
        assertThat(resolver.resolvePending()).isZero();
    }

    private Account signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        Cookie c = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getCookie("weyvo_session");
        return new Account(c, username);
    }

    private String publish(Account a, String place, String visibility) throws Exception {
        var created = json.readTree(mvc.perform(post("/api/trips").cookie(a.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FULL\",\"title\":\"Map test\",\"place\":\"" + place + "\",\"visibility\":\"" + visibility + "\",\"sections\":[{\"body\":\"One\"}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/trips/" + created.get("id").asLong() + "/publish").cookie(a.cookie())).andExpect(status().isOk());
        return created.get("slug").asText();
    }
}
