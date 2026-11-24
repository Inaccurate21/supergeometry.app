// The app's language. The texts are written in English in the code; in Polish
// each text put on screen (a text node, a title, a placeholder, an
// aria-label) is looked up in pl.json and replaced as it appears. Texts made
// of pieces (`${n} bodies`) are kept there with {0}, {1}… in place of the
// pieces; a piece that is itself a text is translated too. In a Polish text
// {#0:bryła|bryły|brył} is the word that goes with the number in piece 0.
//
// Switched in Settings → Language (the choice is kept on this device; the app
// reloads in it). `npx tsx scripts/i18n-extract.ts` lists texts with no Polish yet.

import PL from "./pl.json";

export type Lang = "pl" | "en";
export const LANGS: readonly [Lang, string][] = [
  ["pl", "Polski"],
  ["en", "English"],
];

const KEY = "supergeometry.lang";

function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "pl" || v === "en") return v;
  } catch {
    // no storage: the default
  }
  return "pl";
}

export const lang: Lang = readLang();

/** Keep the language for the next start (the caller reloads the app). */
export function saveLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // not kept
  }
}

// ------------------------------------------------------------ the dictionary

interface Pattern {
  re: RegExp;
  /** Which placeholder each captured group is. */
  slots: number[];
  to: string;
  /** Few words of its own ("{0}: {1}", "tap {0}"): used only when every piece has Polish too. */
  loose: boolean;
  /** How much text of its own it has (the more, the surer a match). */
  own: number;
}

const exact = new Map<string, string>();
/** Patterns by the first three letters of their text (those starting with a piece: under ""). */
const patterns = new Map<string, Pattern[]>();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (lang !== "en") {
  for (const [k0, v] of Object.entries(PL as Record<string, string>)) {
    const k = k0.trim();
    if (!v || !k) continue;
    if (!/\{\d+\}/.test(k)) {
      exact.set(k, v);
      continue;
    }
    const parts = k.split(/\{(\d+)\}/);
    const slots: number[] = [];
    let src = "^";
    parts.forEach((p, i) => {
      if (i % 2) {
        slots.push(+p);
        src += "([\\s\\S]*?)";
      } else src += escapeRe(p);
    });
    src += "$";
    const head = parts[0].length >= 3 ? parts[0].slice(0, 3) : "";
    const list = patterns.get(head) ?? [];
    const own = parts.filter((_, i) => i % 2 === 0).join("").replace(/[^A-Za-z]/g, "").length;
    list.push({ re: new RegExp(src), slots, to: v, loose: own < 8, own });
    patterns.set(head, list);
  }
  // The ones with more text of their own first: they say more.
  for (const list of patterns.values()) list.sort((a, b) => b.own - a.own || a.slots.length - b.slots.length);
}

/** Polish: the word for a count (1 bryła, 2 bryły, 5 brył). */
function plural(n: number, forms: string[]): string {
  const [one, few, many] = [forms[0], forms[1] ?? forms[0], forms[2] ?? forms[1] ?? forms[0]];
  if (!Number.isInteger(n)) return few;
  const a = Math.abs(n);
  if (a === 1) return one;
  if (a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 12 || a % 100 > 14)) return few;
  return many;
}

/** The Polish of a pattern with its pieces; null when it is loose and a piece has no Polish. */
function fill(p: Pattern, caps: string[], depth: number): string | null {
  let whole = true;
  const out = p.to
    .replace(/\{#(\d+):([^}]*)\}/g, (_, i: string, forms: string) => {
      const n = parseFloat((caps[+i] ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
      return plural(Number.isFinite(n) ? n : 5, forms.split("|"));
    })
    .replace(/\{(\d+)\}/g, (_, i: string) => {
      const piece = caps[+i] ?? "";
      const t = translate(piece, depth + 1);
      if (t === piece && /[a-z]{2}/.test(piece) && piece.trim().length > 4) whole = false;
      return t;
    });
  return p.loose && !whole ? null : out;
}

function lookup(core: string, depth: number): string | null {
  const hit = exact.get(core);
  if (hit !== undefined) return hit;
  if (depth > 3) return null;
  const tryList = (list: Pattern[] | undefined) => {
    if (!list) return null;
    for (const p of list) {
      const m = p.re.exec(core);
      if (!m) continue;
      const caps: string[] = [];
      p.slots.forEach((s, i) => (caps[s] = m[i + 1]));
      // (A pattern whose pieces had no Polish either - "{0}: {1}" - gives way to the next one.)
      const out = fill(p, caps, depth);
      if (out !== null && out !== core) return out;
    }
    return null;
  };
  return tryList(patterns.get(core.slice(0, 3))) ?? tryList(patterns.get(""));
}

const cache = new Map<string, string>();
/** Texts shown with no Polish (from the console: sgUntranslated()) - for filling in pl.json. */
const missed = new Set<string>();
/** What tr() gave (not to be taken for a text with no Polish when it comes by again). */
const made = new Set<string>();
(globalThis as { sgUntranslated?: () => string[] }).sgUntranslated = () => [...missed];

function translate(s: string, depth: number): string {
  if (!s || !/[A-Za-z]{2}/.test(s)) return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  const core = m[2];
  let t = lookup(core, depth);
  // "- text", "‹  Settings", "▾ Bodies": the mark kept, the text translated.
  if (t === null) {
    const b = /^([-–•‹›▾▸⌂＋+]\s*)([\s\S]+)$/.exec(core);
    if (b) {
      const rest = lookup(b[2], depth);
      if (rest !== null) t = b[1] + rest;
    }
  }
  // A step's or a body's own number: "Sketch 01", "Extrude 03".
  if (t === null) {
    const n = /^([A-Za-z][\s\S]*?) (\d+)$/.exec(core);
    if (n) {
      const name = lookup(n[1], depth);
      if (name !== null) t = `${name} ${n[2]}`;
    }
  }
  // "Size:" when there is "Size"; "Open…" when there is "Open".
  if (t === null) {
    const p = /^([\s\S]+?)(\s*[:…]|\.\.\.)$/.exec(core);
    if (p) {
      const base = lookup(p[1], depth);
      if (base !== null) t = base + p[2];
    }
  }
  return t === null ? s : m[1] + t + m[3];
}

/** The text in the app's language. */
export function tr(s: string): string {
  if (lang === "en" || !s) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const out = translate(s, 0);
  if (out !== s) made.add(out);
  else if (!made.has(s) && missed.size < 2000 && /[a-z]{3}/.test(s)) missed.add(s.trim());
  if (cache.size > 20000) cache.clear();
  cache.set(s, out);
  return out;
}

/** Does a text on screen say `en` (or start with it) - in whichever language it is shown? */
export function says(shown: string | null | undefined, en: string, start = false): boolean {
  const s = (shown ?? "").trim();
  return start ? s.startsWith(en) || s.startsWith(tr(en)) : s === en || s === tr(en);
}

// ------------------------------------------------------------ the page

const ATTRS = ["title", "placeholder", "aria-label", "alt"];
/** What is not translated: what the person typed, code, and anything marked no-tr. */
const SKIP = "script, style, textarea, input, code, kbd, [contenteditable=''], [contenteditable='true'], #project-name, .no-tr";

function textNode(n: Text): void {
  const p = n.parentElement;
  if (!p || p.closest(SKIP)) return;
  const s = n.data;
  const t = tr(s);
  if (t !== s) n.data = t;
}

function attrs(e: Element): void {
  for (const a of ATTRS) {
    const v = e.getAttribute(a);
    if (!v) continue;
    const t = tr(v);
    if (t !== v) e.setAttribute(a, t);
  }
}

/** An element and all in it. (Titles and placeholders are translated everywhere, typed text never.) */
function element(root: Element): void {
  attrs(root);
  for (const e of root.querySelectorAll("[title], [placeholder], [aria-label], [alt]")) attrs(e);
  if (root.closest(SKIP)) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 ? ((n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) textNode(n as Text);
}

function start(): void {
  document.documentElement.lang = "pl";
  document.title = tr(document.title);
  const go = () => {
    element(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") textNode(m.target as Text);
        else if (m.type === "attributes") {
          const e = m.target as Element;
          const v = e.getAttribute(m.attributeName!);
          if (v) {
            const t = tr(v);
            if (t !== v) e.setAttribute(m.attributeName!, t);
          }
        } else
          for (const n of m.addedNodes) {
            if (n.nodeType === 3) textNode(n as Text);
            else if (n.nodeType === 1) element(n as Element);
          }
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) go();
  else document.addEventListener("DOMContentLoaded", go, { once: true });
}

if (lang !== "en" && typeof document !== "undefined") start();
