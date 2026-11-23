// The tutorial (More > Tutorial): a first part built with a beginner, one tap at a time - a small block with a
// rounded corner. The whole screen is dimmed and takes no taps but for the one spot to tap next, which is lit, with
// a short sentence beside it. (Asked for: "building something with a beginner but you must guide them through and
// they can't click anything else. With simple guide text".)
//
// Where the beginner is, is read off the app itself each frame (the tool that is open, what is picked, what has
// been made) - not counted in steps taken. So a tap that went a little wrong (the list closed again, a face picked
// for the edge) is not a dead end: the tutorial shows what to tap from there.

import type { Vector3 } from "three";
import type { Feature, SketchEntity, Vec3 } from "../doc/types";
import type { Sel } from "../tools/tool";

/** What the tutorial reads of the app, and the little it does to it. */
export interface TutorialHost {
  /** The tool that is open ("select" when none is). */
  tool(): { id: string; kind?: string; phase?: string; pts?: unknown[]; entities?: SketchEntity[]; feature?: { distance?: number; radius?: number } };
  selection(): Sel[];
  setSelection(sel: Sel[]): void;
  features(): readonly Feature[];
  /** A point of the model on the screen (canvas pixels), or null when it is behind the eye. */
  toScreen(p: Vec3): [number, number] | null;
  canvas(): HTMLElement;
  /** A body's edges: where each one's middle is, and which way it runs. */
  edges(body: string): { mid: Vec3; dir: Vec3; type: string }[];
  bodies(): string[];
  eye(): Vector3;
  /** A new, empty project, its first sketch open on the floor. */
  newProject(): Promise<void>;
  /** Rectangle drawn corner to corner (the tutorial's two taps are its corners). */
  cornerRectangles(): void;
}

type Box = { left: number; top: number; right: number; bottom: number };
interface Step {
  n: number;
  text: string;
  /** What may be tapped: elements, or boxes on the screen. None: nothing yet (the app is busy). */
  targets: (Element | Box)[];
  /** Typing goes through (a size is being typed). */
  keys?: boolean;
}

const STEPS = 12;
const box = (x: number, y: number, half: number): Box => ({ left: x - half, top: y - half, right: x + half, bottom: y + half });

export class Tutorial {
  private shade = document.createElement("div");
  private ring = document.createElement("div");
  private card = document.createElement("div");
  private text = document.createElement("div");
  private count = document.createElement("div");
  private on = false;
  private raf = 0;
  private drawn = "";
  private finished = false;
  private lostSince = 0;

  constructor(private host: TutorialHost) {
    this.shade.className = "tut-shade";
    this.ring.className = "tut-ring";
    this.card.className = "tut-card";
    this.text.className = "tut-text";
    this.count.className = "tut-count";
    const exit = document.createElement("button");
    exit.className = "tut-exit";
    exit.textContent = "Exit tutorial";
    exit.addEventListener("click", () => this.stop());
    const foot = document.createElement("div");
    foot.className = "tut-foot";
    foot.append(this.count, exit);
    this.card.append(this.text, foot);
    // The dimmed screen takes every tap that is not on the lit spot (which it has a hole over), and does nothing.
    for (const type of ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "contextmenu", "wheel", "touchstart", "touchmove"]) {
      this.shade.addEventListener(
        type,
        (e) => {
          e.stopPropagation();
          if (type !== "pointermove" && e.cancelable) e.preventDefault();
        },
        { passive: false },
      );
    }
  }

  get running(): boolean {
    return this.on;
  }

  /** Begin: a new project (what is open is saved and stays in the list of projects), and the first thing to tap. */
  async start(): Promise<void> {
    if (this.on) return;
    await this.host.newProject();
    this.host.cornerRectangles();
    this.on = true;
    this.finished = false;
    this.lostSince = 0;
    this.drawn = "";
    document.body.append(this.shade, this.ring, this.card);
    document.body.classList.add("tut-on");
    window.addEventListener("keydown", this.onKey, true);
    const loop = () => {
      if (!this.on) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    if (!this.on) return;
    this.on = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKey, true);
    this.shade.remove();
    this.ring.remove();
    this.card.remove();
    document.body.classList.remove("tut-on");
  }

  /** Keys do nothing while it runs (a shortcut would start a tool the tutorial didn't ask for) - but a size being typed. */
  private keysOpen = false;
  private onKey = (e: KeyboardEvent): void => {
    // (Every key then: a phone's own keyboard sends its digits as keys with no name.)
    if (this.keysOpen && e.key !== "Escape") return;
    e.stopImmediatePropagation();
    e.preventDefault();
  };

  // ------------------------------------------------------------------ where the beginner is

  private word(key: string): Element | null {
    return document.querySelector(`#sentence [data-key="${key}"]`);
  }
  private quick(name: string): Element | null {
    return Array.from(document.querySelectorAll<HTMLElement>("button.quick-action")).find((b) => b.offsetParent && (b.title || b.textContent || "").startsWith(name)) ?? null;
  }
  /** A spot of the view, as a box on the screen: `fx`, `fy` of the way across and down the free middle of it. */
  private viewSpot(fx: number, fy: number, half = 26): Box {
    const r = this.host.canvas().getBoundingClientRect();
    // (The middle of the view: clear of the panels at its sides, the bar at its top and the line at its bottom.)
    const [w, h] = [Math.min(r.width * 0.5, 420), Math.min(r.height * 0.3, 260)];
    return box(r.left + r.width / 2 + (fx - 0.5) * w, r.top + r.height * 0.46 + (fy - 0.5) * h, half);
  }
  private at(p: Vec3, half = 24): Box | null {
    const s = this.host.toScreen(p);
    const r = this.host.canvas().getBoundingClientRect();
    return s ? box(r.left + s[0], r.top + s[1], half) : null;
  }

  private step(): Step | null {
    const h = this.host;
    const tool = h.tool();
    const features = h.features();
    const some = (t: Feature["type"]) => features.some((f) => f.type === t && !f.suppressed);
    const sel = h.selection();
    const bodies = h.bodies();
    const lit = (n: number, text: string, targets: (Element | Box | null)[], keys = false): Step => ({ n, text, targets: targets.filter((t): t is Element | Box => !!t), keys });

    // ---- the round is on: done.
    if (some("fillet") && tool.id === "select") return null;
    // ---- rounding the edge
    if (tool.id === "fillet") return lit(12, "The edge is round. Tap Done to keep it.", [document.querySelector("#sentence .sn-done")]);
    if (bodies.length && tool.id === "select") {
      const edge = sel.length === 1 && sel[0].kind === "edge";
      if (edge) return lit(11, "Tap Fillet: it rounds the edge.", [this.quick("Fillet")]);
      // (Something else was picked - a face, a corner: let go of, so the next tap picks afresh.)
      if (sel.length) h.setSelection([]);
      const eye = h.eye();
      const upright = h
        .edges(bodies[0])
        .filter((e) => e.type === "LINE" && Math.abs(e.dir[2]) > 0.9)
        .map((e) => ({ e, d: Math.hypot(e.mid[0] - eye.x, e.mid[1] - eye.y, e.mid[2] - eye.z) }))
        .sort((a, b) => a.d - b.d)[0];
      return lit(10, "You have a solid block. Now round a corner: tap this edge, right on the line.", [upright ? this.at(upright.e.mid, 20) : null]);
    }
    // ---- pulling the shape up
    if (tool.id === "extrude") {
      const typing = document.querySelector<HTMLElement>(".sn-sheet.sn-typing:not([hidden])");
      if (typing) return lit(8, "Type 10, then press Enter.", [typing, document.querySelector(".numpad")], true);
      if (!tool.feature?.distance) return lit(7, "How tall? Tap Distance.", [this.word("p-number-Distance")]);
      return lit(9, "It is a block now. Tap Done to keep it.", [document.querySelector("#sentence .sn-done")]);
    }
    // ---- drawing the outline
    if (tool.id === "sketch") {
      if (tool.phase === "plane") return lit(1, "A part starts as a flat drawing. Tap XY: you will draw on the floor.", [Array.from(document.querySelectorAll("#sentence .sn-word")).find((w) => (w.textContent ?? "").trim().startsWith("XY")) ?? null]);
      const drawn = (tool.entities ?? []).some((e) => e.kind === "rect" || e.kind === "circle" || e.kind === "polygon" || e.kind === "ellipse" || (e.kind === "polyline" && e.closed));
      if (drawn) return lit(5, "That is your outline. Tap Exit to leave the drawing.", [document.querySelector("#sentence .sn-exit")]);
      if (tool.kind === "rect") {
        return (tool.pts?.length ?? 0) === 0 ? lit(3, "Tap here: the first corner of a rectangle.", [this.viewSpot(0.2, 0.8)]) : lit(4, "Now tap here: the opposite corner.", [this.viewSpot(0.8, 0.2)]);
      }
      const rect = document.querySelector(`.sn-sheet:not([hidden]) [data-key="v-rect"]`);
      if (rect) return lit(2, "Tap Rectangle.", [rect]);
      return lit(1, "A part starts as a flat drawing. Tap Draw to see the shapes you can draw.", [this.word("g-draw")]);
    }
    // ---- the drawing is done, nothing solid yet
    if (tool.id === "select" && !bodies.length) {
      const sk = features.find((f) => f.type === "sketch" && f.entities.length);
      if (sk && sk.type === "sketch") {
        if (sel.some((s) => s.kind === "profile")) return lit(6, "Tap Extrude: it pulls the flat shape up into a solid.", [this.quick("Extrude")]);
        if (sel.length) h.setSelection([]);
        const e = sk.entities[0] as { center?: [number, number] };
        const c = e.center ?? [0, 0];
        const o = sk.plane.origin;
        return lit(6, "Tap your shape to pick it.", [this.at([o[0] + c[0], o[1] + c[1], o[2]], 22)]);
      }
      return lit(1, "A part starts as a flat drawing. Tap Sketch.", [this.word("g-sketch")]);
    }
    // (Something else is open - a tool the tutorial has no use for: nothing lit, and the card says so after a moment.)
    return { n: 0, text: "", targets: [] };
  }

  // ------------------------------------------------------------------ drawing it

  private frame(): void {
    const step = this.finished ? null : this.step();
    if (!step) {
      if (!this.finished) {
        this.finished = true;
        this.keysOpen = false;
        // (The part is theirs to look at: nothing dimmed any more, only the card.)
        this.shade.remove();
        this.ring.remove();
        window.removeEventListener("keydown", this.onKey, true);
        this.show("That is your first part. Drag to turn it, pinch or use the wheel to zoom. File has Export STL and 3MF when you want to print it.", "Done", [], "Finish");
      }
      return;
    }
    this.keysOpen = !!step.keys;
    const boxes = step.targets.map((t) => {
      if (!(t instanceof Element)) return t;
      const r = t.getBoundingClientRect();
      return r.width && r.height ? { left: r.left - 4, top: r.top - 4, right: r.right + 4, bottom: r.bottom + 4 } : null;
    }).filter((b): b is Box => !!b);
    if (!boxes.length) {
      // Nothing to light just now: the app is building, or a list is on its way. Long with nothing: a way out.
      this.lostSince ||= performance.now();
      if (performance.now() - this.lostSince > 4000) this.show("That went another way than the tutorial expected. Exit it, and start it again from More whenever you like.", "", [], "");
      else this.show(step.text || "One moment...", step.n ? `Step ${step.n} of ${STEPS}` : "", [], "");
      return;
    }
    this.lostSince = 0;
    this.show(step.text, `Step ${step.n} of ${STEPS}`, boxes, "");
  }

  private show(text: string, count: string, boxes: Box[], finish: string): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const sig = `${text}|${count}|${finish}|${W}x${H}|${boxes.map((b) => [b.left, b.top, b.right, b.bottom].map(Math.round).join()).join(";")}`;
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.text.textContent = text;
    this.count.textContent = count;
    const exit = this.card.querySelector<HTMLElement>(".tut-exit")!;
    exit.textContent = finish || "Exit tutorial";
    exit.classList.toggle("primary", !!finish);
    // The dimmed screen, a hole over each lit box (drawn both ways round: what is in a hole takes the tap itself).
    const holes = boxes.map((b) => `M${Math.round(b.left)} ${Math.round(b.top)} H${Math.round(b.right)} V${Math.round(b.bottom)} H${Math.round(b.left)} Z`).join(" ");
    this.shade.style.clipPath = `path(evenodd, "M0 0 H${W} V${H} H0 Z ${holes}")`;
    const all = boxes.length ? { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) } : null;
    const first = boxes[0];
    this.ring.hidden = !first;
    if (first) Object.assign(this.ring.style, { left: `${first.left}px`, top: `${first.top}px`, width: `${first.right - first.left}px`, height: `${first.bottom - first.top}px` });
    // The card: over what is lit when that is in the lower half, under it otherwise; in the middle with nothing lit.
    const cw = Math.min(340, W - 24);
    this.card.style.width = `${cw}px`;
    const ch = this.card.offsetHeight;
    let left = (W - cw) / 2;
    let top = (H - ch) / 2;
    if (all) {
      left = Math.max(12, Math.min(W - cw - 12, (all.left + all.right) / 2 - cw / 2));
      const above = all.top - ch - 14;
      const below = all.bottom + 14;
      top = (all.top + all.bottom) / 2 > H / 2 ? (above >= 8 ? above : below) : below + ch <= H - 8 ? below : above;
      top = Math.max(8, Math.min(H - ch - 8, top));
    }
    Object.assign(this.card.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
  }
}
