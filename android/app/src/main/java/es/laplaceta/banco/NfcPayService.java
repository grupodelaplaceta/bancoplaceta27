package es.laplaceta.banco;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Emulación de tarjeta (HCE) con protocolo propio de La Placeta.
 * El terminal selecciona el AID F0504C414345544101 y pide el token con «80 CA 00 00 00».
 * El token lo emite el servidor (/api/nfc/token), dura 60 s y se entrega UNA sola vez.
 * (No es un pago EMV de las redes Visa/Mastercard: el terminal debe hablar este protocolo.)
 */
public class NfcPayService extends HostApduService {

    private static final byte[] SW_OK = {(byte) 0x90, 0x00};
    private static final byte[] SW_DENIED = {0x69, (byte) 0x85};
    private static final byte[] SW_INS = {0x6D, 0x00};
    private static final byte[] SW_UNKNOWN = {0x6F, 0x00};
    private static final int CHUNK = 240;

    static volatile byte[] token;
    static volatile long until;
    static volatile Runnable onRead;

    private byte[] pending;
    private int pos;

    /** La llama la app cuando el usuario pulsa «Pagar con NFC» (con la app desbloqueada y abierta). */
    static void arm(String t, int seconds) {
        token = t == null ? null : t.getBytes(StandardCharsets.UTF_8);
        until = System.currentTimeMillis() + Math.max(5, Math.min(seconds, 120)) * 1000L;
    }

    static void disarm() {
        token = null;
    }

    @Override
    public byte[] processCommandApdu(byte[] c, Bundle extras) {
        if (c == null || c.length < 4) return SW_UNKNOWN;
        int cla = c[0] & 0xFF, ins = c[1] & 0xFF;
        if (cla == 0x00 && ins == 0xA4) { // SELECT AID
            return concat("PZ1".getBytes(StandardCharsets.US_ASCII), SW_OK);
        }
        if (cla == 0x80 && ins == 0xCA) { // GET TOKEN
            byte[] t = token;
            if (t == null || System.currentTimeMillis() > until) return SW_DENIED;
            token = null; // un solo uso
            pending = t;
            pos = 0;
            return next();
        }
        if (cla == 0x00 && ins == 0xC0) return next(); // GET RESPONSE (trozos)
        return SW_INS;
    }

    private byte[] next() {
        if (pending == null) return SW_DENIED;
        int n = Math.min(CHUNK, pending.length - pos);
        byte[] out = Arrays.copyOfRange(pending, pos, pos + n);
        pos += n;
        int rest = pending.length - pos;
        if (rest == 0) {
            pending = null;
            Runnable r = onRead;
            if (r != null) r.run();
            return concat(out, SW_OK);
        }
        return concat(out, new byte[]{0x61, (byte) Math.min(rest, CHUNK)});
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] o = Arrays.copyOf(a, a.length + b.length);
        System.arraycopy(b, 0, o, a.length, b.length);
        return o;
    }

    @Override
    public void onDeactivated(int reason) {
        pending = null;
    }
}
