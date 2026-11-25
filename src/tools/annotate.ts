// 3D dimension annotations: a dimension line with arrowheads, an optional
// floating input (Total/Offset + value + pin), and the layer of pinned measurements.

import { BufferGeometry, ConeGeometry, Group, Line, LineBasicMaterial, LineDashedMaterial, LineSegments, Mesh, MeshBasicMaterial, Plane, Raycaster, Vector2, Vector3 } from "three";
import { mergingCommits } from "../doc/store";
import type { PinDef, Vec3 } from "../doc/types";
import { el } from "../ui/ui";
import { numpadInput, openNumpad, typingInto } from "../ui/numpad";
import { settings } from "../settings";
import { evaluate, toDisplay, trim, UNIT_LABEL, units } from "../units";
import type { Viewport } from "../view/viewport";

const COLOR = 0xdfe6f3;

/** Dashed line a→b with screen-constant arrowheads at both ends. */
class DimLine {
  readonly group = new Group();
  private line: Line;
  private heads: Mesh[];
  private a = new Vector3();
  private b = new Vector3();

  constructor(
    private view: Viewport,
    color = COLOR,
    private solid = false,
  ) {
    const opts = { color, depthTest: false, transparent: true };
    this.line = new Line(new BufferGeometry(), solid ? new LineBasicMaterial(opts) : new LineDashedMaterial({ ...opts, dashSize: 1, gapSize: 1 }));
    this.line.renderOrder = 11;
    const mat = new MeshBasicMaterial({ color, depthTest: false, transparent: true });
    this.heads = [0, 1].map(() => {
      const m = new Mesh(new ConeGeometry(0.35, 1, 12), mat);
      m.renderOrder = 11;
      return m;
    });
    this.group.add(this.line, ...this.heads);
  }

  set(a: Vec3, b: Vec3): void {
    this.a.set(...a);
    this.b.set(...b);
    this.line.geometry.setFromPoints([this.a, this.b]);
    this.layout();
  }

  layout(): void {
    const wpp = this.view.cam.worldPerPixel(this.view.height);
    if (!this.solid) {
      const mat = this.line.material as LineDashedMaterial;
      mat.dashSize = wpp * 6;
      mat.gapSize = wpp * 4;
      this.line.computeLineDistances();
    }
    const dir = this.b.clone().sub(this.a);
    const len = dir.length();
    const show = len > wpp * 20;
    dir.normalize();
    const s = wpp * 11;
    for (const [i, h] of this.heads.entries()) {
      h.visible = show;
      h.scale.setScalar(s);
      // Cone points +Y; tips sit on the ends, pointing outwards.
      const out = i === 0 ? dir.clone().negate() : dir.clone();
      h.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), out);
      h.position.copy(i === 0 ? this.a : this.b).addScaledVector(out, -s / 2);
    }
  }

  dispose(): void {
    this.line.geometry.dispose();
    this.heads.forEach((h) => h.geometry.dispose());
  }
}

export interface DimWidgetOptions {
  value: number;
  modes?: { id: string; label: string }[];
  mode?: string;
  onMode?(id: string): void;
  /** The value typed (and the text, for a formula with variables). */
  onInput?(v: number, text: string): void;
  onCommit?(): void;
  onPin?(): void;
  /** Text to restore into the input (when another tool takes over while typing). */
  typed?: string;
  focus?: boolean;
  /** Draw the dimension as a solid line of this colour (it *is* the geometry, e.g. a line being drawn). */
  solidColor?: number;
  /**
   * Keep the value box off the geometry: "side" puts it beside the middle of
   * the dimension, "beyond" past its end b (e.g. outside a fillet arc).
   * "clear": beside the middle where the line is long enough on screen for
   * the box to sit there, else back past its start a (a line just drawn:
   * the way it came from, not over its end, where the next point is tapped).
   */
  boxAt?: "middle" | "side" | "beyond" | "clear";
  /** Extra screen distance past the end for "beyond" (e.g. to clear a drag arrow there). */
  boxGap?: number;
  /** Which way "beyond" goes when the dimension has no length yet (e.g. the arrow's direction). */
  dir?: Vec3;
  /** An angle in degrees (no unit conversion, ° label) instead of a length. */
  angle?: boolean;
  /** No dimension line (just the box, e.g. at the corner between two lines). */
  noLine?: boolean;
  /**
   * The face the value belongs to, by its outward normal: seen from behind,
   * the box steps aside (the value is in the tool's card then). It sat over
   * whatever is in front of that face: a funnel's spout end, tapped from
   * below to open it too, went to Shell's thickness box on the top face.
   */
  facing?: Vec3;
  /** Variables to choose from (a ƒx menu before the pin): the value becomes that variable. */
  variables?: string[];
  onVariable?(name: string): void;
}

/**
 * A dimension in the viewport: dashed line with arrows and, at its middle,
 * a small editable value with an optional mode dropdown and a pin button.
 */
export class DimWidget {
  private line: DimLine;
  private box = el("div", "dim-widget");
  private input = document.createElement("input");
  private mid = new Vector3();
  private ends: [Vector3, Vector3] = [new Vector3(), new Vector3()];
  private boxAt: "middle" | "side" | "beyond" | "clear";
  private boxGap: number;
  private dir?: Vec3;
  private facing?: Vec3;
  private hook = () => this.layout();

  constructor(
    private view: Viewport,
    opts: DimWidgetOptions,
  ) {
    this.line = opts.solidColor !== undefined ? new DimLine(view, opts.solidColor, true) : new DimLine(view);
    this.boxAt = opts.boxAt ?? "middle";
    this.boxGap = opts.boxGap ?? 0;
    this.dir = opts.dir;
    this.facing = opts.facing;
    view.overlay.add(this.line.group);
    if (opts.modes) {
      const sel = document.createElement("select");
      for (const m of opts.modes) {
        const o = document.createElement("option");
        o.value = m.id;
        o.textContent = m.label;
        sel.append(o);
      }
      sel.value = opts.mode ?? opts.modes[0].id;
      sel.addEventListener("change", () => opts.onMode?.(sel.value));
      this.box.append(sel);
      this.modeSel = sel;
    }
    this.input.inputMode = "decimal";
    numpadInput(this.input);
    this.input.spellcheck = false;
    this.angle = !!opts.angle;
    this.line.group.visible = !opts.noLine;
    this.input.value = opts.typed ?? this.show(opts.value);
    this.input.readOnly = !opts.onInput;
    // A box you type into (the tool's other values attach under it as a list).
    this.box.classList.toggle("editable", !!opts.onInput);
    this.input.addEventListener("input", () => {
      const v = evaluate(this.input.value, this.angle ? "angle" : "length");
      this.input.classList.toggle("invalid", v === null);
      // Key by key into this box: one undo step for the value typed.
      if (v !== null) mergingCommits(this, () => opts.onInput?.(v, this.input.value));
    });
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") opts.onCommit?.();
      if (e.key === "Escape") this.input.blur();
    });
    this.box.append(this.input, el("span", "dim-unit", this.angle ? "°" : UNIT_LABEL[units()]));
    if (opts.onVariable && opts.variables?.length) {
      // ƒx: pick one of the project's variables for this value.
      const sel = document.createElement("select");
      sel.className = "dim-var";
      sel.title = "Use a variable";
      const head = document.createElement("option");
      head.value = "";
      head.textContent = "ƒx";
      sel.append(head);
      for (const name of opts.variables) {
        const o = document.createElement("option");
        o.value = name;
        o.textContent = name;
        sel.append(o);
      }
      sel.addEventListener("change", () => {
        if (sel.value) opts.onVariable!(sel.value);
      });
      this.box.append(sel);
    }
    if (opts.onPin) {
      const pin = el("button", "dim-pin", "📌");
      pin.title = "Pin this measurement";
      pin.addEventListener("click", () => opts.onPin!());
      this.box.append(pin);
    }
    // Clicks on the widget must not reach the viewport.
    this.box.addEventListener("pointerdown", (e) => e.stopPropagation());
    document.body.append(this.box);
    view.frameHooks.add(this.hook);
    view.helpers.add(this);
    if (opts.focus) {
      setTimeout(() => {
        // The numpad opens on it straight away (on touch screens focus alone may not happen) -
        // unless it opened because keys were typed: then the keyboard carries on in it.
        if (settings.value.numpad && opts.typed === undefined) return openNumpad(this.input);
        this.input.focus();
        const n = this.input.value.length;
        this.input.setSelectionRange(n, n);
      }, 0);
    }
  }

  private angle = false;

  private show(v: number): string {
    return this.angle ? trim(v, 2) : trim(toDisplay(v), 3);
  }

  get text(): string {
    return this.input.value;
  }

  set(a: Vec3, b: Vec3): void {
    this.line.set(a, b);
    this.ends[0].set(...a);
    this.ends[1].set(...b);
    this.mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    this.layout();
    this.view.requestRender();
  }

  private modeSel: HTMLSelectElement | null = null;
  /** Show another of its modes (the tool switched it). */
  setMode(id: string): void {
    if (this.modeSel) this.modeSel.value = id;
  }

  setValue(v: number): void {
    if (!typingInto(this.input)) this.input.value = this.show(v);
    this.box.classList.remove("typing", "invalid");
  }

  /** Start typing into the box with this first character (keys pressed elsewhere). */
  focusWith(ch: string): void {
    this.input.value = ch;
    this.input.focus();
    this.input.setSelectionRange(1, 1);
    this.input.dispatchEvent(new Event("input"));
  }

  /** Mark the value as not usable (e.g. a fillet radius too big for the lines). */
  markInvalid(bad: boolean): void {
    this.box.classList.toggle("invalid", bad);
  }

  /** Text typed elsewhere (keys while drawing), shown in the box with a caret. */
  setText(text: string, invalid = false): void {
    if (document.activeElement === this.input) return;
    this.input.value = text;
    this.box.classList.add("typing");
    this.box.classList.toggle("invalid", invalid);
  }

  private layout(): void {
    this.line.layout();
    let s = this.view.toScreen(this.mid);
    const sa = this.view.toScreen(this.ends[0]);
    const sb = this.view.toScreen(this.ends[1]);
    if (s && sa && sb && this.boxAt !== "middle") {
      let dx = sb[0] - sa[0];
      let dy = sb[1] - sa[1];
      // No length yet: use the given direction on screen.
      if (Math.hypot(dx, dy) < 2 && this.dir) {
        const e = this.view.toScreen(this.ends[1].clone().add(new Vector3(...this.dir).multiplyScalar(this.view.cam.worldPerPixel(this.view.height) * 50)));
        if (e) [dx, dy] = [e[0] - sb[0], e[1] - sb[1]];
      }
      const l = Math.hypot(dx, dy) || 1;
      const half = { w: this.box.offsetWidth / 2 + 10, h: this.box.offsetHeight / 2 + 10 };
      // Too short for the box beside it (it would cover both ends): behind the start.
      const behind = this.boxAt === "clear" && l < 2 * Math.hypot(half.w, half.h) + 24;
      if (behind) {
        const k = Math.abs((dx / l) * half.w) + Math.abs((dy / l) * half.h) + 6;
        s = [sa[0] - (dx / l) * k, sa[1] - (dy / l) * k];
      } else if (this.boxAt === "beyond") {
        // Past the end, far enough that the box's own size clears it.
        const k = Math.abs((dx / l) * half.w) + Math.abs((dy / l) * half.h) + this.boxGap;
        s = [sb[0] + (dx / l) * k, sb[1] + (dy / l) * k];
      } else {
        // Beside the middle, on the upper side of the line.
        let n: [number, number] = [-dy / l, dx / l];
        if (n[1] > 0) n = [-n[0], -n[1]];
        const k = Math.abs(n[0] * half.w) + Math.abs(n[1] * half.h);
        s = [s[0] + n[0] * k, s[1] + n[1] * k];
      }
    }
    // Its face turned away (seen from behind): out of the way - and out of
    // the numpad's hands (on a phone it has it from the start), the value
    // then typed in the tool's card.
    if (s && this.facing) {
      const v = this.view.cam.viewDir();
      if (v.x * this.facing[0] + v.y * this.facing[1] + v.z * this.facing[2] > 0.05) {
        s = null;
        if (this.input === document.activeElement) this.input.blur();
      }
    }
    this.box.hidden = !s;
    // The dimension on screen (the tool's options card keeps off it).
    if (sa && sb) this.box.dataset.seg = `${Math.round(sa[0])},${Math.round(sa[1])},${Math.round(sb[0])},${Math.round(sb[1])}`;
    else delete this.box.dataset.seg;
    if (s && this.input === document.activeElement && this.held) s = this.held;
    if (s) {
      // Always where you can reach it: on screen, clear of the side panels.
      s = clampToFree(s, this.box.offsetWidth / 2, this.box.offsetHeight / 2);
      this.held = s;
      this.box.style.transform = `translate(${Math.round(s[0])}px, ${Math.round(s[1])}px) translate(-50%, -50%)`;
    }
  }

  /** Where the box was last put (it stays put while you type in it). */
  private held: [number, number] | null = null;

  dispose(): void {
    this.view.helpers.delete(this);
    this.view.frameHooks.delete(this.hook);
    this.view.overlay.remove(this.line.group);
    this.line.dispose();
    this.box.remove();
    this.view.requestRender();
  }
}

/** A screen point moved (if needed) so a box of these half sizes is on screen and off the open side panels. */
/** The side panels' and the tool card's places, measured at most every 120 ms (not per box per frame). */
let freeCache: { t: number; sides: DOMRect[]; panel: DOMRect | null; low: DOMRect[] } | null = null;
function freeAreas(): { sides: DOMRect[]; panel: DOMRect | null; low: DOMRect[] } {
  const now = performance.now();
  if (freeCache && now - freeCache.t < 120) return freeCache;
  const sides: DOMRect[] = [];
  for (const id of ["items", "history"]) {
    const e = document.getElementById(id);
    if (e && !e.hidden && e.offsetWidth) sides.push(e.getBoundingClientRect());
  }
  const p = document.getElementById("panel");
  const panel = document.documentElement.dataset.screen === "phone" && p && !p.hidden && p.offsetHeight ? p.getBoundingClientRect() : null;
  // What sits along the bottom - the line with its tools, and on a phone undo and the guide text over it: a value
  // box stays above them (pulled down into a cut on a phone, the box sat on the guide text).
  const low: DOMRect[] = [];
  for (const id of ["sentence", "undo-dock", "hint"]) {
    const e = document.getElementById(id);
    const r = e && !e.hidden && e.offsetHeight && getComputedStyle(e).visibility !== "hidden" ? e.getBoundingClientRect() : null;
    if (r && r.top > window.innerHeight * 0.5) low.push(r);
  }
  low.sort((a, b) => b.top - a.top);
  freeCache = { t: now, sides, panel, low };
  return freeCache;
}

export function clampToFree(s: [number, number], hw: number, hh: number): [number, number] {
  let left = 8;
  let right = window.innerWidth - 8;
  const free = freeAreas();
  for (const r of free.sides) {
    if (r.width > window.innerWidth * 0.6) continue; // a phone sheet over everything: ignore
    if (r.left < window.innerWidth / 2) left = Math.max(left, r.right + 8);
    else right = Math.min(right, r.left - 8);
  }
  if (right - left < hw * 2) [left, right] = [8, window.innerWidth - 8];
  const x = Math.max(left + hw, Math.min(right - hw, s[0]));
  let y = Math.max(52 + hh, Math.min(window.innerHeight - 8 - hh, s[1]));
  // Phones: the tool's options card sits fixed along the bottom - the box stays above it.
  if (free.panel) {
    const r = free.panel;
    if (x + hw > r.left - 6 && x - hw < r.right + 6 && y + hh > r.top - 6) y = Math.max(52 + hh, r.top - 8 - hh);
  }
  for (const r of free.low) if (x + hw > r.left - 6 && x - hw < r.right + 6 && y + hh > r.top - 6 && y - hh < r.bottom + 6) y = Math.max(52 + hh, r.top - 8 - hh);
  return [x, y];
}

/** Pinned measurements: label + (optional) dimension line, always on top. A label dragged away takes its line with
 * it (parallel to what was measured, extension lines back to the two points), as Fusion's dimensions do. */
export class PinLayer {
  private group = new Group();
  private lines: DimLine[] = [];
  private ext: LineSegments[] = [];
  private labels: HTMLElement[] = [];
  private pins: PinDef[] = [];
  private visible = true;
  private host = document.getElementById("pins")!;
  /** The pinned measurements picked (a click on one; Ctrl/Shift+click adds; a box drawn round them): Delete removes them. */
  private picked = new Set<number>();
  private bar: HTMLElement | null = null;

  constructor(
    private view: Viewport,
    /** A label dragged to a new place: its offset from where it was measured (world units). */
    private onMove: (index: number, off: Vec3) => void = () => undefined,
    /** These pins deleted. */
    private onDelete: (indices: number[]) => void = () => undefined,
  ) {
    view.overlay.add(this.group);
    view.frameHooks.add(() => this.layout());
    // A press on the view elsewhere lets them go.
    view.canvas.addEventListener("pointerdown", (e) => !e.ctrlKey && !e.shiftKey && !e.metaKey && this.pick([]));
  }

  /** Some picked? */
  hasPicked(): boolean {
    return this.picked.size > 0;
  }

  /** Delete the picked ones (true if there were any). */
  deletePicked(): boolean {
    if (!this.picked.size) return false;
    const ids = [...this.picked];
    this.picked.clear();
    this.onDelete(ids);
    this.showBar();
    return true;
  }

  /** Pick these (replacing what was picked, or `add`ed to it). */
  pick(ids: number[], add = false): void {
    if (!add) this.picked.clear();
    for (const i of ids) {
      if (add && this.picked.has(i) && ids.length === 1) this.picked.delete(i);
      else this.picked.add(i);
    }
    this.labels.forEach((t, i) => t.classList.toggle("sel", this.picked.has(i)));
    this.showBar();
  }

  /** The pins whose labels are inside a box drawn on the view (screen pixels of the view): picked. */
  pickInBox(a: { x: number; y: number }, b: { x: number; y: number }, add: boolean): number {
    if (!this.visible) return 0;
    const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
    const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    const inside = this.pins.flatMap((p, i) => {
      const o = p.off ?? [0, 0, 0];
      const s = this.view.toScreen([p.at[0] + o[0], p.at[1] + o[1], p.at[2] + o[2]]);
      return s && s[0] >= x0 && s[0] <= x1 && s[1] >= y0 && s[1] <= y1 ? [i] : [];
    });
    if (inside.length || !add) this.pick(inside, add);
    return inside.length;
  }

  /** With some picked: a small bar to delete them (Delete does it too). */
  private showBar(): void {
    if (!this.picked.size) {
      this.bar?.remove();
      this.bar = null;
      return;
    }
    if (!this.bar) {
      this.bar = el("div", "pin-bar");
      document.body.append(this.bar);
    }
    this.bar.replaceChildren();
    const n = this.picked.size;
    const del = el("button", "pin-bar-del", `Delete ${n} pinned`);
    del.addEventListener("click", () => this.deletePicked());
    const off = el("button", "pin-bar-x", "×");
    off.title = "Let go";
    off.addEventListener("click", () => this.pick([]));
    this.bar.append(el("span", "", `${n} picked (Delete)`), del, off);
  }

  /** The dimension line's ends for a label moved by `off`: square off what was measured (the text may slide along it). */
  private static lineAt(p: PinDef, off: Vec3 | undefined): [Vec3, Vec3] | null {
    if (!p.a || !p.b) return null;
    const o = off ?? [0, 0, 0];
    const d = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]];
    const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
    const k = (o[0] * d[0] + o[1] * d[1] + o[2] * d[2]) / dd;
    const n: Vec3 = [o[0] - d[0] * k, o[1] - d[1] * k, o[2] - d[2] * k];
    return [
      [p.a[0] + n[0], p.a[1] + n[1], p.a[2] + n[2]],
      [p.b[0] + n[0], p.b[1] + n[1], p.b[2] + n[2]],
    ];
  }

  set(pins: PinDef[], visible: boolean): void {
    this.lines.forEach((l) => (this.group.remove(l.group), l.dispose()));
    this.ext.forEach((l) => (this.group.remove(l), l.geometry.dispose()));
    this.labels.forEach((l) => l.remove());
    if (pins.length !== this.pins.length) this.picked.clear();
    this.pins = pins.map((p) => ({ ...p }));
    this.visible = visible;
    this.lines = [];
    this.ext = [];
    this.labels = this.pins.map((p, i) => {
      if (p.a && p.b) {
        const l = new DimLine(this.view, 0x8fb4ff);
        this.group.add(l.group);
        this.lines[i] = l;
        const mat = new LineBasicMaterial({ color: 0x8fb4ff, depthTest: false, transparent: true, opacity: 0.8 });
        const e = new LineSegments(new BufferGeometry(), mat);
        e.renderOrder = 11;
        this.group.add(e);
        this.ext[i] = e;
        this.place(i);
      }
      const tag = el("div", `pin${this.picked.has(i) ? " sel" : ""}`, p.text);
      tag.title = "Drag to move it · click to pick it (Ctrl: add), Delete removes it";
      tag.addEventListener("pointerdown", (e) => this.drag(i, tag, e));
      this.host.append(tag);
      return tag;
    });
    this.group.visible = visible;
    this.view.requestRender();
  }

  /** Its dimension line and extension lines where its offset puts them. */
  private place(i: number): void {
    const p = this.pins[i];
    const at = PinLayer.lineAt(p, p.off);
    const l = this.lines[i];
    if (!at || !l) return;
    l.set(at[0], at[1]);
    const moved = !!p.off && Math.hypot(at[0][0] - p.a![0], at[0][1] - p.a![1], at[0][2] - p.a![2]) > 1e-9;
    this.ext[i].visible = moved;
    // Extension lines: from each measured point out to the dimension line (a → a', b → b').
    if (moved) this.ext[i].geometry.setFromPoints([new Vector3(...p.a!), new Vector3(...at[0]), new Vector3(...p.b!), new Vector3(...at[1])]);
  }

  /** A label dragged: on the plane square to the view through where it was measured. */
  private drag(i: number, tag: HTMLElement, e: PointerEvent): void {
    if (e.button > 0) return;
    e.stopPropagation();
    e.preventDefault();
    const p = this.pins[i];
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    try {
      tag.setPointerCapture(e.pointerId);
    } catch {
      // (a synthetic pointer)
    }
    const cam = this.view.cam.camera;
    const normal = new Vector3();
    cam.getWorldDirection(normal);
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, new Vector3(...p.at));
    const ray = new Raycaster();
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      const r = this.view.canvas.getBoundingClientRect();
      ray.setFromCamera(new Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), cam);
      const hit = ray.ray.intersectPlane(plane, new Vector3());
      if (!hit) return;
      p.off = [hit.x - p.at[0], hit.y - p.at[1], hit.z - p.at[2]];
      this.place(i);
      this.view.requestRender();
    };
    const up = (ev: PointerEvent) => {
      tag.removeEventListener("pointermove", move);
      tag.removeEventListener("pointerup", up);
      tag.removeEventListener("pointercancel", up);
      if (moved && p.off) this.onMove(i, p.off);
      // A click (no drag): picked (Ctrl/Shift: added or let go).
      else if (ev.type === "pointerup") this.pick([i], e.ctrlKey || e.metaKey || e.shiftKey);
    };
    tag.addEventListener("pointermove", move);
    tag.addEventListener("pointerup", up);
    tag.addEventListener("pointercancel", up);
  }

  private layout(): void {
    this.lines.forEach((l) => l?.layout());
    this.pins.forEach((p, i) => {
      const o = p.off ?? [0, 0, 0];
      const s = this.view.toScreen([p.at[0] + o[0], p.at[1] + o[1], p.at[2] + o[2]]);
      const tag = this.labels[i];
      tag.hidden = !this.visible || !s;
      if (s) tag.style.transform = `translate(${Math.round(s[0])}px, ${Math.round(s[1])}px) translate(-50%, -50%)`;
    });
  }
}
