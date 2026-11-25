// What a hole catches on, on the plane of its face, besides the face's own middle and round edges:
//  - an axis (the three of the origin, and any made with Construct): the point where it passes through the face;
//  - a sketch drawn on that face: the ends of its lines, where its lines meet or cross, the centres of its circles.
//    A hole pattern laid out as a sketch is then a tap for each hole.
// Only what is shown: a hidden sketch or axis is not caught on.
import type { Feature, Vec2, Vec3 } from "../doc/types";
import { add, dist, dot, len, norm, scale, sub, toWorld } from "../geom";
import { arrangement } from "../sketch/regions";

export interface SnapPoint {
  at: Vec3;
  /** Said when it is caught on: "Where the Z axis passes through the face". */
  what: string;
}

export function holeSnaps(features: Feature[], hidden: string[], on: Vec3, out: Vec3, size: number): SnapPoint[] {
  const points: SnapPoint[] = [];
  const tol = 1e-6 * Math.max(1, size);
  const flat = (p: Vec3) => sub(p, scale(out, dot(sub(p, on), out)));
  const point = (at: Vec3, what: string) => {
    if (!points.some((p) => dist(p.at, at) < tol)) points.push({ at, what });
  };
  const off = new Set(hidden);
  const shown = (f: Feature) => !f.suppressed && !(f as { rolledBack?: boolean }).rolledBack && !off.has(f.id);

  // An axis that goes through the face (not one that runs along it): the point it comes out at.
  const axes: { name: string; origin: Vec3; dir: Vec3 }[] = [
    { name: "the X axis", origin: [0, 0, 0], dir: [1, 0, 0] },
    { name: "the Y axis", origin: [0, 0, 0], dir: [0, 1, 0] },
    { name: "the Z axis", origin: [0, 0, 0], dir: [0, 0, 1] },
  ];
  for (const f of features) if (f.type === "axis" && shown(f) && len(f.dir) > 1e-9) axes.push({ name: f.name, origin: f.origin, dir: norm(f.dir) });
  for (const a of axes) {
    const steep = dot(a.dir, out);
    if (Math.abs(steep) > 1e-6) point(add(a.origin, scale(a.dir, dot(sub(on, a.origin), out) / steep)), `Where ${a.name} passes through the face`);
  }

  for (const f of features) {
    if (f.type !== "sketch" || !shown(f) || !f.entities.length) continue;
    if (Math.abs(dot(norm(f.plane.normal), out)) < 1 - 1e-9 || Math.abs(dot(sub(f.plane.origin, on), out)) > Math.max(tol, 1e-4)) continue;
    const world = (q: Vec2) => flat(toWorld(f.plane, q));
    // Centres first: a circle's centre is what is meant, should a line also end there.
    for (const e of f.entities) {
      if (e.kind === "circle" || e.kind === "ellipse" || e.kind === "polygon") point(world(e.center), "On the centre of a sketch circle");
      else if (e.kind === "arc") {
        const c = centre2(e.a, e.m, e.b);
        if (c) point(world(c), "On the centre of a sketch arc");
      }
    }
    // Where its curves end, meet and cross.
    let arr;
    try {
      arr = arrangement(f.entities);
    } catch {
      continue;
    }
    // (A closed curve - a circle, a closed spline - is cut into pieces at marks of its own: no end is there, and
    // nothing meets there. Told by a point that only two pieces of one and the same curve come to.)
    const at = new Map<number, number[]>();
    for (const p of arr.pieces) for (const n of [p.n0, p.n1]) at.set(n, [...(at.get(n) ?? []), p.prim]);
    arr.nodes.forEach((q, i) => {
      const prims = at.get(i) ?? [];
      if (prims.length === 2 && prims[0] === prims[1]) return;
      point(world(q), "On the sketch: where a line ends or lines meet");
    });
  }
  return points;
}

/** The centre of the circle through three points of a plane (null: in a line). */
function centre2(a: Vec2, m: Vec2, b: Vec2): Vec2 | null {
  const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1]));
  if (Math.abs(d) < 1e-12) return null;
  const [A, M, B] = [a[0] * a[0] + a[1] * a[1], m[0] * m[0] + m[1] * m[1], b[0] * b[0] + b[1] * b[1]];
  return [(A * (m[1] - b[1]) + M * (b[1] - a[1]) + B * (a[1] - m[1])) / d, (A * (b[0] - m[0]) + M * (a[0] - b[0]) + B * (m[0] - a[0])) / d];
}
