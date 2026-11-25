// Select Other (as Fusion's): pressed and held still, everything under the pointer - a line drawn over another,
// a sketch's curve on a body's edge, an edge behind a face, the faces of bodies in the same place - in a list by
// the pointer, to choose the one meant. Asked for: "a line drawn on a line, or hidden in the view: hold it and
// choose which one, as in Fusion".

import type { SketchEntity, SketchFeature, Vec2, Vec3 } from "../doc/types";
import { entityPolylines } from "../sketch/curves";
import type { ToolPointer } from "../view/input";
import { sketchToWorld, type PickHit, type Viewport } from "../view/viewport";
import { filterHit } from "./selFilter";
import type { AppContext } from "./tool";
import { tr } from "../i18n";

export interface Choice {
  label: string;
  hit: PickHit;
}

const CURVE_NAMES: Record<SketchEntity["kind"], string> = {
  line: "Line",
  arc: "Arc",
  circle: "Circle",
  ellipse: "Ellipse",
  spline: "Spline",
  rect: "Rectangle",
  polygon: "Polygon",
  polyline: "Polyline",
  point: "Point",
};

const FACE_NAMES: Record<string, string> = { PLANE: "flat face", CYLINDRE: "cylinder", CYLINDER: "cylinder", CONE: "cone", SPHERE: "sphere", TORUS: "torus" };

/** Distance on screen from (x, y) to the segment a–b. */
function segDist(x: number, y: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}

/** The curves of a sketch within reach of (x, y) on screen, the nearest first. */
export function curvesNear(view: Viewport, entities: SketchEntity[], plane: Parameters<typeof sketchToWorld>[0], x: number, y: number, tol: number): { e: SketchEntity; d: number }[] {
  const out: { e: SketchEntity; d: number }[] = [];
  for (const e of entities) {
    let best = Infinity;
    if (e.kind === "point") {
      const s = view.toScreen(sketchToWorld(plane, e.at).toArray() as Vec3);
      if (s) best = Math.hypot(s[0] - x, s[1] - y);
    }
    for (const pl of entityPolylines(e)) {
      let prev: [number, number] | null = null;
      for (const q of pl as Vec2[]) {
        const s = view.toScreen(sketchToWorld(plane, q).toArray() as Vec3);
        if (s && prev) best = Math.min(best, segDist(x, y, prev, s));
        prev = s;
      }
    }
    if (best <= tol) out.push({ e, d: best });
  }
  return out.sort((a, b) => a.d - b.d);
}

/** Everything under the pointer that a tap could pick (through the selection filter). */
export function choicesAt(app: AppContext, p: ToolPointer): Choice[] {
  const view = app.view;
  const out: Choice[] = [];
  const seen = new Set<string>();
  const push = (label: string, h: PickHit | null) => {
    const k = h && JSON.stringify({ ...h, point: undefined });
    if (!h || !k || seen.has(k) || !filterHit(view, h)) return;
    seen.add(k);
    out.push({ label, hit: h });
  };
  const tol = Math.max(10, p.tol * 1.3);
  const names = app.store.doc.names ?? {};
  // A sketch's curves: every one within reach (one on top of another too).
  for (const f of app.store.features) {
    if (f.type !== "sketch") continue;
    const sk = f as SketchFeature;
    // (Only a sketch shown in the view: it is the one a pick finds there.)
    if (!view.pick(p.x, p.y, { edgeTolPx: tol, curves: sk.id, bodies: false, profiles: false, planes: false, axes: false, images: false })) continue;
    const plane = app.sketchPlane(sk.id);
    if (!plane) continue;
    const sname = names[sk.id] ?? sk.name ?? "Sketch";
    for (const { e } of curvesNear(view, sk.entities, plane, p.x, p.y, tol)) push(`${tr(sname)} – ${tr(CURVE_NAMES[e.kind])}${e.construction ? ` (${tr("construction")})` : ""}`, { kind: "curve", sketch: sk.id, entity: e.id, point: [0, 0, 0] });
  }
  const only = { curves: false, profiles: false, planes: false, axes: false, images: false };
  const body = (b: string) => names[b] ?? view.body(b)?.name ?? b;
  // A corner, an edge (also one hidden behind a face: a pick with the faces' own test left to edges).
  const v = view.pick(p.x, p.y, { ...only, edgeTolPx: tol });
  if (v?.kind === "vertex") push(`${tr(body(v.body))} – ${tr("vertex")}`, v);
  const ed = view.pick(p.x, p.y, { ...only, edgeTolPx: tol, vertices: false });
  if (ed?.kind === "edge") push(`${tr(body(ed.body))} – ${tr("edge")}`, ed);
  // The faces there (of every body at that depth), and the shape of a sketch under it.
  for (const h of view.facesAt(p.x, p.y)) if (h.kind === "face") push(`${tr(body(h.body))} – ${tr(FACE_NAMES[(view.body(h.body)?.faces[h.face]?.type ?? "").toUpperCase()] ?? "face")}`, h);
  const pr = view.pick(p.x, p.y, { edgeTolPx: 0, curves: false, profiles: true, edges: false, vertices: false, bodies: false });
  if (pr?.kind === "profile") push(`${tr(names[pr.sketch] ?? "Sketch")} – ${tr("shape")}`, pr);
  const pl = view.pick(p.x, p.y, { edgeTolPx: tol, curves: false, profiles: false, bodies: false, planes: true, axes: true });
  if (pl?.kind === "plane" || pl?.kind === "axis") push(`${tr(names[pl.id] ?? pl.id)} – ${tr(pl.kind === "plane" ? "plane" : "axis")}`, pl);
  return out;
}

/** The list by the pointer; `choose` takes the one tapped. */
export function showChoices(app: AppContext, p: ToolPointer, choices: Choice[], choose: (h: PickHit) => void): void {
  const r = app.view.canvas.getBoundingClientRect();
  app.ui.menu(
    r.left + p.x,
    r.top + p.y,
    choices.map((c) => ({
      label: c.label,
      run: () => choose(c.hit),
    })),
  );
  app.setHover(null);
}
