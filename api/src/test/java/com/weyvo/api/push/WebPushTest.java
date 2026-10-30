package com.weyvo.api.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class WebPushTest {

    /** Decrypts the way a browser does (RFC 8291 from the receiving side), to check what we send. */
    private static byte[] decryptAsBrowser(byte[] body, KeyPair browser, byte[] auth) throws Exception {
        ByteBuffer in = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        in.get(salt);
        int rs = in.getInt();
        byte[] asPublic = new byte[in.get() & 0xff];
        in.get(asPublic);
        byte[] ciphertext = new byte[in.remaining()];
        in.get(ciphertext);
        assertThat(rs).isEqualTo(4096);

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(browser.getPrivate());
        ka.doPhase(WebPush.publicKey(asPublic), true);
        byte[] uaPublic = WebPush.raw((ECPublicKey) browser.getPublic());
        byte[] ikm = WebPush.hmac(WebPush.hmac(auth, ka.generateSecret()),
                WebPush.concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[] {1}));
        byte[] prk = WebPush.hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(WebPush.hmac(prk, WebPush.concat("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 16);
        byte[] nonce = Arrays.copyOf(WebPush.hmac(prk, WebPush.concat("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 12);
        Cipher gcm = Cipher.getInstance("AES/GCM/NoPadding");
        gcm.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] plain = gcm.doFinal(ciphertext);
        assertThat(plain[plain.length - 1]).isEqualTo((byte) 2);
        return Arrays.copyOf(plain, plain.length - 1);
    }

    @Test
    void aBrowserCanReadWhatWeSend() throws Exception {
        KeyPair browser = WebPush.newKeyPair();
        byte[] auth = new byte[16];
        new java.security.SecureRandom().nextBytes(auth);
        byte[] message = "{\"title\":\"Weyvo\",\"body\":\"maya commented on “Hampi”\"}".getBytes(StandardCharsets.UTF_8);

        byte[] body = WebPush.encrypt(message, WebPush.raw((ECPublicKey) browser.getPublic()), auth);

        assertThat(decryptAsBrowser(body, browser, auth)).isEqualTo(message);
    }

    @Test
    void keysSurviveTheirStoredForm() throws Exception {
        KeyPair pair = WebPush.newKeyPair();
        byte[] pub = WebPush.raw((ECPublicKey) pair.getPublic());
        byte[] priv = WebPush.raw((ECPrivateKey) pair.getPrivate());
        assertThat(pub).hasSize(65);
        assertThat(WebPush.raw(WebPush.publicKey(WebPush.unb64(WebPush.b64(pub))))).isEqualTo(pub);
        assertThat(WebPush.raw(WebPush.privateKey(WebPush.unb64(WebPush.b64(priv))))).isEqualTo(priv);
    }

    @Test
    void onlyKnownPushServicesAreContacted() {
        assertThat(PushService.allowed("https://fcm.googleapis.com/fcm/send/abc")).isTrue();
        assertThat(PushService.allowed("https://web.push.apple.com/QGx")).isTrue();
        assertThat(PushService.allowed("https://updates.push.services.mozilla.com/wpush/v2/x")).isTrue();
        assertThat(PushService.allowed("http://fcm.googleapis.com/fcm/send/abc")).isFalse();
        assertThat(PushService.allowed("https://evil.example.com/fcm.googleapis.com")).isFalse();
        assertThat(PushService.allowed("https://fcm.googleapis.com.evil.com/x")).isFalse();
        assertThat(PushService.allowed("https://169.254.169.254/latest")).isFalse();
    }
}
