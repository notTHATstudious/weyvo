package com.weyvo.api.photo;

import com.weyvo.api.auth.CurrentUser;
import com.weyvo.api.common.ApiException;
import com.weyvo.api.photo.PhotoService.PhotoRef;
import java.io.IOException;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class PhotoController {

    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    @PostMapping(path = "/api/trips/{tripId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoRef> upload(@AuthenticationPrincipal CurrentUser user, @PathVariable long tripId,
                                           @RequestParam("file") MultipartFile file,
                                           @RequestParam("role") TripPhoto.Role role,
                                           @RequestParam(value = "position", defaultValue = "0") int position) throws IOException {
        if (file.isEmpty()) throw ApiException.badRequest("Choose a photo to upload");
        return ResponseEntity.status(HttpStatus.CREATED).body(service.upload(user.id(), tripId, role, position, file.getBytes()));
    }

    @DeleteMapping("/api/trips/{tripId}/photos/{photoId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser user, @PathVariable long tripId, @PathVariable long photoId) {
        service.delete(user.id(), tripId, photoId);
        return ResponseEntity.noContent().build();
    }

    /** Photos are served only through here so trip visibility and the preview cut apply to images too. */
    @GetMapping("/api/photos/{photoId}/{size}")
    public ResponseEntity<byte[]> read(@AuthenticationPrincipal CurrentUser user, @PathVariable long photoId, @PathVariable String size) {
        PhotoService.Size s = switch (size) {
            case "large" -> PhotoService.Size.LARGE;
            case "thumb" -> PhotoService.Size.THUMB;
            default -> throw ApiException.notFound();
        };
        byte[] bytes = service.read(photoId, s, user == null ? null : user.id());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                // Private: a trip can turn private later, so shared caches must never keep a copy.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body(bytes);
    }
}
