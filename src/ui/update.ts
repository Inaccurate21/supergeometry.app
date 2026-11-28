// Newer version available? The page checks the site now and then (and when
// you come back to it); if a new build is out, More pulses and its Update
// item carries a NEW badge - no notice over the work.
// Updating - or More → Update - clears the browser's stored copies of
// the app's files and reloads. Your project is saved first and stays.

import { el } from "./ui";
import { PACKAGE, packageInUse } from "./package";

/** The app's main script of this page (its name changes with every build). */
export function loadedBuild(): string | null {
  const s = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].map((x) => x.src).find((src) => /\/assets\/index-[\w-]+\.js/.test(src));
  return s ? (s.match(/index-[\w-]+\.js/)?.[0] ?? null) : null;
}

/**
 * The main script of the build that is out now. Asked of /version.json, a few hundred bytes that say it - the
 * whole page was fetched for this (half of all the site's requests, ten for each visit), to find one file's name
 * in it. Where there is no such file (an older build still being served), the page as before.
 */
async function liveBuild(mine: string): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?check=${Date.now()}`, { cache: "no-store" });
    const script = res.ok ? ((await res.json()) as { script?: unknown }).script : null;
    // The same as this page: nothing new, and nothing more to ask. Another: the page itself has the last word (a
    // stale copy of the small file must not put a NEW badge on a page that is the newest).
    if (script === mine) return script;
  } catch {
    // (No such file, or not what it should be: the page.)
  }
  try {
    const res = await fetch(`/?check=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.text()).match(/index-[\w-]+\.js/)?.[0] ?? null;
  } catch {
    return null; // offline: nothing to say
  }
}

/** Not asked again sooner than this (coming back to the tab asks, and people flick between tabs). */
const CHECK_APART = 5 * 60_000;

/** Offline mode's part (src/ui/offline.ts): stores a new version as it comes out. */
interface OfflineStore {
  readonly on: boolean;
  download(fresh: boolean): Promise<boolean>;
}

export class Updates {
  offline: OfflineStore | null = null;
  /** An own update package is in use (Settings → Update): the site's newer builds aren't offered over it. */
  packaged = false;

  /** `beforeReload` saves the project before the page is reloaded. */
  constructor(private beforeReload: () => Promise<void>) {
    // Only a built site has a build to compare (not the dev server).
    if (!loadedBuild()) return;
    void packageInUse().then((p) => (this.packaged = !!p));
    // A while after the start, then every ten minutes while the page is looked at, and on coming back to it if it
    // has been a while. (A tab left open out of sight asked six times an hour all day; every flick back to the
    // tab asked again.)
    const due = () => document.visibilityState === "visible" && Date.now() - this.asked >= CHECK_APART && void this.check();
    setTimeout(() => void this.check(), 20_000);
    setInterval(due, 10 * 60_000);
    document.addEventListener("visibilitychange", due);
  }

  /** When the site was last asked. */
  private asked = 0;

  /** More pulses; its Update item gets a NEW badge. */
  private markPending(): void {
    document.body.classList.add("update-pending");
    const item = document.getElementById("m-update");
    if (item && !item.querySelector(".new-badge")) item.append(el("span", "new-badge", "NEW"));
  }

  /** Is a newer build out? Marks More if so. Returns whether it is. */
  async check(): Promise<boolean> {
    if (this.packaged) return false;
    this.asked = Date.now();
    const mine = loadedBuild();
    const live = mine ? await liveBuild(mine) : null;
    if (!mine || !live || live === mine) return false;
    // Offline mode: the new version is downloaded now, so it's there next start even with no connection.
    if (this.offline?.on) await this.offline.download(false);
    this.markPending();
    return true;
  }

  /**
   * Clear every stored copy of the app's files (Cache Storage, service
   * workers) and reload from the site. The project is saved first.
   */
  async reset(): Promise<void> {
    await this.beforeReload();
    // An own update package: given up, the site's version is the one loaded.
    try {
      if ("caches" in window) await caches.delete(PACKAGE);
    } catch {
      // none
    }
    // Offline mode: the stored copy is downloaded again (the newest version), not removed.
    if (this.offline?.on && navigator.onLine) {
      await this.offline.download(true);
      location.reload();
      return;
    }
    try {
      if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
    } catch {
      // nothing stored
    }
    try {
      for (const r of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await r.unregister();
    } catch {
      // none
    }
    // A fresh address so no stored copy of the page is used.
    const url = new URL(location.href);
    url.searchParams.set("v", String(Date.now()));
    location.replace(url.toString());
  }
}
