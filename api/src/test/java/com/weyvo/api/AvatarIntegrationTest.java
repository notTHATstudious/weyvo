package com.weyvo.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"app.signup.check-mail-domain=false", "app.auth.require-verified-email=false",
        "app.auth.signups-per-ip-per-hour=1000", "app.storage.local-dir=target/test-photos-avatars"})
@AutoConfigureMockMvc
@Testcontainers
class AvatarIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MockMvc mvc;

    @Test
    void profilePicturesAreSquareMetadataFreeAndRemovable() throws Exception {
        String username = "pic_" + UUID.randomUUID().toString().substring(0, 8);
        Cookie c = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + username + "@example.com\",\"password\":\"correct-horse-battery\",\"username\":\"" + username + "\",\"displayName\":\"Pic\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getCookie("weyvo_session");

        mvc.perform(multipart(HttpMethod.PUT, "/api/me/avatar").file(file(jpeg(800, 500)))).andExpect(status().isUnauthorized());
        mvc.perform(multipart(HttpMethod.PUT, "/api/me/avatar").file(file("not an image".getBytes())).cookie(c)).andExpect(status().isBadRequest());
        mvc.perform(multipart(HttpMethod.PUT, "/api/me/avatar").file(file(jpeg(800, 500))).cookie(c)).andExpect(status().isOk());

        mvc.perform(get("/api/users/" + username)).andExpect(jsonPath("$.avatarUrl").value("/api/users/" + username + "/avatar?v=1"));
        byte[] bytes = mvc.perform(get("/api/users/" + username + "/avatar")).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
        assertThat(img.getWidth()).isEqualTo(400);
        assertThat(img.getHeight()).isEqualTo(400);
        assertThat(new String(bytes, StandardCharsets.ISO_8859_1)).doesNotContain("Exif");

        mvc.perform(delete("/api/me/avatar").cookie(c)).andExpect(status().isNoContent());
        mvc.perform(get("/api/users/" + username + "/avatar")).andExpect(status().isNotFound());
        mvc.perform(get("/api/users/" + username)).andExpect(jsonPath("$.avatarUrl").doesNotExist());
    }

    private static MockMultipartFile file(byte[] bytes) {
        return new MockMultipartFile("file", "me.jpg", "image/jpeg", bytes);
    }

    private static byte[] jpeg(int w, int h) throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "jpeg", out);
        return out.toByteArray();
    }
}
