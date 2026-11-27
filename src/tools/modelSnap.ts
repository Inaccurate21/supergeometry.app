// OSNAP on a body (a step's point picked on the model: a plane through 3 points, an axis through 2, Move from a point
// to a point, Scale's points, a joint's place): what a tap catches on near where it lands - corners, the ends and
// middles of edges, the centres of round edges and of flat faces, a sketch's points and line middles. As set by the
// mode (More's App settings? no - the step's own OSNAP choice, shared with Hole): Smart, All, As in the sketch, Off.
// Asked for: "OSNAP in the other body tools too".

import type { SketchFeature, Vec2, Vec3 } from "../doc/types";
import { settings } from "../settings";
import { pointsOf } from "../sketch/constraints";
import { sketchToWorld, type PickHit } from "../view/viewport";
import type { AppContext } from "./tool";

export interface ModelSnap {
  at: Vec3;
  what: string;
}

/** What each mode catches. */
export function modelOsnap(): { corner: boolean; mid: boolean; centre: boolean; sketch: boolean } {
  const m = settings.value.modelOsnap ?? "smart";
  if (m === "off") return { corner: false, mid: false, centre: false, sketch: false };
  if (m === "own") {
    const o = settings.value.osnap;
    return { corner: o.endpoint, mid: o.midpoint, centre: o.center, sketch: o.endpoint || o.intersection };
  }
  // (Smart and All: for a point picked on its own, a corner is as likely meant as a middle.)
  return { corner: true, mid: true, centre: true, sketch: true };
}

/** The centre of the circle through three points. */
function centre3(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const nn = n[0] * n[0] + n[1] * n[1] + n[2] * n[2];
  if (nn < 1e-18) return null;
  const cr = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const t1 = cr(n, ab);
  const t2 = cr(ac, n);
  const k1 = (ac[0] * ac[0] + ac[1] * ac[1] + ac[2] * ac[2]) / (2 * nn);
  const k2 = (ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]) / (2 * nn);
  return [a[0] + t1[0] * k1 + t2[0] * k2, a[1] + t1[1] * k1 + t2[1] * k2, a[2] + t1[2] * k1 + t2[2] * k2];
}

/** The snap point nearest the pointer (screen x, y) among what `hit` offers, within reach - or null. */
export function modelSnapAt(app: AppContext, hit: PickHit | null, x: number, y: number, tol: number): ModelSnap | null {
  if (!hit) return null;
  const os = modelOsnap();
  const c: ModelSnap[] = [];
  const add = (at: Vec3 | null | undefined, what: string, on: boolean) => on && at && c.push({ at, what });
  if (hit.kind === "vertex") add(app.view.vertexOf(hit.body, hit.vertex), "On a corner", true);
  else if (hit.kind === "edge") {
    const e = app.view.body(hit.body)?.edges[hit.edge];
    if (e) {
      add(e.start, "On an edge's end", os.corner);
      add(e.end, "On an edge's end", os.corner);
      add(e.mid, "On the middle of an edge", os.mid);
      if (e.type === "CIRCLE") add(centre3(e.start, e.mid, e.end), "On the centre of a round edge", os.centre);
    }
  } else if (hit.kind === "face") {
    const body = app.view.body(hit.body);
    const f = body?.faces[hit.face];
    if (f?.plane) add(f.center, "In the middle of the face", os.centre);
    // On a face near its edges: their ends, middles and centres too (the pointer on the face beside an edge) - only
    // ones in front (not round the back of the body, seen through it).
    if (body && body.edges.length < 4000) {
      const eye = app.view.cam.camera.position;
      const far = (q: Vec3) => Math.hypot(q[0] - eye.x, q[1] - eye.y, q[2] - eye.z);
      const limit = far(hit.point) + app.view.cam.worldPerPixel(app.view.height) * 20;
      const front = (q: Vec3 | null | undefined) => (q && far(q) <= limit ? q : null);
      for (const e of body.edges) {
        add(front(e.start), "On an edge's end", os.corner);
        add(front(e.end), "On an edge's end", os.corner);
        add(front(e.mid), "On the middle of an edge", os.mid);
        if (e.type === "CIRCLE") add(front(centre3(e.start, e.mid, e.end)), "On the centre of a round edge", os.centre);
      }
    }
  } else if (hit.kind === "curve" || hit.kind === "point") {
    const plane = app.sketchPlane(hit.sketch);
    const e = app.store.find<SketchFeature>(hit.sketch)?.entities.find((q) => q.id === hit.entity);
    if (plane && e && os.sketch) {
      const w = (q: Vec2) => sketchToWorld(plane, q).toArray() as Vec3;
      for (const q of pointsOf(e)) add(w(q.at), q.p === "c" ? "On a centre (sketch)" : "On a sketch point", q.p === "c" ? os.centre : os.corner);
      if (e.kind === "line") add(w([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]), "On the middle of a sketch line", os.mid);
    }
  }
  let best: ModelSnap | null = null;
  let bd = Math.max(24, tol * 1.6);
  for (const s of c) {
    const q = app.view.toScreen(s.at);
    if (!q) continue;
    const d = Math.hypot(q[0] - x, q[1] - y);
    if (d < bd) ((bd = d), (best = s));
  }
  return best;
}
