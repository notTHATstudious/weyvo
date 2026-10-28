package com.weyvo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.storage.local-dir=target/test-photos"})
@AutoConfigureMockMvc
@Testcontainers
class PhotoIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Test
    void uploadedPhotosLoseExifAndAreTurnedUpright() throws Exception {
        Cookie owner = signup("exif");
        long tripId = createFullTrip(owner, "PUBLIC", 1);
        byte[] withExif = jpegWithExifOrientation(400, 300, 6); // landscape pixels, "rotate 90°" in EXIF
        assertThat(new String(withExif, StandardCharsets.ISO_8859_1)).contains("Exif");

        mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo(withExif)).param("role", "COVER").cookie(owner))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(300))
                .andExpect(jsonPath("$.height").value(400));

        long photoId = photoIdOf(owner, tripId, "cover");
        byte[] stored = mvc.perform(get("/api/photos/" + photoId + "/large").cookie(owner))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(stored, StandardCharsets.ISO_8859_1)).doesNotContain("Exif");
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(stored));
        assertThat(img.getWidth()).isEqualTo(300);
        assertThat(img.getHeight()).isEqualTo(400);
    }

    @Test
    void signedOutReadersCannotLoadPhotosPastThePreview() throws Exception {
        Cookie owner = signup("gate");
        long tripId = createFullTrip(owner, "PUBLIC", 3);
        for (int pos : new int[] {0, 2}) {
            mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo(jpeg(400, 300))).param("role", "SECTION").param("position", "" + pos).cookie(owner))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post("/api/trips/" + tripId + "/publish").cookie(owner)).andExpect(status().isOk());

        JsonNode full = tripJson(owner, tripId);
        long first = full.at("/sections/0/photo/id").asLong();
        long third = full.at("/sections/2/photo/id").asLong();

        mvc.perform(get("/api/photos/" + first + "/thumb")).andExpect(status().isOk());
        mvc.perform(get("/api/photos/" + third + "/thumb")).andExpect(status().isNotFound());
        Cookie reader = signup("reader");
        mvc.perform(get("/api/photos/" + third + "/large").cookie(reader)).andExpect(status().isOk());
    }

    @Test
    void privateTripPhotosAreOwnerOnly() throws Exception {
        Cookie owner = signup("private");
        long tripId = createFullTrip(owner, "PRIVATE", 1);
        mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo(jpeg(400, 300))).param("role", "COVER").cookie(owner))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/trips/" + tripId + "/publish").cookie(owner)).andExpect(status().isOk());
        long photoId = photoIdOf(owner, tripId, "cover");

        mvc.perform(get("/api/photos/" + photoId + "/large")).andExpect(status().isNotFound());
        mvc.perform(get("/api/photos/" + photoId + "/large").cookie(signup("snoop"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/photos/" + photoId + "/large").cookie(owner)).andExpect(status().isOk());
    }

    @Test
    void uploadsAreOwnerOnlyAndMustBeRealPhotos() throws Exception {
        Cookie owner = signup("uploader");
        long tripId = createFullTrip(owner, "PUBLIC", 1);

        mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo(jpeg(400, 300))).param("role", "COVER").cookie(signup("intruder")))
                .andExpect(status().isNotFound());
        mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo(jpeg(400, 300))).param("role", "COVER"))
                .andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo("<script>alert(1)</script>".getBytes())).param("role", "COVER").cookie(owner))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("That file isn't a photo. Use JPEG or PNG"));
        mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo(jpeg(120, 90))).param("role", "COVER").cookie(owner))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/trips/" + tripId + "/photos").file(photo(jpeg(400, 300))).param("role", "SECTION").param("position", "5").cookie(owner))
                .andExpect(status().isBadRequest());
    }

    // ---- helpers ----

    private Cookie signup(String name) throws Exception {
        String username = name + "_" + UUID.randomUUID().toString().substring(0, 8);
        return mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Test\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getCookie("weyvo_session");
    }

    private long createFullTrip(Cookie owner, String visibility, int sections) throws Exception {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < sections; i++) s.append(i > 0 ? "," : "").append("{\"body\":\"Section ").append(i + 1).append("\"}");
        String body = "{\"kind\":\"FULL\",\"title\":\"Photo test\",\"place\":\"Goa\",\"visibility\":\"" + visibility + "\",\"sections\":[" + s + "]}";
        String res = mvc.perform(post("/api/trips").cookie(owner).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("id").asLong();
    }

    private JsonNode tripJson(Cookie owner, long tripId) throws Exception {
        for (JsonNode card : json.readTree(mvc.perform(get("/api/me/trips").cookie(owner)).andReturn().getResponse().getContentAsString())) {
            if (card.get("id").asLong() == tripId) {
                return json.readTree(mvc.perform(get("/api/trips/" + card.get("slug").asText()).cookie(owner)).andReturn().getResponse().getContentAsString());
            }
        }
        throw new IllegalStateException("trip not found");
    }

    private long photoIdOf(Cookie owner, long tripId, String field) throws Exception {
        return tripJson(owner, tripId).get(field).get("id").asLong();
    }

    private static MockMultipartFile photo(byte[] bytes) {
        return new MockMultipartFile("file", "photo.jpg", "image/jpeg", bytes);
    }

    private static byte[] jpeg(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(0xC97B4A));
        g.fillRect(0, 0, w, h / 2);
        g.dispose();
        var out = new ByteArrayOutputStream();
        ImageIO.write(img, "jpeg", out);
        return out.toByteArray();
    }

    /** A JPEG with an APP1/EXIF block holding a single Orientation tag, as phones write it. */
    private static byte[] jpegWithExifOrientation(int w, int h, int orientation) throws Exception {
        byte[] plain = jpeg(w, h);
        ByteBuffer tiff = ByteBuffer.allocate(26).order(ByteOrder.LITTLE_ENDIAN);
        tiff.put((byte) 'I').put((byte) 'I').putShort((short) 42).putInt(8); // header, IFD0 at offset 8
        tiff.putShort((short) 1);                                              // one entry
        tiff.putShort((short) 0x0112).putShort((short) 3).putInt(1).putShort((short) orientation).putShort((short) 0);
        tiff.putInt(0);                                                        // no next IFD
        byte[] payload = new byte[6 + tiff.capacity()];
        System.arraycopy("Exif\0\0".getBytes(StandardCharsets.ISO_8859_1), 0, payload, 0, 6);
        System.arraycopy(tiff.array(), 0, payload, 6, tiff.capacity());

        var out = new ByteArrayOutputStream();
        out.write(plain, 0, 2);                                                // SOI
        int len = payload.length + 2;
        out.write(new byte[] {(byte) 0xFF, (byte) 0xE1, (byte) (len >> 8), (byte) len});
        out.write(payload);
        out.write(plain, 2, plain.length - 2);
        return out.toByteArray();
    }
}
