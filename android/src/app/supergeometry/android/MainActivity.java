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
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
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
