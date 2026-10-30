package com.weyvo.api;

import java.security.KeyPairGenerator;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

/** A browser-style push key for tests: the 65-byte uncompressed P-256 point, base64url. */
final class WebPushKeys {

    private WebPushKeys() {}

    static String browserKey() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        ECPublicKey pub = (ECPublicKey) gen.generateKeyPair().getPublic();
        byte[] out = new byte[65];
        out[0] = 4;
        copy(pub.getW().getAffineX().toByteArray(), out, 1);
        copy(pub.getW().getAffineY().toByteArray(), out, 33);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
    }

    private static void copy(byte[] b, byte[] out, int at) {
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, at + 32 - len, len);
    }
}
