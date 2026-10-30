package com.weyvo.api.trip;

import com.weyvo.api.config.AppProperties;
import com.weyvo.api.photo.PhotoService;
import com.weyvo.api.user.User;
import com.weyvo.api.user.UserRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Shared links (/s/...) land here first. WhatsApp, Instagram and other apps read the page's preview tags
 * (title, description, cover photo) to draw a card; people are sent straight on to the real page.
 * Only what a signed-out reader could already see goes into the tags: private stories, drafts and
 * removed stories get the plain Weyvo card.
 */
@RestController
public class SharePreviewController {

    private final TripRepository trips;
    private final UserRepository users;
    private final PhotoService photos;
    private final String site;

    public SharePreviewController(TripRepository trips, UserRepository users, PhotoService photos, AppProperties props) {
        this.trips = trips;
        this.users = users;
        this.photos = photos;
        this.site = props.mail().appUrl().replaceAll("/+$", "");
    }

    @GetMapping("/api/share/{slug}")
    @Transactional(readOnly = true)
    public ResponseEntity<String> trip(@PathVariable String slug) {
        String target = "/trips/" + slug;
        return trips.findBySlug(slug).filter(t -> t.isVisibleTo(null))
                .map(t -> {
                    var coverRef = photos.forTrip(t).cover();
                    String cover = coverRef == null ? null : coverRef.url();
                    String kind = t.getKind() == Trip.Kind.FULL ? "A trip" : "A short story";
                    String description = t.getIntro() != null && !t.getIntro().isBlank()
                            ? t.getIntro() : kind + " in " + t.getPlace() + " by " + t.getOwner().getUsername() + " on Weyvo.";
                    return page(t.getTitle() + " · " + t.getPlace(), description, cover, target, "article");
                })
                .orElseGet(() -> page("Weyvo", "Your travel magazine.", null, target, "website"));
    }

    @GetMapping("/api/share/u/{username}")
    @Transactional(readOnly = true)
    public ResponseEntity<String> profile(@PathVariable String username) {
        String target = "/u/" + username;
        return users.findByUsernameIgnoreCase(username).filter(User::isActive)
                .map(u -> page(u.getDisplayName() + " (@" + u.getUsername() + ") on Weyvo",
                        u.getBio() != null && !u.getBio().isBlank() ? u.getBio() : "Trips, short stories and a map of everywhere they've been.",
                        u.getAvatarUrl(), "/u/" + u.getUsername(), "profile"))
                .orElseGet(() -> page("Weyvo", "Your travel magazine.", null, target, "website"));
    }

    private ResponseEntity<String> page(String title, String description, String image, String path, String type) {
        String url = site + path;
        String img = image == null ? site + "/og-default.png" : image.startsWith("http") ? image : site + image;
        String desc = description.length() > 200 ? description.substring(0, 197) + "…" : description;
        String html = """
                <!doctype html>
                <html lang="en"><head><meta charset="utf-8">
                <title>%1$s</title>
                <meta name="description" content="%2$s">
                <meta property="og:site_name" content="Weyvo">
                <meta property="og:type" content="%5$s">
                <meta property="og:title" content="%1$s">
                <meta property="og:description" content="%2$s">
                <meta property="og:image" content="%3$s">
                <meta property="og:url" content="%4$s">
                <meta name="twitter:card" content="summary_large_image">
                <link rel="canonical" href="%4$s">
                <meta http-equiv="refresh" content="0;url=%4$s">
                </head><body><a href="%4$s">Open on Weyvo</a></body></html>
                """.formatted(esc(title), esc(desc), esc(img), esc(url), type);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML)
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(10)).cachePublic())
                .body(html);
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
