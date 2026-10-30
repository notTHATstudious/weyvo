package com.weyvo.api.push;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * The cryptography of Web Push, with nothing but the JDK: P-256 keys, and message encryption per RFC 8291
 * (aes128gcm content coding, RFC 8188). Each message is readable only by the one browser it's sent to.
 */
final class WebPush {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder D64 = Base64.getUrlDecoder();

    private WebPush() {}

    static String b64(byte[] b) {
        return B64.encodeToString(b);
    }

    static byte[] unb64(String s) {
        return D64.decode(s.strip().replace('+', '-').replace('/', '_').replace("=", ""));
    }

    static ECParameterSpec curve() throws GeneralSecurityException {
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        return params.getParameterSpec(ECParameterSpec.class);
    }

    static KeyPair newKeyPair() throws GeneralSecurityException {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
        return gen.generateKeyPair();
    }

    /** The 65-byte uncompressed point (0x04 || X || Y) browsers use for keys. */
    static byte[] raw(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 4;
        fixed32(key.getW().getAffineX(), out, 1);
        fixed32(key.getW().getAffineY(), out, 33);
        return out;
    }

    static byte[] raw(ECPrivateKey key) {
        byte[] out = new byte[32];
        fixed32(key.getS(), out, 0);
        return out;
    }

    static ECPublicKey publicKey(byte[] raw) throws GeneralSecurityException {
        if (raw.length != 65 || raw[0] != 4) throw new GeneralSecurityException("Not an uncompressed P-256 key");
        ECPoint point = new ECPoint(new BigInteger(1, Arrays.copyOfRange(raw, 1, 33)), new BigInteger(1, Arrays.copyOfRange(raw, 33, 65)));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point, curve()));
    }

    static ECPrivateKey privateKey(byte[] raw) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), curve()));
    }

    /** Encrypts one message for a browser subscription (its p256dh key and auth secret). Returns the request body. */
    static byte[] encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret) throws GeneralSecurityException {
        KeyPair local = newKeyPair();
        byte[] asPublic = raw((ECPublicKey) local.getPublic());

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(local.getPrivate());
        ka.doPhase(publicKey(uaPublic), true);
        byte[] ecdhSecret = ka.generateSecret();

        // RFC 8291 section 3.4: mix in the auth secret and both public keys.
        byte[] prkKey = hmac(authSecret, ecdhSecret);
        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[] {1});
        byte[] ikm = hmac(prkKey, keyInfo);

        // RFC 8188: content encryption key and nonce from a random salt.
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, concat("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, concat("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 12);

        // One record: the message, then the 0x02 delimiter that marks the last record.
        Cipher gcm = Cipher.getInstance("AES/GCM/NoPadding");
        gcm.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] ciphertext = gcm.doFinal(concat(payload, new byte[] {2}));

        ByteBuffer body = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length + ciphertext.length);
        body.put(salt).putInt(4096).put((byte) asPublic.length).put(asPublic).put(ciphertext);
        return body.array();
    }

    static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    static byte[] concat(byte[]... parts) {
        int n = 0;
        for (byte[] p : parts) n += p.length;
        ByteBuffer b = ByteBuffer.allocate(n);
        for (byte[] p : parts) b.put(p);
        return b.array();
    }

    private static void fixed32(BigInteger v, byte[] out, int at) {
        byte[] b = v.toByteArray();
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, at + 32 - len, len);
    }
}
