package app.supergeometry.android;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import android.os.Handler;
import android.os.Looper;

import com.samsung.android.sdk.penremote.AirMotionEvent;
import com.samsung.android.sdk.penremote.ButtonEvent;
import com.samsung.android.sdk.penremote.SpenRemote;
import com.samsung.android.sdk.penremote.SpenUnit;
import com.samsung.android.sdk.penremote.SpenUnitManager;

import org.json.JSONObject;

import java.io.OutputStream;

/**
 * superGeometry.app in a window of its own. The page is the site's (so it
 * updates with every deploy, and works offline once Offline mode stored it);
 * this adds what a browser here doesn't give the page:
 * - a pen hovering over the screen (an S Pen): passed on to the page as the
 *   pen's pointer moves, so snap marks show before it touches;
 * - exported files saved into Downloads;
 * - sharing text (a diagnostic report), and facts about the device for it.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://exquisite-eclair-ef47bf.netlify.app/";
    private static final int PICK_FILE = 1;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private long lastBack;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new PenWebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " SuperGeometryAndroid/" + versionName());
        CookieManager.getInstance().setAcceptCookie(true);

        web.addJavascriptInterface(new Bridge(), "SGAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (Uri.parse(HOME).getHost().equals(u.getHost())) return false;
                // A redirect on the way to the app (a sign-in the site asks for first) stays in the app;
                // only a link tapped to another site (help pages, support links, Reddit) opens in the browser.
                if (!req.hasGesture() || req.isRedirect()) {
                    report("info", "stays in the app: " + u);
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException e) {
                    toast("No app can open " + u);
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (!req.isForMainFrame()) return;
                String why = String.valueOf(err.getDescription());
                view.loadDataWithBaseURL(HOME, offlinePage(why), "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(Intent.createChooser(i, null), PICK_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        // Links to files on the site (the APK itself): the system's downloader.
        web.setDownloadListener((url, ua, disposition, mime, length) -> {
            if (!url.startsWith("http")) return;
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            String name = url.endsWith(".apk") ? "supergeometry.apk" : Uri.parse(url).getLastPathSegment();
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setMimeType(mime);
            ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
            toast("Pobieranie: " + name);
        });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(HOME);
        applyFullscreen();
    }

    // ------------------------------------------------------------ fullscreen

    private boolean fullscreen() {
        return getPreferences(MODE_PRIVATE).getBoolean("fullscreen", true);
    }

    /** Full screen: no status bar, no navigation bar (a swipe from an edge shows them for a moment). */
    void applyFullscreen() {
        boolean on = fullscreen();
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(!on);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                if (on) {
                    c.hide(WindowInsets.Type.systemBars());
                    c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                } else c.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(on
                    ? View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    : View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) applyFullscreen();
    }

    private String offlinePage(String why) {
        return "<!doctype html><meta name=viewport content='width=device-width'>"
                + "<body style='background:#1f2125;color:#e8e9ec;font:16px system-ui;padding:24px'>"
                + "<h2>Brak połączenia</h2><p>Aplikacja nie mogła wczytać strony (" + why.replace("<", "") + ").</p>"
                + "<p>Po pierwszym uruchomieniu z internetem włącz <b>Więcej → Tryb offline</b>: wtedy działa też bez połączenia.</p>"
                + "<p><button onclick=\"location.replace('" + HOME + "')\" style='font:inherit;padding:10px 18px'>Spróbuj ponownie</button></p></body>";
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request != PICK_FILE || fileCallback == null) {
            super.onActivityResult(request, result, data);
            return;
        }
        Uri[] out = null;
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                out = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < out.length; i++) out[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) out = new Uri[] {data.getData()};
        }
        fileCallback.onReceiveValue(out);
        fileCallback = null;
    }

    /** Back: Esc in the app (steps back out of what is open); twice quickly leaves it. */
    @Override
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        if (now - lastBack < 1500) {
            super.onBackPressed();
            return;
        }
        lastBack = now;
        web.evaluateJavascript("(function(){var t=document.activeElement||document.body;['keydown','keyup'].forEach(function(n){t.dispatchEvent(new KeyboardEvent(n,{key:'Escape',code:'Escape',bubbles:true}))})})()", null);
        toast("Wstecz jeszcze raz, aby zamknąć");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        remoteOff();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        remoteOn();
    }

    // ------------------------------------------------------------ the S Pen from afar (Samsung's S Pen Remote, over Bluetooth)
    // Its button and the pen's motion in the air, while the app is in front (as PenMouseS does it). Made into
    // presses the page acts on: one, two or three quick presses, a hold, and a hold while waving the pen (a drag).

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpenUnitManager spen;
    /** When the pen was last over or on the screen: its button then works through the screen, not from afar. */
    long lastStylus;
    private boolean rDown, rDragging, rHolding, rIgnored;
    private int rClicks;
    private float rMoved;

    private void remote(String kind, float dx, float dy) {
        web.evaluateJavascript("window.sgPenRemote&&sgPenRemote('" + kind + "'," + dx + "," + dy + ")", null);
    }

    private final Runnable rHold = () -> {
        if (!rDown || rDragging) return;
        rHolding = true;
        remote("hold", 0, 0);
    };
    private final Runnable rClick = () -> {
        if (rClicks > 0) remote("click" + Math.min(rClicks, 3), 0, 0);
        rClicks = 0;
    };

    private void onRemoteButton(int action) {
        if (action == ButtonEvent.ACTION_DOWN) {
            rIgnored = System.currentTimeMillis() - lastStylus < 400;
            if (rIgnored) return;
            rDown = true;
            rDragging = rHolding = false;
            rMoved = 0;
            main.removeCallbacks(rClick);
            main.postDelayed(rHold, 450);
        } else if (action == ButtonEvent.ACTION_UP) {
            if (rIgnored || !rDown) return;
            rDown = false;
            main.removeCallbacks(rHold);
            if (rDragging) remote("drag-end", 0, 0);
            else if (rHolding) remote("hold-end", 0, 0);
            else {
                rClicks++;
                main.postDelayed(rClick, 350);
            }
        }
    }

    private void onRemoteMotion(float dx, float dy) {
        if (!rDown || rHolding) return;
        if (!rDragging) {
            rMoved += Math.abs(dx) + Math.abs(dy);
            if (rMoved < 0.02f) return;
            rDragging = true;
            main.removeCallbacks(rHold);
            remote("drag-start", 0, 0);
        }
        remote("move", dx, dy);
    }

    private void remoteOn() {
        try {
            SpenRemote r = SpenRemote.getInstance();
            if (!r.isFeatureEnabled(SpenRemote.FEATURE_TYPE_BUTTON)) {
                report("info", "S Pen remote: this device has none");
                return;
            }
            if (r.isConnected()) return;
            r.connect(this, new SpenRemote.ConnectionResultCallback() {
                @Override
                public void onSuccess(SpenUnitManager m) {
                    spen = m;
                    // (As PenMouseS: listening right away after connecting can miss.)
                    main.postDelayed(() -> {
                        if (spen == null) return;
                        try {
                            spen.registerSpenEventListener(e -> main.post(() -> onRemoteButton(new ButtonEvent(e).getAction())), spen.getUnit(SpenUnit.TYPE_BUTTON));
                            if (r.isFeatureEnabled(SpenRemote.FEATURE_TYPE_AIR_MOTION)) {
                                spen.registerSpenEventListener(e -> {
                                    AirMotionEvent a = new AirMotionEvent(e);
                                    float dx = a.getDeltaX(), dy = a.getDeltaY();
                                    main.post(() -> onRemoteMotion(dx, dy));
                                }, spen.getUnit(SpenUnit.TYPE_AIR_MOTION));
                            }
                            report("info", "S Pen remote: connected");
                        } catch (Throwable t) {
                            report("warn", "S Pen remote: can't listen - " + t);
                        }
                    }, 1000);
                }

                @Override
                public void onFailure(int code) {
                    report("warn", "S Pen remote: connection failed (" + code + ")");
                }
            });
        } catch (Throwable t) {
            report("info", "S Pen remote unavailable: " + t);
        }
    }

    private void remoteOff() {
        main.removeCallbacks(rHold);
        main.removeCallbacks(rClick);
        rDown = false;
        try {
            if (spen != null) {
                spen.unregisterSpenEventListener(spen.getUnit(SpenUnit.TYPE_BUTTON));
                spen.unregisterSpenEventListener(spen.getUnit(SpenUnit.TYPE_AIR_MOTION));
            }
            spen = null;
            SpenRemote.getInstance().disconnect(this);
        } catch (Throwable t) {
            // not connected
        }
    }

    void toast(String text) {
        runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_SHORT).show());
    }

    String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    long versionCode() {
        try {
            PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    /** What the page can ask of the app (window.SGAndroid). */
    class Bridge {
        @JavascriptInterface
        public String info() {
            try {
                JSONObject o = new JSONObject();
                o.put("versionName", versionName());
                o.put("versionCode", versionCode());
                o.put("android", Build.VERSION.RELEASE);
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("device", Build.MANUFACTURER + " " + Build.MODEL);
                PackageInfo wv = WebView.getCurrentWebViewPackage();
                if (wv != null) o.put("webview", wv.packageName + " " + wv.versionName);
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        /** A file the page made (an export, a saved project, a report): into Downloads. */
        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("no place in Downloads");
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    os.write(bytes);
                }
                toast("Zapisano w Pobranych: " + name);
            } catch (Exception e) {
                toast("Nie udało się zapisać: " + e.getMessage());
                report("error", "saveFile " + name + ": " + e);
            }
        }

        @JavascriptInterface
        public boolean isFullscreen() {
            return fullscreen();
        }

        @JavascriptInterface
        public void setFullscreen(boolean on) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("fullscreen", on).apply();
            runOnUiThread(MainActivity.this::applyFullscreen);
        }

        @JavascriptInterface
        public void shareText(String text) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_SUBJECT, "superGeometry.app");
            i.putExtra(Intent.EXTRA_TEXT, text);
            runOnUiThread(() -> startActivity(Intent.createChooser(i, null)));
        }
    }

    /** A line for the page's log (Settings → Diagnostics). */
    void report(String level, String text) {
        String js = "window.sgLog&&sgLog(" + JSONObject.quote(level) + "," + JSONObject.quote(text) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    /**
     * Passes a pen's hover on to the page: a browser here gives the page no
     * pointer moves while the pen is over the screen and not touching it.
     * At most once a frame, in the view's own pixels with its width (the page scales them to its own).
     */
    class PenWebView extends WebView {
        private float hx, hy;
        private boolean pending, gone;
        private int seen;

        PenWebView(Context c) {
            super(c);
        }

        private final Runnable send = () -> {
            pending = false;
            evaluateJavascript(gone ? "window.sgNativeHover&&sgNativeHover(null)" : "window.sgNativeHover&&sgNativeHover(" + hx + "," + hy + "," + getWidth() + ")", null);
        };

        /** The pen's side button: held while touching (the touch is the button's, not the page's), or pressed while hovering. */
        private boolean touchButton, hoverButton;

        private boolean stylus(MotionEvent e) {
            int t = e.getToolType(0);
            return t == MotionEvent.TOOL_TYPE_STYLUS || t == MotionEvent.TOOL_TYPE_ERASER;
        }

        private boolean sideButton(MotionEvent e) {
            return (e.getButtonState() & (MotionEvent.BUTTON_STYLUS_PRIMARY | MotionEvent.BUTTON_SECONDARY)) != 0;
        }

        private void button(String kind, MotionEvent e) {
            evaluateJavascript("window.sgPenButton&&sgPenButton('" + kind + "'," + e.getX() + "," + e.getY() + "," + getWidth() + ")", null);
        }

        @Override
        public boolean dispatchTouchEvent(MotionEvent e) {
            if (stylus(e)) lastStylus = System.currentTimeMillis();
            if (stylus(e)) {
                int a = e.getActionMasked();
                if (a == MotionEvent.ACTION_DOWN && sideButton(e)) {
                    touchButton = true;
                    report("info", "pen side button: touch down");
                    button("touch-down", e);
                    return true;
                }
                if (touchButton) {
                    if (a == MotionEvent.ACTION_MOVE) button("touch-move", e);
                    else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) {
                        touchButton = false;
                        button(a == MotionEvent.ACTION_UP ? "touch-up" : "touch-cancel", e);
                    }
                    return true;
                }
            }
            return super.dispatchTouchEvent(e);
        }

        @Override
        public boolean dispatchGenericMotionEvent(MotionEvent e) {
            if (stylus(e)) lastStylus = System.currentTimeMillis();
            if (stylus(e)) {
                boolean b = sideButton(e);
                if (b != hoverButton) {
                    hoverButton = b;
                    report("info", "pen side button while hovering: " + (b ? "pressed" : "released"));
                    button(b ? "hover-down" : "hover-up", e);
                }
            }
            return super.dispatchGenericMotionEvent(e);
        }

        @Override
        public boolean onHoverEvent(MotionEvent e) {
            int tool = e.getToolType(0);
            if (tool == MotionEvent.TOOL_TYPE_STYLUS || tool == MotionEvent.TOOL_TYPE_ERASER) {
                int a = e.getActionMasked();
                gone = a == MotionEvent.ACTION_HOVER_EXIT;
                hx = e.getX();
                hy = e.getY();
                if (seen++ == 0) report("info", "pen hover seen by the app (tool " + tool + ")");
                if (!pending) {
                    pending = true;
                    postOnAnimation(send);
                }
            }
            return super.onHoverEvent(e);
        }
    }
}
