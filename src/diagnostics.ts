// Logs and a diagnostic report (Settings → Diagnostics). What happens while
// the app runs - errors, warnings, messages shown, what was opened - is kept
// (the last 400 lines, also across a reload or a crash), and a report puts
// them together with the app's version, the device, the browser and the
// settings. It can be copied, saved as a file, shared, or sent: sending posts
// it to this site's own function (netlify/functions/diag.mjs), which writes
// it to the site's log under a short code, to be looked at from there.
// No project content is in it: only the kinds of steps and how many.

const KEY = "supergeometry.log";
const MAX = 400;

export interface LogLine {
  t: number;
  level: "info" | "warn" | "error";
  text: string;
}

let lines: LogLine[] = [];
try {
  lines = JSON.parse(localStorage.getItem(KEY) ?? "[]") as LogLine[];
} catch {
  lines = [];
}
const started = Date.now();
let saveTimer = 0;

function save(): void {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // full: kept in memory only
    }
  }, 500);
}

const clip = (s: string, n = 2000) => (s.length > n ? `${s.slice(0, n)}…` : s);

function str(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}${v.stack ? `\n${v.stack.split("\n").slice(1, 6).join("\n")}` : ""}`;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Add a line to the log. */
export function log(level: LogLine["level"], ...parts: unknown[]): void {
  lines.push({ t: Date.now(), level, text: clip(parts.map(str).join(" ")) });
  if (lines.length > MAX) lines.splice(0, lines.length - MAX);
  save();
}

export function logLines(): readonly LogLine[] {
  return lines;
}

export function clearLog(): void {
  lines = [];
  save();
}

// ------------------------------------------------------------ what is caught by itself

if (typeof window !== "undefined") {
  log("info", `--- start ${new Date(started).toISOString()} · version ${__APP_VERSION__} · ${location.href}`);
  for (const level of ["error", "warn"] as const) {
    const orig = console[level].bind(console);
    console[level] = (...a: unknown[]) => {
      log(level, ...a);
      orig(...a);
    };
  }
  window.addEventListener("error", (e) => log("error", `Uncaught: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`, e.error ?? ""));
  window.addEventListener("unhandledrejection", (e) => log("error", "Unhandled rejection:", e.reason));
  // The native Android app reports its own events here (see android/).
  (window as unknown as { sgLog: (level: string, text: string) => void }).sgLog = (level, text) => log(level === "error" ? "error" : level === "warn" ? "warn" : "info", `[android] ${text}`);
}

// ------------------------------------------------------------ the report

/** Things about the app as it is now (added by the app: its steps, settings, the update package…). */
const sections: (() => Record<string, unknown>)[] = [];
export function addReportSection(fn: () => Record<string, unknown>): void {
  sections.push(fn);
}

function webgl(): string {
  try {
    const c = document.createElement("canvas");
    const g = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!g) return "none";
    const ext = g.getExtension("WEBGL_debug_renderer_info");
    return `${g instanceof WebGL2RenderingContext ? "WebGL2" : "WebGL1"} · ${ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)}`;
  } catch {
    return "?";
  }
}

export function androidInfo(): Record<string, unknown> | null {
  const a = (window as unknown as { SGAndroid?: { info?: () => string } }).SGAndroid;
  if (!a?.info) return null;
  try {
    return JSON.parse(a.info()) as Record<string, unknown>;
  } catch {
    return { error: "info() failed" };
  }
}

export async function buildReport(note: string): Promise<string> {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; mobile?: boolean } };
  let storage = "";
  try {
    const e = await navigator.storage?.estimate?.();
    if (e) storage = `${((e.usage ?? 0) / 1e6).toFixed(1)} MB of ${((e.quota ?? 0) / 1e6).toFixed(0)} MB`;
  } catch {
    // unknown
  }
  const info: Record<string, unknown> = {
    version: __APP_VERSION__,
    when: new Date().toISOString(),
    runningFor: `${Math.round((Date.now() - started) / 1000)} s`,
    url: location.href,
    userAgent: navigator.userAgent,
    platform: nav.userAgentData?.platform ?? navigator.platform,
    language: navigator.language,
    screen: `${screen.width}×${screen.height} · window ${innerWidth}×${innerHeight} · dpr ${devicePixelRatio}`,
    pointer: `coarse ${matchMedia("(pointer: coarse)").matches} · hover ${matchMedia("(hover: hover)").matches} · touch points ${navigator.maxTouchPoints}`,
    displayMode: ["standalone", "fullscreen", "minimal-ui", "browser"].find((m) => matchMedia(`(display-mode: ${m})`).matches) ?? "?",
    memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : "?",
    cores: navigator.hardwareConcurrency,
    webgl: webgl(),
    storage,
    online: navigator.onLine,
    serviceWorker: !!navigator.serviceWorker?.controller,
    android: androidInfo(),
  };
  for (const s of sections) {
    try {
      Object.assign(info, s());
    } catch (e) {
      info[`section error ${sections.indexOf(s)}`] = str(e);
    }
  }
  const head = Object.entries(info)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");
  const body = lines.map((l) => `${new Date(l.t).toISOString().slice(11, 23)} ${l.level.toUpperCase().padEnd(5)} ${l.text}`).join("\n");
  return `superGeometry.app diagnostic report\n\n${note.trim() ? `What happened (from the user):\n${note.trim()}\n\n` : ""}${head}\n\n--- log (${lines.length} lines) ---\n${body}\n`;
}

/** Send the report to this site's function; resolves with its code. */
export async function sendReport(report: string): Promise<string> {
  const res = await fetch("./.netlify/functions/diag", { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: report });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { id } = (await res.json()) as { id: string };
  return id;
}
