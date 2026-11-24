// Offline mode (More → Offline mode). Registered only while it's on.
//
// The page asks it to download the app's files (the list the build writes,
// offline-files.json) into one store per version. Files are then served from
// that store, so the app opens and works with no connection. The page itself
// is fetched from the site first while online (so a new version shows up),
// and from the store when there's no connection.
//
// An own update package (Settings → Update, src/ui/package.ts) is kept in the
// store "sg-package": while it is there, it is the app - every file, the page
// too, comes from it first, online or not.

const PREFIX = "sg-offline-";
const PACKAGE = "sg-package";
const scope = self.registration.scope;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

async function tell(msg) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg);
}

let running = null;

/** Store every file of the site's current version. `keep`: the version the open page runs (not removed). */
async function download(fresh, keep) {
  let list;
  try {
    list = await (await fetch(new URL("offline-files.json", scope).href, { cache: "no-store" })).json();
  } catch {
    await tell({ type: "offline-failed", reason: "offline" });
    return;
  }
  const name = PREFIX + list.build;
  if (fresh) await caches.delete(name);
  const store = await caches.open(name);
  let done = 0;
  try {
    for (const f of list.files) {
      const url = new URL(f, scope).href;
      if (!(await store.match(url))) {
        // A file an older version already has (the same name means the same contents) is copied over.
        const same = f !== "./" && f !== "index.html" && !fresh ? await caches.match(url, { ignoreVary: true }) : null;
        const res = same ?? (await fetch(url, { cache: "no-cache" }));
        if (!res.ok) throw new Error(String(res.status));
        await store.put(url, res);
      }
      done++;
      await tell({ type: "offline-progress", done, total: list.files.length });
    }
  } catch {
    await tell({ type: "offline-failed", reason: "network" });
    return;
  }
  for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== name && k !== PREFIX + keep) await caches.delete(k);
  await tell({ type: "offline-ready", build: list.build });
}

self.addEventListener("message", (e) => {
  if (e.data?.type !== "download") return;
  running ??= download(!!e.data.fresh, e.data.keep).finally(() => (running = null));
  e.waitUntil(running);
});

/** The page from the store (the newest version stored). */
async function storedPage() {
  const names = (await caches.keys()).filter((k) => k.startsWith(PREFIX));
  for (const n of names.reverse()) {
    const hit = (await (await caches.open(n)).match(scope)) ?? (await (await caches.open(n)).match(new URL("index.html", scope).href));
    if (hit) return hit;
  }
  return Response.error();
}

/** The package's copy of a request (the page for a page), or nothing. */
async function fromPackage(req) {
  if (!(await caches.has(PACKAGE))) return null;
  const store = await caches.open(PACKAGE);
  if (req.mode === "navigate") return (await store.match(scope)) ?? (await store.match(new URL("index.html", scope).href)) ?? null;
  return (await store.match(req, { ignoreSearch: true, ignoreVary: true })) ?? null;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // The update check always asks the site.
  if (url.searchParams.has("check") || url.pathname.endsWith("offline-files.json")) return;
  e.respondWith(fromPackage(req).then((hit) => hit ?? site(req)));
});

/** Offline mode's way: the page from the site (the stored one with no connection), the rest from the store. */
function site(req) {
  if (req.mode === "navigate") {
    // Online: the site's page (a new version shows up). Offline or very slow: the stored one.
    return new Promise((resolve) => {
      let settled = false;
      const fallback = () => {
        if (settled) return;
        settled = true;
        storedPage().then(resolve);
      };
      const timer = setTimeout(fallback, 6000);
      fetch(req)
        .then((res) => {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          resolve(res);
        })
        .catch(() => {
          clearTimeout(timer);
          fallback();
        });
    });
  }
  return caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(req));
}
