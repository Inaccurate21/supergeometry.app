import type { PinDef, SketchFeature, Vec2, Vec3 } from "../doc/types";
import { pointOf, pointsOf } from "../sketch/constraints";
import { entityPolylines } from "../sketch/curves";
import { sketchToWorld } from "../view/viewport";
import { settings } from "../settings";
import { cross, dist, dot, len, sub } from "../geom";
import type { BodyMesh } from "../kernel/protocol";
import { copyText, numberIn, sendToCalculator } from "../ui/calculator";
import { el } from "../ui/ui";
import { fmtLen, trim, UNIT_MM, UNIT_LABEL, units } from "../units";
import type { ToolPointer } from "../view/input";
import { filterHit, filterOptions } from "./selFilter";
import { hitToSel, sameSel, type AppContext, type Sel, type Tool } from "./tool";

export interface MeasureHost extends AppContext {
  readonly pins: PinDef[];
  setPins(p: PinDef[]): void;
  /** Measure over an open sketch (the sketch stays open under it): ends that, back to the sketch. */
  endMeasureOver?(): void;
}

interface Row {
  name: string;
  value: string;
  at: Vec3;
  a?: Vec3;
  b?: Vec3;
}

/** What was picked: something of the model (a face, an edge, a body, a sketch's curve) or a snap point on it. */
type Pick = { sel: Sel } | { pt: Vec3; what: string };

/** A point the pointer is caught on (Show snap points): where, and what it is. */
interface SnapPt {
  at: Vec3;
  what: string;
}

/**
 * Measure, as Fusion's: tap faces, edges, bodies, sketch curves - or, with Show snap points on, the ends, middles and
 * centres the pointer catches on. The card has Results (between the two picks: the distance, the angle) and each
 * pick's own sizes and place (X, Y, Z, and how far it is off each axis). Any value can be copied (to the clipboard
 * and the calculator) or pinned to stay on screen.
 */
export class MeasureTool implements Tool {
  readonly id = "measure";
  private items: Pick[] = [];
  private card: HTMLElement | null = null;
  private deltas = false;
  private hot: SnapPt | null = null;
  private mark: HTMLElement | null = null;

  /** `over`: measuring inside an open sketch, as in Fusion - the sketch and its bar stay, the sizes stay shown. */
  constructor(
    private app: MeasureHost,
    readonly over = false,
  ) {}

  /** Leave Measure: back to the sketch it was opened over, or to picking. */
  private close(): void {
    if (this.over && this.app.endMeasureOver) this.app.endMeasureOver();
    else this.app.setTool(null);
  }

  enter(): void {
    if (!this.over) {
      this.app.ui.setTools([{ id: "exit", label: "Exit Measure", icon: "exit", shortcut: "Esc", run: () => this.close() }]);
      // The view tools stay, this one lit and pulsing (tap it again to close it).
      this.app.ui.setBottom(this.app.bottomTools());
    }
    this.app.ui.setHint(
      this.over
        ? "Measuring in the sketch: tap curves, points, faces or edges. Measure again (or Esc) goes back to drawing."
        : "Tap faces, edges or points to see their sizes. Double-tap for a whole body.",
    );
    this.card = el("div", "measure-card");
    document.body.append(this.card);
    this.mark = el("div", "measure-snap");
    this.mark.hidden = true;
    document.body.append(this.mark);
    this.render();
  }

  exit(): void {
    this.card?.remove();
    this.mark?.remove();
    this.app.ui.setHint(null);
    this.app.setSelection([]);
    this.app.setHover(null);
  }

  private pickAt(p: ToolPointer) {
    // (Through the selection filter: only cones, only centres...)
    return filterHit(this.app.view, this.app.view.pick(p.x, p.y, filterOptions({ edgeTolPx: p.tol, profiles: false, planes: false, curves: true })));
  }

  hover(p: ToolPointer | null): void {
    const hit = p ? this.pickAt(p) : null;
    this.hot = p && settings.value.measureSnap ? this.snapNear(p, hit) : null;
    this.app.setHover(this.hot ? null : hitToSel(hit));
    this.showMark();
  }

  tap(p: ToolPointer, count: number): void {
    const hit = this.pickAt(p);
    const hot = settings.value.measureSnap ? this.snapNear(p, hit) : null;
    if (hot) {
      const i = this.items.findIndex((x) => "pt" in x && dist(x.pt, hot.at) < 1e-6);
      if (i >= 0) this.items.splice(i, 1);
      else this.items = [...this.items.slice(-1), { pt: hot.at, what: hot.what }];
    } else {
      let s = hitToSel(hit);
      if (!s) {
        // Empty space: first clears, second leaves Measure (in a sketch it stays till its button or Esc).
        if (!this.items.length) return this.over ? undefined : this.close();
        this.items = [];
      } else {
        if (count >= 2 && (s.kind === "face" || s.kind === "edge" || s.kind === "vertex")) s = { kind: "body", body: s.body };
        const i = this.items.findIndex((x) => "sel" in x && sameSel(x.sel, s!));
        if (i >= 0) this.items.splice(i, 1);
        else this.items = [...this.items.slice(-1), { sel: s }];
      }
    }
    this.app.setSelection(this.items.flatMap((x) => ("sel" in x ? [x.sel] : [])));
    this.render();
  }

  key(e: KeyboardEvent): boolean {
    if (e.key === "Escape") {
      if (this.items.length) {
        this.items = [];
        this.app.setSelection([]);
        this.render();
      } else this.close();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ snap points

  /** The snap points of what is under the pointer, the nearest on screen within reach. */
  private snapNear(p: ToolPointer, hit: ReturnType<MeasureTool["pickAt"]>): SnapPt | null {
    if (!hit) return null;
    const cands: SnapPt[] = [];
    const add = (at: Vec3 | undefined | null, what: string) => at && cands.push({ at, what });
    if (hit.kind === "vertex") add(this.app.view.vertexOf(hit.body, hit.vertex), "Vertex");
    else if (hit.kind === "edge") {
      const b = this.app.view.body(hit.body);
      const e = b?.edges[hit.edge];
      if (b && e) {
        const pts = edgePoints(b, hit.edge);
        if (pts.length) (add(pts[0], "Edge end"), add(pts[pts.length - 1], "Edge end"));
        add(e.mid, "Edge middle");
        if (e.type === "CIRCLE" && pts.length >= 3) add(circumcentre(pts[0], pts[Math.floor(pts.length / 3)], pts[Math.floor((2 * pts.length) / 3)]), "Centre");
      }
    } else if (hit.kind === "face") {
      const f = this.app.view.body(hit.body)?.faces[hit.face];
      if (f) add(f.center, "Face centre");
    } else if (hit.kind === "curve" || hit.kind === "point") {
      const plane = this.app.sketchPlane(hit.sketch);
      const e = this.app.store.find<SketchFeature>(hit.sketch)?.entities.find((x) => x.id === hit.entity);
      if (plane && e) {
        const w = (q: Vec2) => sketchToWorld(plane, q).toArray() as Vec3;
        for (const q of pointsOf(e)) add(w(q.at), q.p === "c" ? (e.kind === "point" ? "Sketch point" : "Centre") : "Sketch point");
        if (e.kind === "line") add(w([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]), "Midpoint");
        if (e.kind === "circle") for (let i = 0; i < 4; i++) add(w([e.center[0] + e.radius * Math.cos((i * Math.PI) / 2), e.center[1] + e.radius * Math.sin((i * Math.PI) / 2)]), "Quadrant");
      }
    }
    let best: SnapPt | null = null;
    let bd = Math.max(16, p.tol * 1.5);
    // The filter's Centre points, Edges and Vertices switches hold for the snap points too.
    const flt = settings.value.selFilter;
    const kept = cands.filter((c) => (c.what === "Centre" || c.what === "Face centre" ? flt.centres : c.what.startsWith("Edge") || c.what === "Midpoint" || c.what === "Quadrant" ? flt.edges || flt.sketchCurves : c.what === "Vertex" ? flt.vertices : true));
    for (const c of kept) {
      const s = this.app.view.toScreen(c.at);
      if (!s) continue;
      const d = Math.hypot(s[0] - p.x, s[1] - p.y);
      if (d < bd) ((bd = d), (best = c));
    }
    return best;
  }

  private showMark(): void {
    const m = this.mark;
    if (!m) return;
    const s = this.hot && this.app.view.toScreen(this.hot.at);
    m.hidden = !s;
    if (!s || !this.hot) return;
    const r = this.app.view.canvas.getBoundingClientRect();
    m.style.left = `${r.left + s[0]}px`;
    m.style.top = `${r.top + s[1]}px`;
    m.dataset.what = this.hot.what;
    m.title = this.hot.what;
  }

  // ------------------------------------------------------------ the card

  private render(): void {
    const card = this.card;
    if (!card) return;
    card.replaceChildren();
    const opt = (label: string, on: boolean, set: (v: boolean) => void) => {
      const l = el("label", "measure-toggle");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = on;
      box.addEventListener("change", () => set(box.checked));
      l.append(box, ` ${label}`);
      return l;
    };
    card.append(
      opt("Show snap points", settings.value.measureSnap, (v) => (settings.set("measureSnap", v), (this.hot = null), this.showMark())),
      opt("Include X, Y, Z deltas", this.deltas, (v) => ((this.deltas = v), this.render())),
      opt("Show pinned measurements", settings.value.showPinned, (v) => settings.set("showPinned", v)),
    );
    const info = this.items.map((x) => this.describe(x));
    if (!info.some((x) => x)) card.append(el("div", "measure-empty", settings.value.measureSnap ? "Tap a face, an edge or a body - or a snap point (a dot shows by the pointer)." : "Nothing selected"));
    const section = (title: string, sub: string | null, rows: Row[]) => {
      if (!rows.length) return;
      const head = el("div", "measure-sec", `▾ ${title}`);
      card.append(head);
      if (sub) card.append(el("div", "measure-sub", sub));
      for (const r of rows) card.append(this.row(r));
    };
    if (info.length === 2 && info[0] && info[1]) section("Results", null, this.between(info[0], info[1]));
    info.forEach((d, i) => d && section(`Selection ${i + 1}`, d.what, d.rows));
    const foot = el("div", "measure-foot");
    if (this.app.pins.length) {
      const clear = el("button", "text-btn", `Clear ${this.app.pins.length} pinned`);
      clear.addEventListener("click", () => (this.app.setPins([]), this.render()));
      foot.append(clear);
    }
    const close = el("button", "measure-close", "Close");
    close.addEventListener("click", () => this.close());
    foot.append(close);
    card.append(foot);
  }

  private row(r: Row): HTMLElement {
    const row = el("div", "measure-row");
    row.append(el("div", "measure-name", r.name), el("div", "measure-value", r.value));
    const copy = el("button", "icon-btn measure-copy", "⧉");
    copy.title = "Copy (to the clipboard and the calculator)";
    copy.addEventListener("click", () => {
      const n = numberIn(r.value.replace(/^[ØR]\s*/, ""));
      void copyText(n !== null ? String(n) : r.value);
      if (n !== null) sendToCalculator(n, r.name);
    });
    const pin = el("button", "icon-btn", "📌");
    pin.title = "Pin to always show";
    pin.addEventListener("click", () => (this.app.addPin({ text: r.value, at: r.at, a: r.a, b: r.b }), this.render()));
    row.append(copy, pin);
    return row;
  }

  /** Between two picks: the shortest distance, between their centres, the angle, and (asked) the deltas. */
  private between(a: Described, b: Described): Row[] {
    const out: Row[] = [];
    const mid = (p: Vec3, q: Vec3): Vec3 => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    const m = closestPair(a.points, b.points);
    out.push({ name: "Distance", value: fmtLen(m.d), at: mid(m.p, m.q), a: m.p, b: m.q });
    if (dist(a.anchor, b.anchor) - m.d > 1e-6) out.push({ name: "Distance (centres)", value: fmtLen(dist(a.anchor, b.anchor)), at: mid(a.anchor, b.anchor), a: a.anchor, b: b.anchor });
    if (a.dir && b.dir) {
      const ang = (Math.acos(Math.min(1, Math.abs(dot(a.dir, b.dir)))) * 180) / Math.PI;
      out.push({ name: "Angle", value: `${trim(ang, 2)}°`, at: mid(a.anchor, b.anchor) });
    }
    if (this.deltas) {
      const d = sub(b.anchor, a.anchor);
      ["X", "Y", "Z"].forEach((n, i) => {
        const end = [...a.anchor] as Vec3;
        end[i] = b.anchor[i];
        out.push({ name: `Δ${n}`, value: fmtLen(Math.abs(d[i])), at: mid(a.anchor, end), a: a.anchor, b: end });
      });
    }
    return out;
  }

  /** A point's place: X, Y, Z, and how far it is off each axis (asked for: "XYZ from the axes too"). */
  private placeRows(at: Vec3, of = "Position"): Row[] {
    const u = UNIT_MM[units()];
    const v = (n: number) => `${trim(n / u, 3)} ${UNIT_LABEL[units()]}`;
    return [
      { name: `${of} X`, value: v(at[0]), at, a: [0, at[1], at[2]], b: at },
      { name: `${of} Y`, value: v(at[1]), at, a: [at[0], 0, at[2]], b: at },
      { name: `${of} Z`, value: v(at[2]), at, a: [at[0], at[1], 0], b: at },
      { name: "From X axis", value: v(Math.hypot(at[1], at[2])), at, a: [at[0], 0, 0], b: at },
      { name: "From Y axis", value: v(Math.hypot(at[0], at[2])), at, a: [0, at[1], 0], b: at },
      { name: "From Z axis", value: v(Math.hypot(at[0], at[1])), at, a: [0, 0, at[2]], b: at },
    ];
  }

  private describe(x: Pick): Described | null {
    if ("pt" in x) return { what: `${x.what} picked`, rows: this.placeRows(x.pt), anchor: x.pt, points: [x.pt] };
    return this.describeSel(x.sel);
  }

  /** A curve or a point of a sketch: its length, its radius, where it is. */
  private describeSketch(s: Sel): Described | null {
    if (s.kind !== "curve" && s.kind !== "point") return null;
    const plane = this.app.sketchPlane(s.sketch);
    const e = this.app.store.find<SketchFeature>(s.sketch)?.entities.find((x) => x.id === s.entity);
    if (!plane || !e) return null;
    const w = (q: Vec2) => sketchToWorld(plane, q).toArray() as Vec3;
    const u = UNIT_MM[units()];
    if (s.kind === "point" || e.kind === "point") {
      const q = s.kind === "point" ? pointOf(e, s.p) : pointOf(e, "c");
      if (!q) return null;
      const v = w(q);
      return { what: "Sketch point picked", rows: [{ name: "In the sketch (X, Y)", value: `${trim(q[0] / u, 3)}, ${trim(q[1] / u, 3)}`, at: v }, ...this.placeRows(v)], anchor: v, points: [v] };
    }
    const polys = entityPolylines(e);
    // (Straight runs filled in: the nearest distance to a line is then to its middle too, not just its ends.)
    const pts: Vec3[] = [];
    for (const pl of polys)
      for (let i = 0; i < pl.length; i++) {
        if (i) for (let k = 1; k < 48; k++) pts.push(w([pl[i - 1][0] + ((pl[i][0] - pl[i - 1][0]) * k) / 48, pl[i - 1][1] + ((pl[i][1] - pl[i - 1][1]) * k) / 48]));
        pts.push(w(pl[i]));
      }
    let length = 0;
    for (const pl of polys) for (let i = 1; i < pl.length; i++) length += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    const mid = pts.length ? pts[Math.floor(pts.length / 2)] : w([0, 0]);
    const rows: Row[] = [];
    let dir: Vec3 | undefined;
    let anchor = mid;
    if (e.kind === "line") {
      const a = w(e.a);
      const b = w(e.b);
      const d = sub(b, a);
      const l = len(d) || 1;
      dir = [d[0] / l, d[1] / l, d[2] / l];
      anchor = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      rows.push({ name: "Length", value: fmtLen(len(d)), at: anchor, a, b });
      const ang = (Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0]) * 180) / Math.PI;
      rows.push({ name: "Angle to X", value: `${trim(((ang % 180) + 180) % 180, 2)}°`, at: anchor });
    } else if (e.kind === "circle") {
      anchor = w(e.center);
      const a = w([e.center[0] - e.radius, e.center[1]]);
      const b = w([e.center[0] + e.radius, e.center[1]]);
      rows.push({ name: "Diameter", value: `Ø ${fmtLen(2 * e.radius)}`, at: anchor, a, b });
      rows.push({ name: "Radius", value: `R ${fmtLen(e.radius)}`, at: b, a: anchor, b });
      rows.push({ name: "Circumference", value: fmtLen(2 * Math.PI * e.radius), at: b });
      rows.push({ name: "Area", value: fmtArea(Math.PI * e.radius * e.radius), at: anchor });
      rows.push(...this.placeRows(anchor, "Centre"));
    } else if (e.kind === "arc" && pts.length >= 3) {
      rows.push({ name: "Length", value: fmtLen(length), at: mid });
      const r = circumradius(w(e.a), w(e.m), w(e.b));
      if (r) rows.push({ name: "Radius", value: `R ${fmtLen(r)}`, at: mid });
      const c = circumcentre(w(e.a), w(e.m), w(e.b));
      if (c) rows.push(...this.placeRows(c, "Centre"));
    } else if (e.kind === "rect") {
      anchor = w(e.center);
      rows.push({ name: "Width × height", value: `${trim(e.w / u, 3)} × ${fmtLen(e.h)}`, at: anchor });
      rows.push({ name: "Perimeter", value: fmtLen(length), at: anchor });
      rows.push({ name: "Area", value: fmtArea(e.w * e.h), at: anchor });
      rows.push(...this.placeRows(anchor, "Centre"));
    } else rows.push({ name: "Length", value: fmtLen(length), at: mid });
    return { what: "Sketch curve picked", rows, anchor, points: pts, dir };
  }

  private describeSel(s: Sel): Described | null {
    if (s.kind === "curve" || s.kind === "point") return this.describeSketch(s);
    if (s.kind !== "face" && s.kind !== "edge" && s.kind !== "body" && s.kind !== "vertex") return null;
    const b = this.app.view.body(s.body);
    if (!b) return null;
    if (s.kind === "vertex") {
      const v = this.app.view.vertexOf(s.body, s.vertex);
      if (!v) return null;
      return { what: "Vertex picked", rows: this.placeRows(v), anchor: v, points: [v] };
    }
    if (s.kind === "face") {
      const f = b.faces[s.face];
      const pts = facePoints(b, s.face);
      const rows: Row[] = [{ name: "Area", value: fmtArea(f.area), at: f.center }];
      // A round face (a shaft, a hole): its diameter, pinned as a line straight across it.
      if (f.round) {
        const r = f.round.r;
        const across = acrossCylinder(b, s.face, r, f.round.hole, f.center);
        rows.push({ name: f.round.hole ? "Diameter · hole" : "Diameter", value: `Ø ${fmtLen(2 * r)}`, at: across?.mid ?? f.center, ...(across ? { a: across.a, b: across.b } : {}) });
        rows.push({ name: "Radius", value: `R ${fmtLen(r)}`, at: across?.b ?? f.center, ...(across ? { a: across.mid, b: across.b } : {}) });
      }
      rows.push(...this.placeRows(f.center, "Centre"));
      return { what: `Face picked · ${niceType(f.type)}`, rows, anchor: f.center, points: pts, dir: f.plane ? f.normal : undefined };
    }
    if (s.kind === "edge") {
      const e = b.edges[s.edge];
      const pts = edgePoints(b, s.edge);
      const rows: Row[] = [{ name: "Length", value: fmtLen(e.length), at: e.mid, ...(e.type === "LINE" ? { a: e.start, b: e.end } : {}) }];
      let centre: Vec3 | null = null;
      if (e.type === "CIRCLE" && pts.length >= 3) {
        const [p0, p1, p2] = [pts[0], pts[Math.floor(pts.length / 3)], pts[Math.floor((2 * pts.length) / 3)]];
        const r = circumradius(p0, p1, p2);
        centre = circumcentre(p0, p1, p2);
        if (r) rows.push({ name: "Radius", value: `R ${fmtLen(r)}`, at: e.mid }, { name: "Diameter", value: `Ø ${fmtLen(2 * r)}`, at: e.mid });
      }
      rows.push(...this.placeRows(centre ?? e.mid, centre ? "Centre" : "Middle"));
      return { what: `Edge picked · ${niceType(e.type)}`, rows, anchor: centre ?? e.mid, points: pts, dir: e.type === "LINE" ? e.dir : undefined };
    }
    const pts: Vec3[] = [];
    for (let i = 0; i < b.positions.length; i += 3) pts.push([b.positions[i], b.positions[i + 1], b.positions[i + 2]]);
    const min = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])));
    const max = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
    const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const area = b.faces.reduce((s2, f) => s2 + f.area, 0);
    return {
      what: "Body picked",
      rows: [
        { name: "Size (X × Y × Z)", value: `${trim((max[0] - min[0]) / UNIT_MM[units()], 3)} × ${trim((max[1] - min[1]) / UNIT_MM[units()], 3)} × ${fmtLen(max[2] - min[2])}`, at: center },
        { name: "Surface area", value: fmtArea(area), at: center },
        { name: "Volume", value: fmtVolume(volume(b)), at: center },
        ...this.placeRows(center, "Centre"),
      ],
      anchor: center,
      points: pts,
    };
  }
}

interface Described {
  /** What it is ("Edge picked · circle"). */
  what: string;
  rows: Row[];
  anchor: Vec3;
  points: Vec3[];
  dir?: Vec3;
}

/** The centre of the circle through three points. */
function circumcentre(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const n = cross(ab, ac);
  const nn = dot(n, n);
  if (nn < 1e-18) return null;
  const t1 = cross(n, ab);
  const t2 = cross(ac, n);
  const k1 = dot(ac, ac) / (2 * nn);
  const k2 = dot(ab, ab) / (2 * nn);
  return [a[0] + t1[0] * k1 + t2[0] * k2, a[1] + t1[1] * k1 + t2[1] * k2, a[2] + t1[2] * k1 + t2[2] * k2];
}

function facePoints(b: BodyMesh, face: number): Vec3[] {
  const g = b.faceGroups.find((x) => x.face === face);
  if (!g) return [];
  const out: Vec3[] = [];
  for (let i = g.start; i < g.start + g.count; i++) {
    const v = b.indices[i] * 3;
    out.push([b.positions[v], b.positions[v + 1], b.positions[v + 2]]);
  }
  return out;
}

function edgePoints(b: BodyMesh, edge: number): Vec3[] {
  const g = b.edgeGroups.find((x) => x.edge === edge);
  if (!g) return [];
  const out: Vec3[] = [];
  for (let i = g.start; i < g.start + g.count; i++) out.push([b.edgePositions[i * 3], b.edgePositions[i * 3 + 1], b.edgePositions[i * 3 + 2]]);
  return out;
}

/**
 * A line straight across a round face, through its axis, level with the
 * middle of the face: its ends on the surface (null where the face's own
 * normals can't tell the axis).
 */
function acrossCylinder(b: BodyMesh, face: number, r: number, hole: boolean, center: Vec3): { a: Vec3; b: Vec3; mid: Vec3 } | null {
  const g = b.faceGroups.find((x) => x.face === face);
  if (!g || !g.count) return null;
  const at = (i: number): { p: Vec3; n: Vec3 } => {
    const v = b.indices[i] * 3;
    return { p: [b.positions[v], b.positions[v + 1], b.positions[v + 2]], n: [b.normals[v], b.normals[v + 1], b.normals[v + 2]] };
  };
  const first = at(g.start);
  // The surface's normals all stand square to the axis: two far apart give it.
  let axis: Vec3 | null = null;
  let best = 0.2;
  for (let i = g.start; i < g.start + g.count; i++) {
    const c = cross(first.n, at(i).n);
    const l = len(c);
    if (l > best) {
      best = l;
      axis = [c[0] / l, c[1] / l, c[2] / l];
    }
  }
  if (!axis) return null;
  // (A hole's surface faces its axis, a shaft's away from it.)
  const k = hole ? r : -r;
  const onAxis: Vec3 = [first.p[0] + first.n[0] * k, first.p[1] + first.n[1] * k, first.p[2] + first.n[2] * k];
  const t = dot(sub(center, onAxis), axis);
  const mid: Vec3 = [onAxis[0] + axis[0] * t, onAxis[1] + axis[1] * t, onAxis[2] + axis[2] * t];
  const side = dot(first.n, axis);
  const u0: Vec3 = [first.n[0] - axis[0] * side, first.n[1] - axis[1] * side, first.n[2] - axis[2] * side];
  const ul = len(u0);
  if (ul < 1e-9) return null;
  const u: Vec3 = [u0[0] / ul, u0[1] / ul, u0[2] / ul];
  return { a: [mid[0] - u[0] * r, mid[1] - u[1] * r, mid[2] - u[2] * r], b: [mid[0] + u[0] * r, mid[1] + u[1] * r, mid[2] + u[2] * r], mid };
}

function closestPair(a: Vec3[], b: Vec3[]): { d: number; p: Vec3; q: Vec3 } {
  let best = { d: Infinity, p: a[0], q: b[0] };
  const step = (n: number) => Math.max(1, Math.floor(n / 600));
  for (let i = 0; i < a.length; i += step(a.length)) {
    for (let j = 0; j < b.length; j += step(b.length)) {
      const d = dist(a[i], b[j]);
      if (d < best.d) best = { d, p: a[i], q: b[j] };
    }
  }
  return best;
}

function circumradius(a: Vec3, b: Vec3, c: Vec3): number | null {
  const ab = len(sub(b, a));
  const bc = len(sub(c, b));
  const ca = len(sub(a, c));
  const area2 = len(cross(sub(b, a), sub(c, a)));
  return area2 > 1e-12 ? (ab * bc * ca) / (2 * area2) : null;
}

/** Signed-tetrahedron volume of the (closed) mesh. */
function volume(b: BodyMesh): number {
  let v = 0;
  const p = b.positions;
  for (let i = 0; i < b.indices.length; i += 3) {
    const a = b.indices[i] * 3;
    const c = b.indices[i + 1] * 3;
    const d = b.indices[i + 2] * 3;
    v += (p[a] * (p[c + 1] * p[d + 2] - p[c + 2] * p[d + 1]) - p[a + 1] * (p[c] * p[d + 2] - p[c + 2] * p[d]) + p[a + 2] * (p[c] * p[d + 1] - p[c + 1] * p[d])) / 6;
  }
  return Math.abs(v);
}

function fmtArea(mm2: number): string {
  const k = UNIT_MM[units()];
  return `${trim(mm2 / (k * k), 3)} ${UNIT_LABEL[units()]}²`;
}

function fmtVolume(mm3: number): string {
  const k = UNIT_MM[units()];
  return `${trim(mm3 / (k * k * k), 3)} ${UNIT_LABEL[units()]}³`;
}

function niceType(t: string): string {
  return t.toLowerCase().replace(/_/g, " ").replace("bspline", "free-form").replace("cylindre", "cylinder");
}
