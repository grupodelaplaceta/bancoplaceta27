package es.laplaceta.banco;

import android.app.Activity;
import android.app.KeyguardManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.provider.Settings;
import android.view.Window;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String HOME = BuildConfig.APP_URL;
    private static final String UA_MARK = " BancoPlacetaApp/" + "1.0";

    private static final int REQ_UNLOCK = 77;
    private static final long LOCK_AFTER_MS = 60_000;

    private WebView web;
    private String homeHost;
    private FrameLayout root;
    private LinearLayout lockView;
    private KeyguardManager km;
    private boolean locked = false;
    private volatile boolean trusted = false; // la página actual es nuestro backend (no PlacetaID ni otra)
    private long leftAt = -1; // -1 = arranque en frío

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        // Banca: sin capturas de pantalla ni vista previa en "recientes".
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);

        homeHost = Uri.parse(HOME).getHost();

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
        web.setBackgroundColor(0xFF0B2E59);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        root = new FrameLayout(this);
        root.addView(web);
        buildLockView();
        root.addView(lockView);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + UA_MARK);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Bridge(), "PlacetaApp");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap f) {
                String h = Uri.parse(url).getHost();
                trusted = h != null && h.equals(homeHost);
                applyBars(0xFF0B2E59, true); // azul de acceso hasta que la app fije su tema
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !isAllowed(r.getUrl());
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) showOffline();
            }
        });

        if (b != null) web.restoreState(b); else web.loadUrl(HOME);
    }

    /** Dentro de la app: tu backend y PlacetaID. Todo lo demás se abre fuera. */
    private boolean isAllowed(Uri u) {
        String sch = u.getScheme(), host = u.getHost();
        if (sch == null || host == null) return false;
        if (!"https".equals(sch)) return false;
        if (host.equals(homeHost) || host.equals(BuildConfig.LOGIN_HOST)) return true;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception ignored) {
        }
        return false;
    }

    private void showOffline() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='font-family:sans-serif;background:#F4F2FA;color:#0B2E59;display:flex;"
                + "flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;text-align:center'>"
                + "<h2>Sin conexión</h2><p>No se ha podido conectar con el banco. Revisa tu internet.</p>"
                + "<a href='" + HOME + "' style='margin-top:16px;background:#0B2E59;color:#fff;padding:14px 28px;"
                + "border-radius:14px;text-decoration:none;font-weight:700'>Reintentar</a></body></html>";
        web.loadDataWithBaseURL(HOME, html, "text/html", "utf-8", null);
    }

    // ---- Bloqueo con el PIN / patrón / huella del móvil (la sesión queda recordada 30 días) ----
    private void buildLockView() {
        lockView = new LinearLayout(this);
        lockView.setOrientation(LinearLayout.VERTICAL);
        lockView.setGravity(Gravity.CENTER);
        lockView.setBackgroundColor(0xFF0B2E59);
        lockView.setPadding(64, 64, 64, 64);
        lockView.setVisibility(View.GONE);
        lockView.setClickable(true);
        TextView t = new TextView(this);
        t.setText("Banco La Placeta");
        t.setTextColor(Color.WHITE);
        t.setTextSize(26);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        TextView s = new TextView(this);
        s.setText("App bloqueada. Confirma que eres tú para continuar.");
        s.setTextColor(0xCCFFFFFF);
        s.setTextSize(16);
        s.setGravity(Gravity.CENTER);
        s.setPadding(0, 24, 0, 48);
        Button b = new Button(this);
        b.setText("Desbloquear");
        b.setAllCaps(false);
        b.setOnClickListener(v -> authenticate());
        lockView.addView(t);
        lockView.addView(s);
        lockView.addView(b);
    }

    private boolean hasRemembered() {
        String c = CookieManager.getInstance().getCookie(HOME);
        return c != null && c.contains("rem=");
    }

    private boolean shouldLock() {
        if (!hasRemembered()) return false;
        if (km == null || !km.isDeviceSecure()) return false;
        return leftAt < 0 || SystemClock.elapsedRealtime() - leftAt > LOCK_AFTER_MS;
    }

    private void lock() {
        locked = true;
        lockView.setVisibility(View.VISIBLE);
        web.setVisibility(View.INVISIBLE);
        authenticate();
    }

    private void unlock() {
        locked = false;
        lockView.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        leftAt = SystemClock.elapsedRealtime();
    }

    private void authenticate() {
        Intent i = km == null ? null : km.createConfirmDeviceCredentialIntent("Banco La Placeta", "Confirma que eres tú");
        if (i == null) { unlock(); return; }
        try { startActivityForResult(i, REQ_UNLOCK); } catch (Exception e) { unlock(); }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_UNLOCK && res == RESULT_OK) unlock();
    }

    private void applyBars(int color, boolean lightIcons) {
        runOnUiThread(() -> {
            Window w = getWindow();
            w.setStatusBarColor(color);
            w.setNavigationBarColor(color);
            View dv = w.getDecorView();
            int f = dv.getSystemUiVisibility();
            if (Build.VERSION.SDK_INT >= 23) f = lightIcons ? (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            if (Build.VERSION.SDK_INT >= 26) f = lightIcons ? (f & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR) : (f | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            dv.setSystemUiVisibility(f);
            web.setBackgroundColor(color);
        });
    }

    /** Puente JS ↔ nativo. Solo responde si la página actual es tu backend. */
    private class Bridge {
        @JavascriptInterface
        public void setBars(boolean dark) {
            if (!trusted) return;
            applyBars(dark ? 0xFF000000 : 0xFFFFFFFF, dark);
        }

        /** none | off | nohce | ready */
        @JavascriptInterface
        public String nfcState() {
            if (!trusted) return "none";
            NfcAdapter a = NfcAdapter.getDefaultAdapter(MainActivity.this);
            if (a == null) return "none";
            if (!a.isEnabled()) return "off";
            if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)) return "nohce";
            return "ready";
        }

        @JavascriptInterface
        public void nfcArm(String token, int seconds) {
            if (!trusted || locked) return;
            NfcPayService.arm(token, seconds);
            NfcPayService.onRead = () -> runOnUiThread(() ->
                    web.evaluateJavascript("window.dispatchEvent(new Event('pz-nfc-read'))", null));
        }

        @JavascriptInterface
        public void nfcDisarm() {
            NfcPayService.disarm();
        }

        @JavascriptInterface
        public void nfcSettings() {
            if (!trusted) return;
            try {
                startActivity(new Intent(Settings.ACTION_NFC_SETTINGS));
            } catch (Exception ignored) {
            }
        }

        /** Guardado de CSV/extractos (los enlaces blob: no funcionan en un WebView). */
        @JavascriptInterface
        public void saveFile(String name, String text, String mime) {
            if (!trusted) return;
            try {
                String safe = name == null ? "archivo.csv" : name.replaceAll("[^A-Za-z0-9._-]", "_");
                byte[] data = text.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime == null ? "text/csv" : mime.split(";")[0]);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    try (OutputStream o = getContentResolver().openOutputStream(uri)) {
                        o.write(data);
                    }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    try (OutputStream o = new FileOutputStream(new File(dir, safe))) {
                        o.write(data);
                    }
                }
                toast("Guardado en Descargas: " + safe);
            } catch (Exception e) {
                toast("No se ha podido guardar el archivo");
            }
        }
    }

    private void toast(final String m) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, m, Toast.LENGTH_LONG).show());
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
        web.onPause();
        NfcPayService.disarm(); // el token NFC solo vale con la app abierta
        if (!locked) leftAt = SystemClock.elapsedRealtime();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (!locked && shouldLock()) lock();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
