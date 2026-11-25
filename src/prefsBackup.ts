// The app's settings (everything it keeps in localStorage under "supergeometry…" and "sg.…": preferences, the
// language, the tools' variants, shortcuts) kept in two more places, so an update never starts them over: in the
// Android app's own storage (SGAndroid.savePrefs), and in the browser's Cache Storage. Started with none in
// localStorage (the WebView's storage lost, the site's data cleared but the cache kept), they come back from
// there. Asked for: "make sure an update doesn't reset the settings".
//
// Imported first by settings.ts: the Android copy comes back before the settings are read.

const CACHE = "sg-prefs";
const MARK = "supergeometry.settings.v1";
const mine = (k: string) => k.startsWith("supergeometry") || k.startsWith("sg.");

type Bridge = { savePrefs?(json: string): void; loadPrefs?(): string };
const bridge = (): Bridge | undefined => (globalThis as { SGAndroid?: Bridge }).SGAndroid;

/** Everything kept, as one JSON text. */
export function prefsSnapshot(): string {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && mine(k)) out[k] = localStorage.getItem(k) ?? "";
    }
  } catch {
    // no storage
  }
  return JSON.stringify(out);
}

/** Put a snapshot back (only the app's own keys). */
export function restorePrefs(json: string): number {
  let n = 0;
  try {
    const o = JSON.parse(json) as Record<string, string>;
    for (const [k, v] of Object.entries(o)) if (mine(k) && typeof v === "string") (localStorage.setItem(k, v), n++);
  } catch {
    // not a snapshot
  }
  return n;
}

function empty(): boolean {
  try {
    return !localStorage.getItem(MARK);
  } catch {
    return false;
  }
}

// The Android copy, at once (it is read synchronously).
try {
  if (empty()) {
    const saved = bridge()?.loadPrefs?.();
    if (saved) restorePrefs(saved);
  }
} catch {
  // no bridge
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Keep the copies up to date (a moment after a change). */
export function backupPrefs(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const snap = prefsSnapshot();
    try {
      bridge()?.savePrefs?.(snap);
    } catch {
      // no bridge
    }
    if (typeof caches !== "undefined")
      void caches
        .open(CACHE)
        .then((c) => c.put(new Request(new URL("./__sg-prefs.json", location.href).href), new Response(snap, { headers: { "Content-Type": "application/json" } })))
        .catch(() => undefined);
  }, 800);
}

/** Started with no settings but a copy in the cache: put it back and start again (once). */
export async function restoreFromCache(): Promise<void> {
  if (!empty() || typeof caches === "undefined" || sessionStorage.getItem("sg.prefsRestored")) return;
  try {
    const r = await (await caches.open(CACHE)).match(new URL("./__sg-prefs.json", location.href).href);
    if (!r) return;
    if (restorePrefs(await r.text())) {
      sessionStorage.setItem("sg.prefsRestored", "1");
      location.reload();
    }
  } catch {
    // nothing kept
  }
}

// Ask the browser to keep this site's storage when space runs low (an installed app is usually granted it).
try {
  void navigator.storage?.persist?.().catch(() => false);
} catch {
  // not offered
}
