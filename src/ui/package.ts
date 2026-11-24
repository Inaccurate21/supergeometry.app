// Own update package (Settings → Update): a .zip of a build of the app - the
// dist folder that `npm run build` writes, which `npm run package` zips - read
// from this device. Its files are kept in the browser (Cache Storage, under
// PACKAGE) and public/sw.js serves them in place of the site's: the app then
// runs that version, even in an installed app (PWA) and with no connection.
// Removing it (or More → Update) goes back to the site's version.

import { unzipSync } from "fflate";
import { loadedBuild } from "./update";

/** The store the package's files are kept in (public/sw.js reads it by this name). */
export const PACKAGE = "sg-package";
/** What the package is, kept beside its files. */
const META = "__sg-package.json";

export interface PackageInfo {
  /** The package file's name. */
  name: string;
  /** Its main script (names the build). */
  build: string;
  /** When it was loaded (ISO time). */
  loaded: string;
  /** The app's version in it, when it says. */
  version?: string;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  webmanifest: "application/manifest+json",
  wasm: "application/wasm",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
};

const typeOf = (path: string) => TYPES[path.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

/** Can this browser run a package (a built app over https or localhost)? */
export function packagesSupported(): boolean {
  return "serviceWorker" in navigator && "caches" in window && window.isSecureContext && !!loadedBuild();
}

const scope = () => new URL("./", location.href).href;

/** The package in use, if there is one. */
export async function packageInUse(): Promise<PackageInfo | null> {
  try {
    if (!("caches" in window) || !(await caches.has(PACKAGE))) return null;
    const res = await (await caches.open(PACKAGE)).match(new URL(META, scope()).href);
    return res ? ((await res.json()) as PackageInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Read the package file and keep its files for the service worker. Resolves
 * with what it is, or rejects with a sentence to show. The caller reloads.
 */
export async function loadPackage(file: File, progress: (text: string) => void): Promise<PackageInfo> {
  if (!packagesSupported()) throw new Error("This browser can't run an update package here (it needs the built app, over https or on localhost).");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("That file isn't a .zip that can be read.");
  }
  // The app's folder: where its index.html is (the zip may hold it inside a folder).
  const pages = Object.keys(entries).filter((p) => /(^|\/)index\.html$/.test(p) && !p.includes("__MACOSX"));
  pages.sort((a, b) => a.split("/").length - b.split("/").length);
  const page = pages[0];
  if (!page) throw new Error("No index.html in that .zip: it has to be the app's built folder (dist).");
  const root = page.slice(0, -"index.html".length);
  const html = new TextDecoder().decode(entries[page]);
  const build = html.match(/index-[\w-]+\.js/)?.[0];
  if (!build || !entries[`${root}assets/${build}`]) throw new Error("That .zip isn't a build of superGeometry.app (its main script is missing).");
  let version: string | undefined;
  try {
    version = (JSON.parse(new TextDecoder().decode(entries[`${root}version.json`])) as { version?: string }).version;
  } catch {
    // no version.json: fine
  }
  const files = Object.keys(entries).filter((p) => p.startsWith(root) && !p.endsWith("/") && !p.includes("__MACOSX"));

  // The service worker that serves them (it stays registered while a package is in use).
  progress("…");
  await navigator.serviceWorker.register("./sw.js");
  await navigator.serviceWorker.ready;

  await caches.delete(PACKAGE);
  const store = await caches.open(PACKAGE);
  const base = scope();
  let done = 0;
  for (const p of files) {
    const rel = p.slice(root.length);
    // (The service worker comes from the site: a package's own one would be the site's from then on.)
    if (rel === "sw.js") continue;
    const body = new Blob([entries[p] as BlobPart], { type: typeOf(rel) });
    await store.put(new URL(rel, base).href, new Response(body, { headers: { "Content-Type": typeOf(rel) } }));
    if (rel === "index.html") await store.put(base, new Response(body, { headers: { "Content-Type": typeOf(rel) } }));
    done++;
    if (done % 10 === 0) progress(`${Math.round((100 * done) / files.length)}%`);
  }
  const info: PackageInfo = { name: file.name, build, loaded: new Date().toISOString(), version };
  await store.put(new URL(META, base).href, new Response(JSON.stringify(info), { headers: { "Content-Type": "application/json" } }));
  // Ask the browser not to clear it when space runs low.
  void navigator.storage?.persist?.().catch(() => false);
  return info;
}

/** Stop using the package: the site's version loads again (the caller reloads). */
export async function removePackage(keepWorker: boolean): Promise<void> {
  try {
    await caches.delete(PACKAGE);
    if (!keepWorker) for (const r of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await r.unregister();
  } catch {
    // nothing kept
  }
}
