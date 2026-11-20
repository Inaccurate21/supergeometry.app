// The sentence bar: the app worked by finishing a sentence.
//
// One line at the bottom of the screen always says where things stand, and it
// is written by touching the model: the pick is its subject ("1 face"), what
// can be done with that pick are the words offered after it (only those - a
// tool that needs something else picked is not there), the tool chosen is its
// verb, and the tool's options are the rest of the sentence: a blank to fill by
// tapping the model ("Axis ____"), a word to swap ("One side"), a number to
// type or to drag sideways ("12 mm"). The tick ends the sentence (Done), the
// eraser takes the last part back (Cancel, then the pick itself).
//
// With nothing picked the sentence starts with "Make": only what makes
// something new is offered, with the view's own tools. A thread runs from the
// subject to the thing it names on the model, so it is always plain what the
// sentence is about.
//
// It shows the very ToolItems and window parts the other ways of working
// hold (`ui.shown()`, `ui.panelContent()`), so a tool added to the app is in
// the sentence by itself. On only while its switch is (More: Sentence bar);
// off, nothing of it is on the page.

import { settings } from "../settings";
import type { Vec3 } from "../doc/types";
import type { Sel } from "../tools/tool";
import { evaluate, toDisplay, UNIT_LABEL, units } from "../units";
import type { Viewport } from "../view/viewport";
import { iconNameFor, icons, type IconName } from "./icons";
import { numpadInput, openNumpad } from "./numpad";
import { selectAll } from "./textField";
import { el, usable, type ToolItem, type UI } from "./ui";
import { ALIAS, GROUP_OF, RANK } from "./wheel";

export interface SentenceHost {
  readonly ui: UI;
  readonly view: Viewport;
  mainTools(): ToolItem[];
  /** What is picked on the model. */
  selection(): Sel[];
  /** Where the work is: the model, a sketch, a freeform shape, or another tool. */
  mode(): "model" | "sketch" | "freeform" | "tool";
  /** In a sketch: how many curves and points are picked. */
  sketchPicked(): number;
  /** Where the pick is on the model (for the thread to it). */
  anchor(): Vec3 | null;
  /** In a sketch: tap the view again where it was last tapped (a tool that acts where it is tapped, started for the piece picked there). */
  retap(): void;
}

/** One word of the sentence. */
interface Word {
  /** The same word, drawn again: it stays where it is (a new one comes in). */
  key: string;
  kind: "subject" | "verb" | "slot" | "choice" | "toggle" | "value" | "button";
  label: string;
  /** A small name over it (what the option is: "Ends", "Distance"). */
  cap?: string;
  icon?: IconName;
  swatch?: string;
  /** Lit: the tool in use, a switch that is on, the option chosen. */
  on?: boolean;
  /** A blank waiting for a tap on the model. */
  blank?: boolean;
  /** The step to take next. */
  pulse?: boolean;
  /** The subject with nothing picked, a group's name: said, not tapped. */
  quiet?: boolean;
  kbd?: string;
  run?: () => void;
  /** What it opens: a tool's kinds, a choice's other options. */
  kids?: Word[];
  /** A number: typed, or dragged sideways. */
  value?: { now: number; text: string; kind: "length" | "angle" | "number" | "int"; put(v: number): void; min?: number; max?: number };
  /** Takes the subject away (the pick let go). */
  lets?: boolean;
  /** In its place, with nothing for what is picked now: dimmed, and a tap says this. */
  off?: string;
  /** A tool with kinds that starts as it was used last on a tap (a sketch's Rectangle); its kinds on a second tap or a held press. */
  first?: boolean;
}

interface Built {
  subject: Word;
  words: Word[];
  /** Everything there is for this pick, by what it is for (the sheet over the line). */
  groups: { cap: string; words: Word[] }[];
  done?: { label: string; run: () => void; pulse?: boolean };
  cancel?: { label: string; run: () => void };
  /** A sketch's way out (its own tick: the sentence there is the whole drawing). */
  exit?: { label: string; run: () => void; pulse?: boolean };
  /** Whose sentence it is: a new subject brings every word in afresh. */
  about: string;
  /** Tools this pick has no use for, each with what it needs instead (said under everything it does offer). */
  others?: string[];
}

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** A tick under the finger (phones that have it). */
const buzz = (ms: number | number[] = 5) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // (not allowed here: nothing lost)
  }
};
const notSep = (it: ToolItem) => !it.id.startsWith("---");
const needsPick = (it: ToolItem) => !!(it.run as { needsPick?: boolean } | undefined)?.needsPick;

/** Started with nothing picked, these change what is there (they are offered once the bodies or the edge are picked). */
const CHANGES = new Set(["offsetEdge", "subtract", "intersect"]);

/** Only what makes something new (nothing picked): a tool that asks for a pick after its tap is left out, with any group left empty. */
function makers(items: ToolItem[]): ToolItem[] {
  const out: ToolItem[] = [];
  for (const it of items) {
    if (CHANGES.has(it.id)) continue;
    if (it.children?.length) {
      const children = makers(it.children);
      const runs = it.run && !needsPick(it);
      if (!children.length && !runs) continue;
      out.push({ ...it, children, run: runs ? it.run : undefined });
    } else if (it.run && !needsPick(it)) out.push(it);
  }
  return out;
}

/** In a sketch: tools for curves that are picked (the rest draw something new). */
const SK_PICKED = new Set(["move", "rotate", "scale", "mirror", "pattern", "offset", "fillet", "trim", "extend", "split", "align", "delete"]);
/** Of those, the ones that act where the view is tapped: started for the piece picked, at the place it was picked. */
const SK_RETAP = new Set(["trim", "extend", "split", "offset", "fillet"]);
/** And of those, the ones done at that tap (nothing more to set): picking is on again after it. */
const SK_ONCE = new Set(["trim", "split"]);
/** The model's groups, in the order they are on the line (the tool wheel's own, each always in its place). */
const GROUPS = ["create", "combine", "modify", "construct", "transform", "freeform", "sketch"];
/** A sketch's groups (as its wheel has them): what each holds, most used first; anything else is under More. */
const SK_GROUPS: { id: string; label: string; icon: IconName; tools: string[] }[] = [
  { id: "draw", label: "Draw", icon: "line", tools: ["line", "rect", "circle", "arc", "spline", "polygon", "ellipse", "text", "project"] },
  { id: "modify", label: "Modify", icon: "trim", tools: ["trim", "fillet", "offset", "extend", "split", "align"] },
  { id: "transform", label: "Transform", icon: "transform", tools: ["move", "mirror", "rotate", "pattern", "scale"] },
];

export class Sentence {
  private readonly root = el("div", "");
  private readonly sheet = el("div", "sn-sheet");
  private readonly line = el("div", "sn-line");
  private readonly row = el("div", "sn-row");
  private readonly end = el("div", "sn-end");
  /** More of the line to the left, to the right: a button each (a mouse has no finger to slide it with). */
  private readonly back = el("button", "sn-edge sn-edge-back");
  private readonly fore = el("button", "sn-edge sn-edge-fore");
  private readonly thread = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  private readonly threadPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  private readonly threadDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  private queued = false;
  private built: Built | null = null;
  /** What the sheet shows: every word for the pick, one word's kinds, or a number being typed. */
  private open: { kind: "all" } | { kind: "kids"; key: string } | { kind: "type"; key: string } | null = null;
  private typing: { end(keep: boolean): void } | null = null;
  private about = "";
  /** The thread's ends as last drawn (drawn again only when one moved). */
  private threadSig = "";
  private anchor: Vec3 | null = null;
  /** Where the view is on the page (measured again only when the page is laid out anew). */
  private viewAt: { left: number; top: number } | null = null;
  /** What was picked when the tool now running was started: the sentence still starts with it. */
  private lastPick = "";

  constructor(private readonly host: SentenceHost) {
    this.root.id = "sentence";
    this.root.hidden = true;
    this.back.innerHTML = this.fore.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
    this.back.title = "Earlier in the line";
    this.fore.title = "More of the line";
    this.line.append(this.back, this.row, this.fore, this.end);
    const slide = (by: number) => this.row.scrollBy({ left: by * Math.max(160, this.row.clientWidth * 0.7), behavior: calm() ? "auto" : "smooth" });
    this.back.addEventListener("click", () => slide(-1));
    this.fore.addEventListener("click", () => slide(1));
    // A mouse's wheel slides the line (it has only up and down to give).
    this.row.addEventListener(
      "wheel",
      (e) => {
        if (this.row.classList.contains("sn-wrap") || this.row.scrollWidth <= this.row.clientWidth + 1) return;
        e.preventDefault();
        this.row.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        this.edges();
      },
      { passive: false },
    );
    this.root.append(this.sheet, this.line);
    this.sheet.hidden = true;
    this.thread.id = "sentence-thread";
    this.thread.setAttribute("aria-hidden", "true");
    this.threadDot.setAttribute("r", "3.5");
    this.thread.append(this.threadPath, this.threadDot);
    document.body.append(this.thread, this.root);
    // (Never through to the model: a press on the line is the line's.)
    for (const type of ["pointerdown", "pointerup", "click", "dblclick", "wheel", "contextmenu"] as const) this.root.addEventListener(type, (e) => e.stopPropagation());
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());
    // A press anywhere else puts the sheet away (and is whatever it is there).
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.open || this.root.contains(e.target as Node) || (e.target as HTMLElement).closest?.(".numpad")) return;
        this.typing?.end(true);
        this.close();
      },
      true,
    );
    // Esc puts the sheet away first (then it is the tool's, as ever).
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || !this.open || this.typing) return;
        e.stopPropagation();
        e.preventDefault();
        this.close();
      },
      true,
    );
    // The column, the bar or the tool's window changed: the sentence is said again.
    const ui = host.ui;
    const tools = ui.onTools;
    ui.onTools = () => (tools?.(), this.changed());
    const panel = ui.onPanel;
    ui.onPanel = () => (panel?.(), this.changed());
    settings.onChange(() => this.sync());
    // (How tall the line is now - a tool's sentence can run to a second line: undo and the guide text on a phone sit just over it.)
    new ResizeObserver(() => document.body.style.setProperty("--sn-line", `${Math.round(this.line.getBoundingClientRect().height)}px`)).observe(this.line);
    host.view.frameHooks.add(() => this.drawThread());
    // (The line slid along: the thread still starts at its subject, or at the line's near end once that is out of sight.)
    this.row.addEventListener("scroll", () => ((this.threadSig = ""), this.drawThread(), this.edges()), { passive: true });
    new ResizeObserver(() => this.edges()).observe(this.row);
    // (Items or History opened or closed: the room for the line changed.)
    new MutationObserver(() => this.place()).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // (And the kind of screen: a phone's line is laid out by the stylesheet.)
    new MutationObserver(() => this.place()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-screen"] });
    addEventListener("resize", () => {
      this.place();
      this.viewAt = null;
      if (this.on) ((this.threadSig = ""), this.drawThread());
    });
    this.sync();
  }

  get on(): boolean {
    return settings.value.sentence;
  }

  /** On or off: off, the line and its thread are away and the page is as it was. */
  private sync(): void {
    const on = this.on;
    document.body.classList.toggle("sentence-ui", on);
    if (this.root.hidden === !on) return void (on && this.changed());
    this.root.hidden = !on;
    if (!on) {
      this.typing?.end(false);
      this.open = null;
      this.sheet.hidden = true;
      this.thread.classList.remove("on");
      this.threadSig = "";
      document.body.classList.remove("sn-open");
      return;
    }
    this.changed();
  }

  /**
   * Where the line goes on a wide screen: in the middle of the room between
   * undo (which steps aside for Items) and History when that is open, never
   * over either. (A phone's line has the whole bottom edge: the stylesheet's.)
   */
  private placed = "";
  private place(): void {
    if (!this.on) return;
    let to = "";
    if (document.documentElement.dataset.screen !== "phone") {
      const dock = document.getElementById("undo-dock")?.getBoundingClientRect();
      const hist = document.body.classList.contains("history-open") ? document.getElementById("history")?.getBoundingClientRect() : undefined;
      const left = Math.round((dock && dock.width ? dock.right : 0) + 10);
      const right = Math.round(hist && hist.width && hist.left > innerWidth / 2 ? innerWidth - hist.left + 10 : left > 140 ? 12 : left);
      to = `${left}|${right}|${innerWidth}`;
    }
    if (to === this.placed) return;
    this.placed = to;
    const [l, r] = to.split("|");
    this.root.style.left = to ? `${l}px` : "";
    this.root.style.right = to ? `${r}px` : "";
    // (No wider than that room: past it the line slides.)
    this.root.style.maxWidth = to ? `${Math.max(200, Math.min(980, innerWidth - Number(l) - Number(r)))}px` : "";
    this.threadSig = "";
  }

  /** Something it shows changed: drawn again once, after whatever else changes with it. */
  changed(): void {
    if (!this.on || this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (this.on) this.render();
    });
  }

  // ------------------------------------------------------------ what it says

  private build(): Built {
    const { ui } = this.host;
    const mode = this.host.mode();
    const { column, bar } = ui.shown();
    const panel = ui.panelContent();
    if (mode === "sketch") return this.sketch(column, bar, panel);
    if (mode === "model" && !panel) return this.model(column, bar);
    return this.tool(column, panel, mode);
  }

  /** A tool or action as a word (its kinds, the words it opens). */
  private verb(it: ToolItem, pre = "v"): Word {
    const kids = (it.children ?? []).filter(notSep).map((c) => this.verb(c, `${pre}-${it.id}`));
    const v = it.value;
    return {
      key: `${pre}-${it.id}`,
      kind: v ? "value" : "verb",
      label: it.short ?? it.label,
      icon: it.swatch ? undefined : it.icon,
      swatch: it.swatch,
      on: it.active,
      pulse: it.pulse,
      kbd: it.shortcut,
      run: it.run ? () => it.run!() : undefined,
      kids: kids.length ? kids : undefined,
      first: !!it.variantsWhenActive && !!it.run,
      value: v ? { now: Number(v.now) || 0, text: v.now, kind: v.int ? "int" : "number", put: (n) => v.put(n), min: v.min, max: v.max } : undefined,
    };
  }

  /** A group on the line: its tools a tap away, or - with nothing in it for this pick - dimmed in its place, saying why. */
  private group(id: string, label: string, icon: IconName, words: Word[], why: string): Word {
    // (Sketch with nothing picked is the tool itself: a tap starts it.)
    if (words.length === 1 && words[0].label === label && !words[0].kids) return { ...words[0], key: `g-${id}` };
    return { key: `g-${id}`, kind: "verb", label, icon, kids: words.length ? words : undefined, pulse: words.some((w) => w.pulse), off: words.length ? undefined : why };
  }

  /**
   * The model: what is picked, then the eight groups the tool wheel has, each
   * in its place - Create, Combine, Modify, Construct, Transform, Freeform,
   * Sketch, More - holding what the pick offers (with nothing picked: only
   * what makes something new, and the view's tools under More).
   */
  private model(column: ToolItem[], bar: ToolItem[]): Built {
    const sel = this.host.selection();
    const main = this.host.mainTools();
    let items = usable(column).filter(notSep);
    const view = usable(bar).filter(notSep);
    const by = new Map<string, ToolItem[]>();
    const put = (g: string, it: ToolItem) => by.set(g, [...(by.get(g) ?? []), it]);
    const rank = (it: ToolItem) => {
      const k = RANK.indexOf(ALIAS[it.id] ?? it.id);
      return k < 0 ? RANK.length : k;
    };
    let subject: Word;
    let name = "";
    let others: string[] | undefined;
    if (!sel.length) {
      // Nothing picked: each main group's makers (a group that is a tool itself - Sketch - is its own).
      for (const g of makers(items)) for (const it of g.children?.length ? g.children.filter(notSep) : [g]) put(g.id, it);
      subject = { key: "s-make", kind: "subject", label: "Make", quiet: true };
    } else {
      const des = items.find((it) => it.id === "deselect");
      items = items.filter((it) => it !== des);
      name = des?.sub ?? `${sel.length} picked`;
      // Each of its tools with the main tools of its kind (as the wheel has them); its own (Delete, Color) under More.
      const where = new Map<string, string>();
      const walk = (its: ToolItem[], g: string) => {
        for (const it of its) {
          if (!where.has(it.id)) where.set(it.id, g);
          walk(it.children ?? [], g);
        }
      };
      for (const g of main) walk([g], g.id);
      for (const it of items) put(GROUP_OF[it.id] ?? where.get(ALIAS[it.id] ?? it.id) ?? "own", it);
      subject = { key: "s-pick", kind: "subject", label: name, lets: true, run: () => des?.run?.() };
      // What it has no use for, and what those need instead: said, never offered.
      others = [];
      const whys = (its: ToolItem[]) => {
        for (const it of its) {
          if (it.disabled && it.why && it.label) others!.push(`${it.label}: ${it.why.charAt(0).toLowerCase()}${it.why.slice(1)}`);
          else if (!it.disabled) whys(it.children ?? []);
        }
      };
      whys(column);
    }
    const why = sel.length ? `Nothing here for ${name}. Pick something else, or let go of it.` : "Pick something on the model first.";
    const words: Word[] = [];
    const groups: Built["groups"] = [];
    for (const id of GROUPS) {
      const g = main.find((m) => m.id === id);
      const its = [...(by.get(id) ?? [])].sort((x, y) => rank(x) - rank(y)).map((it) => this.verb(it));
      words.push(this.group(id, g?.label ?? id, g?.icon ?? "more", its, why));
      if (its.length) groups.push({ cap: g?.label ?? id, words: its });
    }
    // More: the pick's own (Delete, Color), what is brought in, and the view's tools.
    const more = [...(by.get("own") ?? []), ...(by.get("more") ?? []), ...view].map((it) => this.verb(it));
    words.push(this.group("more", "More", "more", more, why));
    if (more.length) groups.push({ cap: sel.length ? name : "More", words: more });
    return { subject, words, groups, others, about: sel.length ? `pick:${sel.map((x) => JSON.stringify(x)).join()}` : "make" };
  }

  /** A sketch: what draws something new - and, with curves picked, what can be done with them. */
  private sketch(column: ToolItem[], bar: ToolItem[], panel: ReturnType<UI["panelContent"]>): Built {
    const picked = this.host.sketchPicked();
    const items = usable(column).filter(notSep);
    const exit = items.find((it) => it.id === "exit");
    const select = items.find((it) => it.id === "select");
    const tools = items.filter((it) => it !== exit && it !== select);
    const drawing = tools.some((it) => it.active);
    const forPick = tools.filter((it) => SK_PICKED.has(it.id));
    const retapped = (it: ToolItem): Word => {
      const w = this.verb(it);
      // (It acts where the view is tapped: on the piece picked, where it was picked. One done at that tap leaves picking on.)
      if (SK_RETAP.has(it.id) && it.run) {
        const start = (run: () => void) => () => {
          run();
          this.host.retap();
          if (SK_ONCE.has(it.id)) select?.run?.();
        };
        w.run = start(w.run!);
        for (const k of w.kids ?? []) if (k.run) k.run = start(k.run);
      }
      return w;
    };
    const words: Word[] = [];
    const groups: Built["groups"] = [];
    // A tool is on: Select puts it down (the way back to picking).
    if (drawing && select && !select.active) words.push({ ...this.verb(select), label: "Stop" });
    const mine = panel ? this.said(panel) : [];
    if (panel && mine.length) words.push({ key: "t-title", kind: "subject", label: panel.title, quiet: true }, ...mine);
    // (Said once: the window's own Delete, not the column's too.)
    const said = new Set(mine.map((w) => w.label));
    const busy = forPick.find((it) => it.active);
    if (busy) {
      // A tool for the picked curves is at work (Extend waiting for the line to reach): it alone, lit, until it is put down.
      words.push(this.verb(busy));
    } else if (tools.length) {
      // (None while its plane is still being chosen: there is nothing to draw on yet.)
      // Its groups, each in its place: Draw (always: it starts something new), Modify and Transform (for curves that are picked), More.
      const offered = (it: ToolItem) => !SK_PICKED.has(it.id) || (picked > 0 && !said.has(it.label));
      const placed = new Set<ToolItem>();
      for (const g of SK_GROUPS) {
        const its = g.tools.map((id) => tools.find((it) => it.id === id)).filter((it): it is ToolItem => !!it && offered(it));
        for (const it of its) placed.add(it);
        const w = its.map(retapped);
        words.push(this.group(g.id, g.label, g.icon, w, "Pick a line or a shape of the sketch first."));
        if (w.length) groups.push({ cap: g.label, words: w });
      }
      // (Delete: a tap, once curves are picked - unless their window has it already.)
      const del = tools.find((it) => it.id === "delete");
      if (del && offered(del)) words.push(this.verb(del));
      if (del) placed.add(del);
      const rest = [...tools.filter((it) => !placed.has(it) && offered(it)), ...usable(bar).filter(notSep)].map((it) => this.verb(it));
      if (rest.length) {
        words.push(this.group("more", "More", "more", rest, ""));
        groups.push({ cap: "More", words: rest });
      }
    }
    return {
      subject: { key: "s-sketch", kind: "subject", label: "Sketch", icon: "sketch", quiet: true },
      words,
      groups,
      done: panel?.done ? { label: "Done", run: panel.done } : undefined,
      cancel: panel?.cancel ? { label: "Cancel", run: panel.cancel } : undefined,
      exit: exit?.run ? { label: "Exit Sketch", run: () => exit.run!(), pulse: exit.pulse } : undefined,
      about: `sketch:${picked > 0 ? "picked" : drawing ? "draw" : "idle"}`,
    };
  }

  /** A tool at work: its name, then its window's parts as the rest of the sentence. */
  private tool(column: ToolItem[], panel: ReturnType<UI["panelContent"]>, mode: string): Built {
    const items = usable(column).filter(notSep);
    const out = items.find((it) => it.id === "cancel") ?? items.find((it) => it.id === "exit");
    const rest = items.filter((it) => it !== out && it.id !== "deselect").map((it) => this.verb(it, "c"));
    // (Its window says it all; a tool with none - Measure, Section View - has its own buttons.)
    const words = panel ? this.said(panel) : mode === "model" ? [] : rest;
    const title = panel?.title ?? (out?.label.startsWith("Exit ") ? out.label.slice(5) : (items.find((it) => it.active)?.label ?? out?.label ?? "Tool"));
    const cancel = panel?.cancel ?? (out?.run ? () => out.run!() : undefined);
    const name = panel?.cancel ? "Cancel" : (out?.label ?? "Cancel");
    return {
      subject: { key: "s-tool", kind: "subject", label: title, on: true, quiet: true },
      // (Its own name is said once.)
      words: words.filter((w) => !(w.label === title && w.on && !w.kids)),
      groups: [],
      done: panel?.done ? { label: "Done", run: panel.done } : undefined,
      // (A way out named Done beside the tick would be the tick twice.)
      cancel: cancel && !(panel?.done && name === "Done") ? { label: name, run: cancel } : undefined,
      about: `tool:${title}`,
    };
  }

  /** A tool's window as words: blanks, words to swap, switches, numbers, things to tap. */
  private said(p: NonNullable<ReturnType<UI["panelContent"]>>): Word[] {
    const ui = this.host.ui;
    const out: Word[] = [];
    let k = 0;
    for (const it of p.items) {
      const key = `p-${it.type}-${"label" in it && it.label ? it.label : k}`;
      k++;
      // (Not filled: a blank - what to tap for it is the guide text's to say. Filled: what it holds.)
      if (it.type === "slot") out.push({ key, kind: "slot", cap: it.label, label: it.filled ? it.value : "", blank: it.active, on: it.filled, run: () => it.onClick() });
      else if (it.type === "choice") {
        if (!it.options.length) continue;
        const now = it.options.find((o) => o.id === it.value);
        const kids = it.options.map((o): Word => ({ key: `${key}-${o.id}`, kind: "verb", label: o.label, on: o.id === it.value, run: () => it.onChange(o.id) }));
        // (One thing to do and no name - a slot's Clear: a tap.)
        if (it.options.length === 1 && !it.label) out.push({ key, kind: "button", label: it.options[0].label, run: kids[0].run });
        else out.push({ key, kind: "choice", cap: it.label, label: now?.label ?? it.options.map((o) => o.label).slice(0, 3).join(" · "), kids });
      } else if (it.type === "toggle") out.push({ key, kind: "toggle", label: it.label, on: it.value, run: () => it.onChange(!it.value) });
      else if (it.type === "number" || it.type === "slider") {
        const kind = it.type === "slider" || it.kind === "number" ? "number" : (it.kind ?? "length");
        const len = kind === "length";
        const text = it.type === "slider" ? (it.show?.(it.value) ?? String(+it.value.toFixed(2))) : len ? `${+toDisplay(it.value).toFixed(3)} ${UNIT_LABEL[units()]}` : kind === "angle" ? `${+it.value.toFixed(2)}°` : String(+it.value.toFixed(3));
        const put = (to: number) => {
          let v = to;
          if (it.type === "slider") v = Math.min(it.max, Math.max(it.min, v));
          else if (it.min !== undefined) v = Math.max(it.min, v);
          if (kind === "int") v = Math.round(v);
          it.onInput(v);
          // (A tool that does not draw its window again keeps this part: it holds the new value from now on.)
          it.value = v;
          ui.syncPanelValue(it, v);
          this.changed();
        };
        out.push({ key, kind: "value", cap: it.label, label: text, value: { now: it.value, text, kind, put, min: it.type === "slider" ? it.min : it.min, max: it.type === "slider" ? it.max : undefined } });
      } else if (it.type === "button") out.push({ key, kind: "button", label: it.label, icon: it.icon ?? iconNameFor(it.label), pulse: it.primary, run: () => it.onClick() });
      else if (it.type === "chips") {
        if (!it.chips.length) continue;
        const kids = it.chips.map((c, i): Word => ({ key: `${key}-${i}`, kind: "toggle", label: c.glyph ? `${c.glyph} ${c.label}` : c.label, on: !!c.on, run: () => c.onClick() }));
        if (kids.length <= 2) out.push(...kids);
        else out.push({ key, kind: "choice", label: it.label ?? "Add", kids });
      }
    }
    for (const a of usable(p.actions).filter(notSep)) out.push(this.verb(a, "a"));
    return out;
  }

  // ------------------------------------------------------------------ drawing

  private render(): void {
    const b = (this.built = this.build());
    const fresh = b.about !== this.about;
    this.about = b.about;
    // The pick, then its tool: the sentence goes on from the word it started with.
    if (b.about.startsWith("pick:")) this.lastPick = b.subject.label;
    else if (!b.about.startsWith("tool:")) this.lastPick = "";
    const lead: Word[] = b.about.startsWith("tool:") && this.lastPick ? [{ key: "s-was", kind: "subject", label: this.lastPick, quiet: true }] : [];
    // (Another sentence: whatever was open belonged to the last one.)
    if (fresh && this.open) {
      this.typing?.end(false);
      this.open = null;
    }
    this.fill(this.row, [...lead, b.subject, ...b.words], fresh);
    this.row.classList.toggle("sn-make", b.subject.key === "s-make");
    // (A tool's sentence is read whole: it runs on to the next line, as writing does. What a pick offers is one line to slide along.)
    this.row.classList.toggle("sn-wrap", b.about.startsWith("tool:"));
    if (fresh) this.row.scrollLeft = 0;
    // The end of the line: everything for this pick, the eraser, the tick.
    this.end.replaceChildren();
    if (b.groups.length > 1) {
      const all = this.endButton("grid", "Everything for this", () => this.toggle({ kind: "all" }));
      all.classList.add("sn-all");
      all.classList.toggle("on", this.open?.kind === "all");
      this.end.append(all);
    }
    if (b.cancel) this.end.append(this.endButton("close", b.cancel.label, () => (buzz(), b.cancel!.run())));
    if (b.done) {
      const ok = this.endButton("check", b.done.label, () => this.finish(b.done!.run));
      ok.classList.add("sn-done");
      this.end.append(ok);
    }
    if (b.exit) {
      const x = this.endButton("exit", b.exit.label, () => this.finish(b.exit!.run));
      x.classList.add("sn-exit");
      x.classList.toggle("pulse", !!b.exit.pulse);
      x.append(el("span", "sn-end-name", "Exit"));
      this.end.append(x);
    }
    this.drawSheet();
    this.place();
    this.edges();
    this.anchor = b.subject.key === "s-pick" ? this.host.anchor() : null;
    this.threadSig = "";
    this.viewAt = null;
    this.drawThread(fresh);
    // (A blank to fill: it is brought into sight.)
    const blank = this.row.querySelector<HTMLElement>(".sn-word.blank");
    if (blank) this.reveal(blank);
  }

  /** Is there more of the line out of sight, either way? Its end buttons show only then. */
  private edges(): void {
    const r = this.row;
    const more = !r.classList.contains("sn-wrap") && r.scrollWidth > r.clientWidth + 1;
    // (Both keep their room while there is more either way: one coming or going must not change how much fits.)
    this.line.classList.toggle("sn-more", more);
    this.back.classList.toggle("show", more && r.scrollLeft > 2);
    this.fore.classList.toggle("show", more && r.scrollLeft < r.scrollWidth - r.clientWidth - 2);
  }

  private endButton(icon: IconName, title: string, run: () => void): HTMLButtonElement {
    const b = el("button", "sn-end-btn");
    b.innerHTML = icons[icon] ?? "";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", run);
    return b;
  }

  /** The words in `box`, each kept if it was there (only what is new comes in). */
  private fill(box: HTMLElement, words: Word[], fresh: boolean): void {
    const old = new Map<string, HTMLElement>();
    for (const c of Array.from(box.children) as HTMLElement[]) old.set(c.dataset.key ?? "", c);
    let n = 0;
    let at: Element | null = box.firstElementChild;
    for (const w of words) {
      let d = fresh ? undefined : old.get(w.key);
      const sig = `${w.kind}|${w.label}|${w.cap ?? ""}|${w.on ? 1 : 0}|${w.blank ? 1 : 0}|${w.pulse ? 1 : 0}|${w.kids?.length ?? 0}|${w.swatch ?? ""}|${w.off ? 1 : 0}`;
      if (!d) {
        d = this.wordEl(w);
        if (!calm()) {
          d.classList.add("sn-in");
          d.style.animationDelay = `${Math.min(n++, 14) * 16}ms`;
        }
      } else {
        old.delete(w.key);
        if (d.dataset.sig !== sig) this.paint(d, w);
      }
      d.dataset.sig = sig;
      (d as HTMLElement & { word?: Word }).word = w;
      if (d !== at) box.insertBefore(d, at);
      else at = at.nextElementSibling;
    }
    for (const d of fresh ? Array.from(box.children).filter((c) => !words.some((w) => (c as HTMLElement & { word?: Word }).word === w)) : old.values()) d.remove();
  }

  private wordEl(w: Word): HTMLElement {
    const d = el("button", "sn-word");
    d.dataset.key = w.key;
    this.paint(d, w);
    const word = () => (d as HTMLElement & { word?: Word }).word ?? w;
    // A tap; a number dragged sideways; a press held on a word with kinds opens them.
    let down: { x: number; y: number; t: number; v: number; scrub: boolean; id: number } | null = null;
    let held = 0;
    d.addEventListener("pointerdown", (e) => {
      const now = word();
      down = { x: e.clientX, y: e.clientY, t: performance.now(), v: now.value?.now ?? 0, scrub: false, id: e.pointerId };
      clearTimeout(held);
      if (now.kids?.length && now.first) held = window.setTimeout(() => ((down = null), buzz(8), this.toggle({ kind: "kids", key: now.key })), 480);
    });
    d.addEventListener("pointermove", (e) => {
      const now = word();
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      if (!down.scrub && now.value && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(e.clientY - down.y) * 1.5) {
        down.scrub = true;
        clearTimeout(held);
        d.setPointerCapture(e.pointerId);
        d.classList.add("scrub");
        this.typing?.end(false);
        this.close();
      }
      if (down.scrub && now.value) this.scrub(d, now, down.v, dx);
      else if (Math.hypot(dx, e.clientY - down.y) > 9) clearTimeout(held);
    });
    const up = (e: PointerEvent) => {
      clearTimeout(held);
      if (down?.scrub) {
        d.classList.remove("scrub");
        try {
          d.releasePointerCapture(e.pointerId);
        } catch {
          // (already let go)
        }
        this.changed();
      }
    };
    d.addEventListener("pointerup", up);
    d.addEventListener("pointercancel", (e) => (up(e), (down = null)));
    d.addEventListener("click", () => {
      const was = down;
      down = null;
      // (A drag ended on it, or the held press already opened its kinds.)
      if (!was || was.scrub) return;
      this.tap(word(), d);
    });
    return d;
  }

  private paint(d: HTMLElement, w: Word): void {
    d.className = `sn-word sn-${w.kind}${d.classList.contains("sn-in") ? " sn-in" : ""}`;
    d.classList.toggle("on", !!w.on);
    d.classList.toggle("blank", !!w.blank);
    d.classList.toggle("pulse", !!w.pulse);
    d.classList.toggle("quiet", !!w.quiet);
    d.classList.toggle("capped", !!w.cap);
    d.classList.toggle("off", !!w.off);
    (d as HTMLButtonElement).disabled = !!w.quiet && !w.run && !w.kids;
    d.replaceChildren();
    if (w.cap) d.append(el("span", "sn-cap", w.cap));
    const body = el("span", "sn-body");
    if (w.swatch) {
      const sw = el("span", "sn-swatch");
      sw.style.background = w.swatch;
      body.append(sw);
    } else if (w.icon && icons[w.icon] && w.kind !== "value" && w.kind !== "choice" && w.kind !== "slot") {
      const ic = el("span", "sn-icon");
      ic.innerHTML = icons[w.icon];
      body.append(ic);
    }
    body.append(el("span", "sn-text", w.label));
    if (w.kids?.length && !w.first) body.append(el("span", "sn-more", "▾"));
    if (w.lets) body.append(el("span", "sn-x", "×"));
    if (w.kbd && matchMedia("(hover: hover) and (pointer: fine)").matches) body.append(el("kbd", "sn-kbd", w.kbd));
    d.append(body);
    d.title = w.lets ? "Let go of it" : w.value ? `${w.cap ?? w.label}: tap to type, drag sideways to change` : (w.cap ?? "");
  }

  /** A word tapped: it opens what it holds, takes a number, or does what it says. */
  private tap(w: Word, d: HTMLElement): void {
    if (w.off) return void (buzz(), this.host.ui.toast(w.off));
    if (w.value) return void this.toggle({ kind: "type", key: w.key });
    // A tool with kinds starts as it was used last; while it is the one in use, a tap shows its kinds.
    if (w.kids?.length && (!w.first || w.on)) return void this.toggle({ kind: "kids", key: w.key });
    if (!w.run) return;
    buzz();
    const stays = w.kind === "toggle" || w.kind === "slot" || d.closest(".sn-sheet") === null;
    if (!stays || this.open?.kind === "all") this.close();
    w.run();
    this.changed();
  }

  /** A number dragged sideways: so much a step, a tick under the finger at each. */
  private scrub(d: HTMLElement, w: Word, from: number, dx: number): void {
    const v = w.value!;
    // (A length steps in the unit shown; slower past the first stretch would be finer, but a step a few px wide is felt.)
    const unit = v.kind === "length" ? 1 / toDisplay(1) : 1;
    const px = v.kind === "int" ? 14 : 7;
    const steps = Math.trunc(dx / px);
    const size = v.kind === "int" ? 1 : v.kind === "angle" ? 1 : v.kind === "length" ? unit * (Math.abs(toDisplay(from)) >= 100 ? 5 : from !== 0 && Math.abs(toDisplay(from)) < 2 ? 0.1 : 1) : Math.abs(from) >= 20 ? 1 : 0.05;
    let to = from + steps * size;
    if (v.min !== undefined) to = Math.max(v.min, to);
    if (v.max !== undefined) to = Math.min(v.max, to);
    if (to === v.now) return;
    v.now = to;
    buzz(3);
    v.put(to);
    const t = d.querySelector(".sn-text");
    if (t) t.textContent = v.kind === "length" ? `${+toDisplay(to).toFixed(3)} ${UNIT_LABEL[units()]}` : v.kind === "angle" ? `${+to.toFixed(2)}°` : String(+to.toFixed(3));
  }

  /** The tick: the sentence is said - it lifts away as it is done. */
  private finish(run: () => void): void {
    buzz([6, 40, 10]);
    this.typing?.end(true);
    this.close();
    if (!calm()) {
      const r = this.row.getBoundingClientRect();
      const ghost = this.row.cloneNode(true) as HTMLElement;
      ghost.className = "sn-row sn-ghost";
      Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      ghost.scrollLeft = this.row.scrollLeft;
      document.body.append(ghost);
      ghost.animate([{ opacity: 0.9, transform: "none" }, { opacity: 0, transform: "translateY(-46px) scale(0.96)" }], { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)" }).finished.then(() => ghost.remove(), () => ghost.remove());
      setTimeout(() => ghost.remove(), 600);
    }
    run();
    this.changed();
  }

  // -------------------------------------------------------------- the sheet

  private toggle(to: NonNullable<Sentence["open"]>): void {
    const same = this.open && this.open.kind === to.kind && (to.kind === "all" || (this.open as { key: string }).key === (to as { key: string }).key);
    this.typing?.end(true);
    this.open = same ? null : to;
    buzz();
    this.drawSheet(true);
    this.end.querySelector(".sn-all")?.classList.toggle("on", this.open?.kind === "all");
  }

  private close(): void {
    if (!this.open) return;
    this.open = null;
    this.drawSheet();
    this.end.querySelector(".sn-all")?.classList.remove("on");
  }

  private find(key: string): Word | null {
    const b = this.built;
    if (!b) return null;
    const seek = (ws: Word[]): Word | null => {
      for (const w of ws) {
        if (w.key === key) return w;
        const k = w.kids && seek(w.kids);
        if (k) return k;
      }
      return null;
    };
    return seek([b.subject, ...b.words]) ?? seek(b.groups.flatMap((g) => g.words));
  }

  /** Over the line: everything for the pick by what it is for, one word's kinds, or a number's box. */
  private drawSheet(rise = false): void {
    const o = this.open;
    const b = this.built;
    // (Open over the model: the round buttons beside the pick step back for it.)
    document.body.classList.toggle("sn-open", !!o && !!b && this.on);
    if (!o || !b) {
      this.sheet.hidden = true;
      this.sheet.replaceChildren();
      return;
    }
    if (o.kind === "type") {
      if (this.typing) return;
      const w = this.find(o.key);
      if (!w?.value) return void this.close();
      this.sheet.hidden = false;
      this.sheet.className = "sn-sheet sn-typing";
      return this.type(w);
    }
    const blocks: { cap: string; words: Word[] }[] = [];
    if (o.kind === "all") blocks.push(...b.groups);
    else {
      const w = this.find(o.key);
      if (!w?.kids?.length) return void this.close();
      blocks.push({ cap: w.cap ?? w.label, words: w.kids });
    }
    this.sheet.hidden = false;
    this.sheet.className = `sn-sheet sn-${o.kind}`;
    const old = Array.from(this.sheet.children) as HTMLElement[];
    const had = old.filter((c) => c.classList.contains("sn-group"));
    const same = !rise && had.length === blocks.length && had.every((c, i) => c.dataset.cap === blocks[i].cap);
    if (!same) this.sheet.replaceChildren();
    blocks.forEach((g, i) => {
      let box = same ? had[i] : null;
      if (!box) {
        box = el("div", "sn-group");
        box.dataset.cap = g.cap;
        box.append(el("div", "sn-group-cap", g.cap), el("div", "sn-group-words"));
        this.sheet.append(box);
      }
      this.fill(box.lastElementChild as HTMLElement, g.words, !same);
    });
    this.sheet.querySelector(".sn-others")?.remove();
    if (o.kind === "all" && b.others?.length) {
      const note = el("div", "sn-others");
      note.append(el("div", "sn-group-cap", "Needs another pick"));
      for (const t of b.others.slice(0, 8)) note.append(el("div", "sn-other", t));
      this.sheet.append(note);
    }
    if (rise && !calm()) this.sheet.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 140, easing: "ease-out" });
    // (One word's kinds: over that word.)
    this.sheet.style.setProperty("--sn-at", "50%");
    if (o.kind === "kids") {
      const d = this.row.querySelector<HTMLElement>(`[data-key="${CSS.escape(o.key)}"]`);
      const lr = this.line.getBoundingClientRect();
      if (d) {
        const r = d.getBoundingClientRect();
        this.sheet.style.setProperty("--sn-at", `${Math.round(Math.min(lr.width - 20, Math.max(20, r.left + r.width / 2 - lr.left)))}px`);
      }
    }
  }

  /** A number typed right there: Enter (or a tap elsewhere) sets it, Esc leaves it as it was. */
  private type(w: Word): void {
    const v = w.value!;
    const box = el("div", "sn-type");
    box.append(el("span", "sn-type-label", w.cap ?? w.label));
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = v.kind === "length" ? String(+toDisplay(v.now).toFixed(4)) : String(+v.now.toFixed(4));
    input.dataset.kind = v.kind;
    if (v.min !== undefined) input.dataset.min = String(v.min);
    if (v.max !== undefined) input.dataset.max = String(v.max);
    numpadInput(input);
    box.append(input);
    const unit = v.kind === "length" ? UNIT_LABEL[units()] : v.kind === "angle" ? "°" : "";
    if (unit) box.append(el("span", "sn-type-unit", unit));
    this.sheet.replaceChildren(box);
    let over = false;
    const end = (keep: boolean) => {
      if (over) return;
      over = true;
      this.typing = null;
      if (keep) {
        const n = evaluate(input.value, v.kind === "int" ? "number" : v.kind);
        if (n !== null) v.put(Math.min(v.max ?? Infinity, Math.max(v.min ?? -Infinity, v.kind === "int" ? Math.round(n) : n)));
      }
      if (this.open?.kind === "type") this.open = null;
      this.sheet.hidden = true;
      this.sheet.replaceChildren();
      this.changed();
    };
    this.typing = { end };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") (e.preventDefault(), end(true));
      else if (e.key === "Escape") (e.preventDefault(), end(false));
      e.stopPropagation();
    });
    input.addEventListener("blur", () => setTimeout(() => document.activeElement !== input && end(true), 150));
    input.focus();
    selectAll(input);
    openNumpad(input);
  }

  /** A word brought into sight on the line (a blank to fill, the tool in use). */
  private reveal(d: HTMLElement): void {
    const r = d.getBoundingClientRect();
    const box = this.row.getBoundingClientRect();
    if (r.left < box.left + 8 || r.right > box.right - 8) this.row.scrollTo({ left: this.row.scrollLeft + r.left - box.left - 24, behavior: calm() ? "auto" : "smooth" });
  }

  // ------------------------------------------------------------- the thread

  /**
   * From the subject to what it names on the model: one curve, drawn again
   * only when one of its ends moved (each frame: one point projected and
   * compared).
   */
  private drawThread(fresh = false): void {
    if (!this.on) return;
    const a = this.anchor;
    const subject = a && this.row.firstElementChild;
    const s = a && this.host.view.toScreen(a);
    if (!a || !subject || !s) {
      if (this.threadSig !== "off") {
        this.threadSig = "off";
        this.thread.classList.remove("on");
      }
      return;
    }
    const c = (this.viewAt ??= this.host.view.canvas.getBoundingClientRect());
    const x1 = Math.round(c.left + s[0]);
    const y1 = Math.round(c.top + s[1]);
    const sig = `${x1},${y1}`;
    if (sig === this.threadSig && !fresh) return;
    const r = subject.getBoundingClientRect();
    const lr = this.line.getBoundingClientRect();
    const x0 = Math.round(Math.min(Math.max(r.left + r.width / 2, lr.left + 14), lr.right - 14));
    const y0 = Math.round(r.top);
    this.threadSig = sig;
    // (Up out of the word, then over to the thing: a hanging curve, never a straight wire.)
    const lift = Math.max(30, Math.min(140, (y0 - y1) * 0.55));
    this.threadPath.setAttribute("d", `M${x0} ${y0} C${x0} ${y0 - lift} ${x1} ${y1 + lift * 0.35} ${x1} ${y1}`);
    this.threadDot.setAttribute("cx", String(x1));
    this.threadDot.setAttribute("cy", String(y1));
    this.thread.classList.add("on");
    if (fresh && !calm()) {
      const len = this.threadPath.getTotalLength();
      this.threadPath.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${-len}` }, { strokeDasharray: `${len}`, strokeDashoffset: "0" }], { duration: 260, easing: "ease-out" });
      this.threadDot.animate([{ r: "9", opacity: 0 }, { r: "3.5", opacity: 1 }], { duration: 300, easing: "ease-out" });
    }
  }

  // ------------------------------------------------------------- for checks

  /** What it says now (for `sg.sentence()`): the line's words, the sheet's, the end buttons. */
  describe() {
    const b = this.built;
    const at = (d: Element) => {
      const r = d.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const words = (box: Element) =>
      Array.from(box.querySelectorAll<HTMLElement>(".sn-word")).map((d) => {
        const w = (d as HTMLElement & { word?: Word }).word;
        return { key: d.dataset.key, kind: w?.kind, cap: w?.cap, label: w?.label, ...(w?.on ? { on: true } : {}), ...(w?.blank ? { blank: true } : {}), ...(w?.kids ? { opens: w.kids.map((k) => k.label) } : {}), ...(w?.quiet ? { quiet: true } : {}), ...at(d) };
      });
    return {
      on: this.on,
      about: b?.about,
      line: words(this.row),
      end: Array.from(this.end.children).map((d) => ({ label: (d as HTMLElement).title, ...at(d) })),
      open: this.open?.kind ?? null,
      sheet: this.sheet.hidden ? [] : Array.from(this.sheet.querySelectorAll<HTMLElement>(".sn-group")).map((g) => ({ cap: g.dataset.cap, words: words(g) })),
      thread: this.thread.classList.contains("on"),
    };
  }
}
