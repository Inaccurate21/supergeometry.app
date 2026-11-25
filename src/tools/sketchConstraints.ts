// Sketch constraint UI: the constraint button column, building constraints from
// the selection, and the badges/dimension labels drawn next to the geometry.

import type { ConstraintType, PlaneDef, PointRef, SketchConstraint, SketchEntity, Vec2 } from "../doc/types";
import { applicable, pointOf, pointsOf, sizeOf } from "../sketch/constraints";
import { arcFrom3 } from "../sketch/curves";
import { uid } from "../sketch/edit";
import { el } from "../ui/ui";
import { fmtLen, trim } from "../units";
import type { Viewport } from "../view/viewport";
import { sketchToWorld } from "../view/viewport";
import { toPlane } from "../geom";

export const CONSTRAINT_BUTTONS: { type: ConstraintType | "hv"; label: string; glyph: string; key: string }[] = [
  // Lock / unlock first: the one reached for most.
  { type: "fix", label: "Lock", glyph: "🔒", key: "L" },
  { type: "parallel", label: "Parallel", glyph: "∥", key: "A" },
  { type: "perpendicular", label: "Perpendicular", glyph: "⟂", key: "P" },
  { type: "tangent", label: "Tangent", glyph: "T", key: "T" },
  { type: "coincident", label: "Coincident", glyph: "●", key: "N" },
  { type: "midpoint", label: "Midpoint", glyph: "M", key: "M" },
  { type: "concentric", label: "Concentric", glyph: "◎", key: "C" },
  { type: "hv", label: "Horizontal/Vertical", glyph: "H/V", key: "V" },
  { type: "equal", label: "Equal", glyph: "=", key: "E" },
  { type: "symmetric", label: "Symmetry", glyph: "⇋", key: "S" },
  { type: "distance", label: "Distance", glyph: "↔", key: "D" },
];

const GLYPH: Partial<Record<ConstraintType, string>> = {
  coincident: "●",
  horizontal: "H",
  vertical: "V",
  parallel: "∥",
  perpendicular: "⟂",
  equal: "=",
  tangent: "T",
  concentric: "◎",
  midpoint: "M",
  symmetric: "⇋",
  fix: "🔒",
};

/** The small sign a constraint goes by (a size: its arrow). */
export function constraintGlyph(c: SketchConstraint): string {
  if (c.type === "dim" || c.type === "distance") return c.prop === "angle" ? "∠" : "↔";
  if (c.type === "pattern" || c.type === "follow") return "⛓";
  return GLYPH[c.type] ?? "•";
}

/** Constraints for a button press, from the current selection (empty if it doesn't fit). */
export function buildConstraints(type: ConstraintType | "hv", pts: PointRef[], curves: SketchEntity[], all?: SketchEntity[]): SketchConstraint[] {
  if (type === "hv") {
    if (curves.length === 1 && curves[0].kind === "line" && !pts.length) {
      const l = curves[0];
      const horiz = Math.abs(l.b[0] - l.a[0]) >= Math.abs(l.b[1] - l.a[1]);
      return [{ id: uid(), type: horiz ? "horizontal" : "vertical", curves: [l.id] }];
    }
    // Two points (a circle's centre and a corner, two ends): level with each other, or one above the other -
    // whichever they are nearer to. (The solver had it; no button gave it.)
    if (pts.length === 2 && !curves.length && all) {
      const [a, b] = pts.map((r) => {
        const e = all.find((x) => x.id === r.e);
        return e ? pointOf(e, r.p) : null;
      });
      if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-9) return [{ id: uid(), type: Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? "horizontal" : "vertical", pts }];
    }
    return [];
  }
  if (!applicable(type, pts, curves)) return [];
  const ids = curves.map((c) => c.id);
  switch (type) {
    case "coincident":
      return pts.length === 2 ? [{ id: uid(), type, pts }] : [{ id: uid(), type, pts, curves: ids }];
    case "midpoint":
    case "symmetric":
      return [{ id: uid(), type, pts, curves: ids }];
    case "distance": {
      const v = distanceOf(pts, curves);
      return v === null ? [] : [{ id: uid(), type, pts, curves: ids.length ? ids : undefined, value: v }];
    }
    case "fix": {
      // Locking a curve holds all of its points (and a circle's size).
      const all = [...pts, ...curves.flatMap((e) => pointsOf(e).map((q) => ({ e: e.id, p: q.p })))];
      const sizes = curves.flatMap((e): SketchConstraint[] => (e.kind === "circle" ? [{ id: uid(), type: "dim", curves: [e.id], prop: "diameter", value: 2 * e.radius, held: true }] : []));
      return [...all.map((p) => ({ id: uid(), type, pts: [p] })), ...sizes];
    }
    default:
      return [{ id: uid(), type, curves: ids }];
  }
}

/** Current distance between two points, or a point and a line. */
export function distanceOf(pts: PointRef[], curves: SketchEntity[], all: SketchEntity[] = curves): number | null {
  const P = (r: PointRef) => {
    const e = all.find((x) => x.id === r.e);
    return e ? pointOf(e, r.p) : null;
  };
  if (pts.length === 2 && !curves.length) {
    const [a, b] = pts.map(P);
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : null;
  }
  const l = curves[0];
  const p = pts[0] && P(pts[0]);
  if (pts.length === 1 && curves.length === 1 && l.kind === "line" && p) {
    const dx = l.b[0] - l.a[0];
    const dy = l.b[1] - l.a[1];
    return Math.abs((p[0] - l.a[0]) * dy - (p[1] - l.a[1]) * dx) / (Math.hypot(dx, dy) || 1);
  }
  // Two lines that run the same way (within a degree): how far apart they are - the second's middle from the first.
  // (Asked for: a distance between two lines. Two lines that cross have an angle between them, not a distance.)
  const m = curves[1];
  if (!pts.length && curves.length === 2 && l.kind === "line" && m.kind === "line") {
    const [dx, dy, ex, ey] = [l.b[0] - l.a[0], l.b[1] - l.a[1], m.b[0] - m.a[0], m.b[1] - m.a[1]];
    const [L, M] = [Math.hypot(dx, dy), Math.hypot(ex, ey)];
    if (!(L > 1e-12) || !(M > 1e-12) || Math.abs(dx * ey - dy * ex) / (L * M) > Math.sin(Math.PI / 180)) return null;
    const mid = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2];
    return Math.abs((mid[0] - l.a[0]) * dy - (mid[1] - l.a[1]) * dx) / L;
  }
  return null;
}

/**
 * Constraints already on the selection for a button: the column shows them
 * as on, and tapping the button removes them.
 */
export function existingConstraints(type: ConstraintType | "hv", constraints: SketchConstraint[], pts: PointRef[], curves: SketchEntity[]): SketchConstraint[] {
  const ids = new Set(curves.map((e) => e.id));
  const ptKeys = new Set(pts.map((p) => `${p.e}:${p.p}`));
  const types: string[] = type === "hv" ? ["horizontal", "vertical"] : [type];
  // A point counts as selected when it is, or when its curve is.
  const ptIn = (p: PointRef) => ptKeys.has(`${p.e}:${p.p}`) || ids.has(p.e);
  return constraints.filter((c) => {
    // (The size Lock put on a circle goes with its lock; it was left behind, and the circle unlocked kept its size.)
    if (type === "fix" && c.type === "dim" && c.held && c.curves?.length === 1 && ids.has(c.curves[0])) return true;
    if (!types.includes(c.type)) return false;
    const cv = c.curves ?? [];
    const cp = c.pts ?? [];
    if (!cv.length && !cp.length) return false;
    if (type === "fix") return cp.every(ptIn);
    // Every curve and point it involves is in the selection.
    return cv.every((id) => ids.has(id)) && cp.every(ptIn) && (cv.length + cp.length > 1 || ids.size + pts.length === 1);
  });
}

/** Upsert a driving dimension on one entity (length / radius / w / h / …). */
export function setDim(list: SketchConstraint[], entity: string, prop: string, value: number, expr?: string | null): SketchConstraint[] {
  const i = list.findIndex((c) => c.type === "dim" && c.curves?.[0] === entity && c.curves.length === 1 && c.prop === prop);
  const c: SketchConstraint = { id: i >= 0 ? list[i].id : uid(), type: "dim", curves: [entity], prop, value, ...(expr ? { expr } : {}) };
  return i >= 0 ? list.map((x, k) => (k === i ? c : x)) : [...list, c];
}

/** The dimension constraint on an entity's property, if any. */
export function dimOf(list: SketchConstraint[], entity: string, prop: string): SketchConstraint | undefined {
  return list.find((c) => c.type === "dim" && c.curves?.[0] === entity && c.curves.length === 1 && c.prop === prop);
}

/** Badges + dimension labels for the constraints of the sketch being edited. */
export class ConstraintGlyphs {
  private host = el("div", "cglyphs");
  private chips = new Map<string, HTMLElement>();
  private hook = () => this.layout();
  /** Each mark: where on the drawing, which way is "outside" there (sketch units), and how far out (px). */
  private items: { c: SketchConstraint; at: Vec2; dir: Vec2; dist: number; geo?: DimGeo; place?: Vec2 }[] = [];
  /** The dimension lines (extension lines, the line with its arrows, a radius's leader), as in Fusion. */
  private svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  private plane: PlaneDef | null = null;
  selected: string | null = null;

  constructor(
    private view: Viewport,
    private onClick: (id: string) => void,
    /** A dimension's text dragged to a new place (sketch units): kept with the sketch. */
    private onPlace: (id: string, place: Vec2) => void = () => undefined,
  ) {
    this.svg.classList.add("cdims");
    this.host.append(this.svg);
    document.body.append(this.host);
    view.frameHooks.add(this.hook);
  }

  set(plane: PlaneDef, entities: SketchEntity[], constraints: SketchConstraint[]): void {
    this.plane = plane;
    const get = (id: string) => entities.find((e) => e.id === id);
    const mid = (e: SketchEntity): Vec2 | null => {
      if (e.kind === "line") return [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
      if (e.kind === "arc") return e.m;
      if (e.kind === "circle" || e.kind === "ellipse" || e.kind === "rect" || e.kind === "polygon") return e.center;
      return e.points[0] ?? null;
    };
    this.items = [];
    const inside = shapeCentres(entities);
    const norm = (v: Vec2): Vec2 | null => {
      const l = Math.hypot(v[0], v[1]);
      return l > 1e-9 ? [v[0] / l, v[1] / l] : null;
    };
    // Away from the middle of the shape it belongs to (off the blue fill of a closed one).
    const away = (e: SketchEntity, p: Vec2, fallback: Vec2): Vec2 => {
      const c = inside.get(e.id);
      const d = c && norm([p[0] - c[0], p[1] - c[1]]);
      return d ?? fallback;
    };
    // Several badges at one spot are fanned out (further out) so they stay readable.
    const counts = new Map<string, number>();
    for (const c of constraints) {
      // (A pattern's copies have no badge each: there'd be one on every copy.)
      if (c.type === "pattern" || c.type === "follow") continue;
      // A mark only while everything it ties together is still drawn.
      if (![...(c.pts ?? []).map((p) => p.e), ...(c.curves ?? [])].every((id) => get(id))) continue;
      let at: Vec2 | null = null;
      let dir: Vec2 = [Math.SQRT1_2, -Math.SQRT1_2];
      if (c.pts?.length) {
        const e = get(c.pts[0].e);
        at = e ? pointOf(e, c.pts[0].p) : null;
        if (e && at) dir = away(e, at, dir);
      } else if (c.curves?.length) {
        const e = get(c.curves[0]);
        at = e ? mid(e) : null;
        if (e && at) {
          if (e.kind === "line") {
            // Square off the line, on the side away from its shape's middle.
            const n = norm([-(e.b[1] - e.a[1]), e.b[0] - e.a[0]]) ?? dir;
            const c0 = inside.get(e.id);
            const flip = c0 && (at[0] - c0[0]) * n[0] + (at[1] - c0[1]) * n[1] < 0;
            dir = flip ? [-n[0], -n[1]] : n;
          } else if (e.kind === "arc") {
            const ac = arcFrom3(e.a, e.m, e.b)?.c;
            const out = ac ? norm([e.m[0] - ac[0], e.m[1] - ac[1]]) : null;
            dir = away(e, at, out ?? dir);
          } else if (e.kind === "circle" || e.kind === "polygon") {
            // Closed round shapes: on the rim at the top right, outside it.
            dir = [Math.SQRT1_2, Math.SQRT1_2];
            at = [e.center[0] + e.radius * dir[0], e.center[1] + e.radius * dir[1]];
          } else if (e.kind === "ellipse" || e.kind === "rect") {
            const [hx, hy] = e.kind === "ellipse" ? [e.rx * Math.SQRT1_2, e.ry * Math.SQRT1_2] : [e.w / 2, e.h / 2];
            const cs = Math.cos(e.rotation);
            const sn = Math.sin(e.rotation);
            at = [e.center[0] + hx * cs - hy * sn, e.center[1] + hx * sn + hy * cs];
            dir = norm([at[0] - e.center[0], at[1] - e.center[1]]) ?? dir;
          } else {
            dir = away(e, at, dir);
          }
        }
        if (e && c.type === "dim" && (c.prop === "radius" || c.prop === "diameter")) {
          const r = e.kind === "circle" ? e.radius : e.kind === "arc" ? (arcFrom3(e.a, e.m, e.b)?.r ?? 0) : e.kind === "polygon" ? e.radius : 0;
          const ctr = e.kind === "arc" ? (arcFrom3(e.a, e.m, e.b)?.c ?? at!) : at!;
          at = [ctr[0] + r * 0.707, ctr[1] + r * 0.707];
          dir = [Math.SQRT1_2, Math.SQRT1_2];
        }
        if (e && c.type === "dim" && e.kind === "rect" && (c.prop === "w" || c.prop === "h")) {
          const cs = Math.cos(e.rotation);
          const sn = Math.sin(e.rotation);
          const off = c.prop === "w" ? [0, -e.h / 2] : [e.w / 2, 0];
          at = [e.center[0] + off[0] * cs - off[1] * sn, e.center[1] + off[0] * sn + off[1] * cs];
          dir = norm([at[0] - e.center[0], at[1] - e.center[1]]) ?? dir;
        }
      }
      if (!at) continue;
      const k = `${at[0].toFixed(4)},${at[1].toFixed(4)}`;
      const n = counts.get(k) ?? 0;
      counts.set(k, n + 1);
      const isDim = c.type === "dim" || c.type === "distance";
      this.items.push({ c, at, dir, dist: isDim ? 18 + n * 20 : 14 + n * 18, geo: isDim ? dimGeo(c, get) : undefined, place: c.place });
    }
    // Sync chips.
    const live = new Set(this.items.map((i) => i.c.id));
    for (const [id, chip] of this.chips) if (!live.has(id)) (chip.remove(), this.chips.delete(id));
    for (const { c } of this.items) {
      let chip = this.chips.get(c.id);
      if (!chip) {
        chip = el("button", "cglyph");
        chip.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          if (chip!.classList.contains("dim")) this.dragDim(c.id, chip!, e);
        });
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          // (A drag of a dimension's text is not a tap on it.)
          if (chip!.dataset.dragged) return void delete chip!.dataset.dragged;
          this.onClick(c.id);
        });
        this.host.append(chip);
        this.chips.set(c.id, chip);
      }
      chip.className = `cglyph${c.type === "dim" || c.type === "distance" ? " dim" : ""}${c.id === this.selected ? " sel" : ""}${c.expr ? " expr" : ""}`;
      chip.textContent = label(c, get);
      // Each kind its own colour (recognised at a glance).
      chip.dataset.type = c.type;
      chip.title = c.type === "dim" ? `${c.prop} dimension${c.expr ? ` = ${c.expr}` : ""} (click to edit)` : `${c.type} (click to select)`;
    }
    this.layout();
  }

  /**
   * The constraint mark (not a dimension) at a screen point, if any. Marks
   * don't catch taps themselves - the drawing under them always comes first;
   * the sketch asks here when a tap found nothing else.
   */
  hitAt(x: number, y: number): string | null {
    if (this.host.hidden) return null;
    for (const [id, chip] of this.chips) {
      if (chip.hidden || chip.classList.contains("dim")) continue;
      const r = chip.getBoundingClientRect();
      if (x > r.left - 4 && x < r.right + 4 && y > r.top - 4 && y < r.bottom + 4) return id;
    }
    return null;
  }

  /** Show or hide all the badges (the "Show constraints" switch). */
  setVisible(on: boolean): void {
    this.host.hidden = !on;
  }

  /**
   * Tapped to select (in the Select tool), or let through to the drawing under
   * them: a rectangle's width label under its edge took Mirror's tap on the
   * circle there, and the shapes picked so far were let go.
   */
  setTappable(on: boolean): void {
    this.host.classList.toggle("passive", !on);
  }

  /** A point of the screen (page pixels) on the sketch's plane, in sketch units. */
  private toSketch(cx: number, cy: number): Vec2 | null {
    if (!this.plane) return null;
    const r = this.view.canvas.getBoundingClientRect();
    const w = this.view.rayToPlane(cx - r.left, cy - r.top, this.plane);
    return w ? toPlane(this.plane, w) : null;
  }

  /** A dimension's text dragged: it and its line follow; let go, the place is kept (a tap without moving edits it). */
  private dragDim(id: string, chip: HTMLElement, e: PointerEvent): void {
    const it = this.items.find((i) => i.c.id === id);
    if (!it) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    try {
      chip.setPointerCapture(e.pointerId);
    } catch {
      // (a synthetic pointer)
    }
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      chip.classList.add("dragging");
      const q = this.toSketch(ev.clientX, ev.clientY);
      if (q) (it.place = q), this.layout();
    };
    const up = () => {
      chip.removeEventListener("pointermove", move);
      chip.removeEventListener("pointerup", up);
      chip.removeEventListener("pointercancel", up);
      chip.classList.remove("dragging");
      if (moved && it.place) {
        chip.dataset.dragged = "1";
        this.onPlace(id, it.place);
      }
    };
    chip.addEventListener("pointermove", move);
    chip.addEventListener("pointerup", up);
    chip.addEventListener("pointercancel", up);
  }

  private layout(): void {
    if (!this.plane) return;
    const lines: string[] = [];
    const arrows: string[] = [];
    const scr = (q: Vec2) => this.view.toScreen(sketchToWorld(this.plane!, q));
    for (const it of this.items) {
      const chip = this.chips.get(it.c.id);
      if (!chip) continue;
      // A dimension dragged somewhere: its text there, the line through it.
      const placed = it.place ? scr(it.place) : null;
      if (placed && it.geo) {
        chip.hidden = false;
        chip.style.transform = `translate(${Math.round(placed[0])}px, ${Math.round(placed[1])}px) translate(-50%, -50%)`;
        drawDim(it.geo, placed, scr, lines, arrows);
        continue;
      }
      const s = this.view.toScreen(sketchToWorld(this.plane, it.at));
      chip.hidden = !s;
      if (!s) continue;
      // "Outside" on screen: the sketch direction as the view shows it (any turn, any zoom).
      const s2 = this.view.toScreen(sketchToWorld(this.plane, [it.at[0] + it.dir[0] * 1e-3, it.at[1] + it.dir[1] * 1e-3]));
      let dx = s2 ? s2[0] - s[0] : 1;
      let dy = s2 ? s2[1] - s[1] : 1;
      const l = Math.hypot(dx, dy);
      // Looking along the sketch (edge-on): no way out on screen - right and below.
      [dx, dy] = l > 1e-9 ? [dx / l, dy / l] : [Math.SQRT1_2, Math.SQRT1_2];
      // A mark is ~16 px across: its centre goes far enough out that all of it clears the line.
      const d = it.dist + 4;
      const tx = s[0] + dx * d;
      const ty = s[1] + dy * d;
      chip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) translate(-50%, -50%)`;
      if (it.geo) drawDim(it.geo, [tx, ty], scr, lines, arrows);
    }
    this.svg.innerHTML = `<path class="cdim-line" d="${lines.join("")}"/><path class="cdim-arrow" d="${arrows.join("")}"/>`;
  }

  dispose(): void {
    this.view.frameHooks.delete(this.hook);
    this.host.remove();
  }
}

function label(c: SketchConstraint, get: (id: string) => SketchEntity | undefined): string {
  if (c.type === "dim") {
    const e = c.curves?.[0] ? get(c.curves[0]) : undefined;
    const v = c.value ?? (e && c.prop ? sizeOf(e, c.prop) : 0) ?? 0;
    const name = c.expr && /[a-z_]/i.test(c.expr) ? `${c.expr} = ` : "";
    if (c.prop === "angle") return `${name}${trim(v, 2)}°`;
    if (c.prop === "radius") return `${name}R ${fmtLen(v)}`;
    if (c.prop === "diameter") return `${name}⌀ ${fmtLen(v)}`;
    return `${name}${fmtLen(v)}`;
  }
  if (c.type === "distance") return fmtLen(c.value ?? 0);
  return GLYPH[c.type] ?? "?";
}

/**
 * The middle of the shape each curve belongs to: curves joined end to end
 * make one shape (a rectangle of four lines, a slot of lines and arcs); a
 * circle, ellipse, rectangle or polygon is its own. Marks go away from it.
 */
function shapeCentres(entities: SketchEntity[]): Map<string, Vec2> {
  const parent = entities.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const ends = (e: SketchEntity): Vec2[] => {
    if (e.kind === "line" || e.kind === "arc") return [e.a, e.b];
    if ((e.kind === "spline" || e.kind === "polyline") && !e.closed && e.points.length) return [e.points[0], e.points[e.points.length - 1]];
    return [];
  };
  // Ends at the same spot (joined): one shape. (Hashed, so big sketches stay quick.)
  const at = new Map<string, number>();
  entities.forEach((e, i) => {
    for (const p of ends(e)) {
      const k = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
      const j = at.get(k);
      if (j === undefined) at.set(k, i);
      else parent[find(i)] = find(j);
    }
  });
  const samples = (e: SketchEntity): Vec2[] => {
    if (e.kind === "line") return [e.a, e.b];
    if (e.kind === "arc") return [e.a, e.m, e.b];
    if (e.kind === "spline" || e.kind === "polyline") return e.points;
    return [e.center];
  };
  const sum = new Map<number, [number, number, number]>();
  entities.forEach((e, i) => {
    const r = find(i);
    const s = sum.get(r) ?? [0, 0, 0];
    for (const p of samples(e)) (s[0] += p[0]), (s[1] += p[1]), (s[2] += 1);
    sum.set(r, s);
  });
  const out = new Map<string, Vec2>();
  entities.forEach((e, i) => {
    const s = sum.get(find(i))!;
    if (s[2]) out.set(e.id, [s[0] / s[2], s[1] / s[2]]);
  });
  return out;
}

/** What a dimension measures, to draw its lines: two points (a length, a width, a distance), or a circle's rim. */
type DimGeo = { kind: "linear"; a: Vec2; b: Vec2 } | { kind: "radial"; c: Vec2; r: number; dia: boolean };

function dimGeo(c: SketchConstraint, get: (id: string) => SketchEntity | undefined): DimGeo | undefined {
  if (c.type === "distance" && c.pts?.length === 2) {
    const e1 = get(c.pts[0].e);
    const e2 = get(c.pts[1].e);
    const a = e1 && pointOf(e1, c.pts[0].p);
    const b = e2 && pointOf(e2, c.pts[1].p);
    return a && b ? { kind: "linear", a, b } : undefined;
  }
  if (c.type !== "dim" || !c.curves?.length) return undefined;
  const e = get(c.curves[0]);
  if (!e) return undefined;
  if (e.kind === "line" && c.prop === "length") return { kind: "linear", a: e.a, b: e.b };
  if (e.kind === "rect" && (c.prop === "w" || c.prop === "h")) {
    const cs = Math.cos(e.rotation);
    const sn = Math.sin(e.rotation);
    const at = (x: number, y: number): Vec2 => [e.center[0] + x * cs - y * sn, e.center[1] + x * sn + y * cs];
    return c.prop === "w" ? { kind: "linear", a: at(-e.w / 2, -e.h / 2), b: at(e.w / 2, -e.h / 2) } : { kind: "linear", a: at(e.w / 2, -e.h / 2), b: at(e.w / 2, e.h / 2) };
  }
  if (c.prop === "radius" || c.prop === "diameter") {
    const dia = c.prop === "diameter";
    if (e.kind === "circle" || e.kind === "polygon") return { kind: "radial", c: e.center, r: e.radius, dia };
    if (e.kind === "arc") {
      const f = arcFrom3(e.a, e.m, e.b);
      return f ? { kind: "radial", c: f.c, r: f.r, dia } : undefined;
    }
  }
  return undefined;
}

/**
 * A dimension's lines on screen, as Fusion draws them, through the text at `t`: for a length, extension lines out
 * from both ends to a line parallel to what is measured, arrows at its ends (the line runs on to the text when it
 * sits past them); for a radius or diameter, a leader from the text to the rim (through the centre for a diameter).
 */
function drawDim(g: DimGeo, t: [number, number], scr: (q: Vec2) => [number, number] | null, lines: string[], arrows: string[]): void {
  const P = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const arrow = (tip: [number, number], dx: number, dy: number) => {
    // A filled head 8 px long, pointing along (dx, dy).
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    arrows.push(`M${P(tip[0], tip[1])}L${P(tip[0] - ux * 8 - uy * 3, tip[1] - uy * 8 + ux * 3)}L${P(tip[0] - ux * 8 + uy * 3, tip[1] - uy * 8 - ux * 3)}Z`);
  };
  if (g.kind === "linear") {
    const a = scr(g.a);
    const b = scr(g.b);
    if (!a || !b) return;
    const ux0 = b[0] - a[0];
    const uy0 = b[1] - a[1];
    const len = Math.hypot(ux0, uy0);
    if (len < 2) return;
    const ux = ux0 / len;
    const uy = uy0 / len;
    // Square off what is measured, towards the text.
    const nx = -uy;
    const ny = ux;
    const h = (t[0] - a[0]) * nx + (t[1] - a[1]) * ny;
    const sg = h < 0 ? -1 : 1;
    const A: [number, number] = [a[0] + nx * h, a[1] + ny * h];
    const B: [number, number] = [b[0] + nx * h, b[1] + ny * h];
    // Extension lines: a small gap off the geometry, a little past the dimension line.
    if (Math.abs(h) > 6) {
      lines.push(`M${P(a[0] + nx * sg * 3, a[1] + ny * sg * 3)}L${P(A[0] + nx * sg * 5, A[1] + ny * sg * 5)}`);
      lines.push(`M${P(b[0] + nx * sg * 3, b[1] + ny * sg * 3)}L${P(B[0] + nx * sg * 5, B[1] + ny * sg * 5)}`);
    }
    // Along the line, where the text is: between the ends, or past one (the line runs on to it).
    const along = (t[0] - a[0]) * ux + (t[1] - a[1]) * uy;
    const from = Math.min(0, along - 4);
    const to = Math.max(len, along + 4);
    lines.push(`M${P(a[0] + nx * h + ux * from, a[1] + ny * h + uy * from)}L${P(a[0] + nx * h + ux * to, a[1] + ny * h + uy * to)}`);
    arrow(A, -ux, -uy);
    arrow(B, ux, uy);
    return;
  }
  const c = scr(g.c);
  // The rim's radius on screen: from the centre to a point of the rim along sketch X.
  const rim = scr([g.c[0] + g.r, g.c[1]]);
  if (!c || !rim) return;
  const rs = Math.hypot(rim[0] - c[0], rim[1] - c[1]);
  const dx = t[0] - c[0];
  const dy = t[1] - c[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const near: [number, number] = [c[0] + ux * rs, c[1] + uy * rs];
  if (g.dia) {
    const far: [number, number] = [c[0] - ux * rs, c[1] - uy * rs];
    lines.push(`M${P(far[0], far[1])}L${P(t[0], t[1])}`);
    arrow(far, -ux, -uy);
    arrow(near, ux, uy);
  } else {
    lines.push(`M${P(c[0], c[1])}L${P(t[0], t[1])}`);
    arrow(near, ux, uy);
  }
}
