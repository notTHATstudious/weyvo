package com.weyvo.api.photo;

import com.drew.imaging.ImageMetadataReader;
import com.drew.metadata.exif.ExifIFD0Directory;
import com.weyvo.api.common.ApiException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import org.springframework.stereotype.Component;

/**
 * Turns an untrusted upload into clean JPEGs. Every output is re-encoded from decoded pixels, so EXIF
 * (GPS location, camera serial, timestamps) and any other embedded data cannot survive.
 */
@Component
public class ImageProcessor {

    static final int LARGE_MAX = 2000;
    static final int THUMB_MAX = 600;
    static final int MIN_SIDE = 200;
    static final long MAX_PIXELS = 40_000_000L;

    public record Processed(byte[] large, byte[] thumb, int width, int height) {}

    public Processed process(byte[] upload) {
        Format format = sniff(upload);
        if (format == Format.HEIC || format == Format.WEBP) {
            throw ApiException.badRequest("That photo format isn't supported yet. Use JPEG or PNG");
        }
        if (format == Format.UNKNOWN) throw ApiException.badRequest("That file isn't a photo. Use JPEG or PNG");

        checkDimensionsBeforeDecoding(upload);
        BufferedImage image = decode(upload);
        image = upright(toRgb(image), format == Format.JPEG ? orientation(upload) : 1);

        BufferedImage large = scaleToFit(image, LARGE_MAX);
        BufferedImage thumb = scaleToFit(image, THUMB_MAX);
        return new Processed(jpeg(large, 0.85f), jpeg(thumb, 0.8f), large.getWidth(), large.getHeight());
    }

    // ---- validation ----

    enum Format { JPEG, PNG, WEBP, HEIC, UNKNOWN }

    /** Decides the format from the file's own bytes; the name and declared content type are ignored. */
    static Format sniff(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return Format.JPEG;
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return Format.PNG;
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return Format.WEBP;
        if (b.length >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') return Format.HEIC;
        return Format.UNKNOWN;
    }

    /** Reads only the header so a tiny file claiming enormous dimensions can't exhaust memory. */
    private static void checkDimensionsBeforeDecoding(byte[] upload) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(upload))) {
            var readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) throw ApiException.badRequest("That photo couldn't be read. Try another one");
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                long w = reader.getWidth(0), h = reader.getHeight(0);
                if (w * h > MAX_PIXELS) throw ApiException.badRequest("That photo is too large. Use one under 40 megapixels");
                if (Math.min(w, h) < MIN_SIDE) throw ApiException.badRequest("That photo is too small. Use one at least 200 pixels wide");
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw ApiException.badRequest("That photo couldn't be read. Try another one");
        }
    }

    private static BufferedImage decode(byte[] upload) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(upload));
            if (img == null) throw ApiException.badRequest("That photo couldn't be read. Try another one");
            return img;
        } catch (IOException e) {
            throw ApiException.badRequest("That photo couldn't be read. Try another one");
        }
    }

    // ---- pixels ----

    /** EXIF orientation 1–8; anything unreadable counts as already upright. */
    private static int orientation(byte[] upload) {
        try {
            var dir = ImageMetadataReader.readMetadata(new ByteArrayInputStream(upload)).getFirstDirectoryOfType(ExifIFD0Directory.class);
            return dir != null && dir.containsTag(ExifIFD0Directory.TAG_ORIENTATION) ? dir.getInt(ExifIFD0Directory.TAG_ORIENTATION) : 1;
        } catch (Exception e) {
            return 1;
        }
    }

    /** Flattens transparency onto white and drops alpha, since output is JPEG. */
    private static BufferedImage toRgb(BufferedImage src) {
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, src.getWidth(), src.getHeight());
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return rgb;
    }

    private static BufferedImage upright(BufferedImage src, int orientation) {
        if (orientation <= 1 || orientation > 8) return src;
        int w = src.getWidth(), h = src.getHeight();
        boolean swap = orientation >= 5;
        AffineTransform t = new AffineTransform();
        switch (orientation) {
            case 2 -> { t.scale(-1, 1); t.translate(-w, 0); }
            case 3 -> { t.translate(w, h); t.rotate(Math.PI); }
            case 4 -> { t.scale(1, -1); t.translate(0, -h); }
            case 5 -> t.setTransform(0, 1, 1, 0, 0, 0);          // transpose

            case 6 -> { t.translate(h, 0); t.rotate(Math.PI / 2); }
            case 7 -> t.setTransform(0, -1, -1, 0, h, w);        // transverse
            case 8 -> { t.translate(0, w); t.rotate(3 * Math.PI / 2); }
            default -> { }
        }
        BufferedImage out = new BufferedImage(swap ? h : w, swap ? w : h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.drawImage(src, t, null);
        g.dispose();
        return out;
    }

    /** Downscales in halving steps for quality; never upscales. */
    static BufferedImage scaleToFit(BufferedImage src, int max) {
        int w = src.getWidth(), h = src.getHeight();
        double ratio = Math.min(1.0, (double) max / Math.max(w, h));
        int tw = Math.max(1, (int) Math.round(w * ratio)), th = Math.max(1, (int) Math.round(h * ratio));
        BufferedImage cur = src;
        while (cur.getWidth() / 2 >= tw && cur.getHeight() / 2 >= th) {
            cur = draw(cur, cur.getWidth() / 2, cur.getHeight() / 2);
        }
        return cur.getWidth() == tw && cur.getHeight() == th ? cur : draw(cur, tw, th);
    }

    private static BufferedImage draw(BufferedImage src, int w, int h) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    private static byte[] jpeg(BufferedImage img, float quality) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (var bytes = new ByteArrayOutputStream(); ImageOutputStream out = ImageIO.createImageOutputStream(bytes)) {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.setOutput(out);
            writer.write(null, new IIOImage(img, null, null), param);
            out.flush();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            writer.dispose();
        }
    }
}
