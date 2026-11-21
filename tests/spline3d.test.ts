// Run: npx tsx tests/spline3d.test.ts
// A spline whose points are off its sketch's plane (the gimbal's third arrow, or a Height typed): it runs through
// space - drawn there, and a sweep follows it there. A flat one is as it always was.
import type { Shape3D } from "replicad";
import { after, bodies, check, circle, done, health, near, profile, sketch, volume, XY, YZ } from "./kit";
import type { Feature, SketchEntity } from "../src/doc/types";
import { entityPolylines, splineHeightSamples, splineHeights } from "../src/sketch/curves";
import { transformEntity } from "../src/sketch/edit";
import { solve } from "../src/sketch/constraints";

const flat: SketchEntity = { id: "p", kind: "spline", points: [[0, 0], [40, 0], [80, 0], [120, 0]], closed: false, mode: "fit" };
const high: SketchEntity = { ...flat, z: [0, 30, 30, 0] } as SketchEntity;

check("a flat spline has no heights", splineHeights(flat) === null && splineHeightSamples(flat) === null);
check("heights that don't fit its points are not used", splineHeights({ ...flat, z: [0, 5] } as SketchEntity) === null);
check("all zero is flat", splineHeights({ ...flat, z: [0, 0, 0, 0] } as SketchEntity) === null);
const hs = splineHeightSamples(high)!;
const poly = entityPolylines(high)[0];
check("one height for each point it is drawn through", hs.length === poly.length, `${hs.length} / ${poly.length}`);
check("it passes through its points at their heights", near(hs[0], 0) && near(hs[16], 30) && near(hs[32], 30) && near(hs[hs.length - 1], 0), [hs[0], hs[16], hs[32], hs[hs.length - 1]]);
check("its shadow on the plane is the flat one's", JSON.stringify(poly) === JSON.stringify(entityPolylines(flat)[0]));

// Moved in the plane, turned, mirrored: as far off it. Scaled: that much nearer or further.
const moved = transformEntity(high, (q) => [q[0] + 10, q[1] - 5]) as typeof high & { z?: number[] };
check("moved in the plane: the heights stay", JSON.stringify(moved.z) === "[0,30,30,0]");
const scaled = transformEntity(high, (q) => [q[0] * 2, q[1] * 2]) as typeof high & { z?: number[] };
check("scaled 2: twice as high", JSON.stringify(scaled.z) === "[0,60,60,0]");
// The solver moves its points in the plane and leaves the heights.
const pinned = solve([high], [{ id: "f", type: "fix", pts: [{ e: "p", p: "k3" }], at: [130, 10] }]);
check("a constraint moves a point in the plane; the heights stay", pinned.ok && JSON.stringify((pinned.entities[0] as any).z) === "[0,30,30,0]" && near((pinned.entities[0] as any).points[3][0], 130, 1e-6));

// A round rod swept along it: flat, it lies in the plane; with heights, it rises 30 and is longer.
const rod = (path: SketchEntity): Feature[] => {
  const p = sketch("path", XY(), [path]);
  const c = sketch("prof", YZ(0), [circle("c", 0, 0, 3)]);
  return [p, c, { id: "S", name: "Sweep", type: "sweep", source: profile("prof", [circle("c", 0, 0, 3)]), path: { kind: "sketch", sketch: "path", entities: ["p"] }, mode: "new" } as Feature];
};
let r = await after(rod(flat), "S");
const vFlat = volume(r.body);
const boxOf = (s: Shape3D) => s.boundingBox.bounds;
check("flat path: a straight rod 120 long", !r.err && near(vFlat, Math.PI * 9 * 120, 1), `${vFlat.toFixed(1)} ${r.err ?? ""}`);
r = await after(rod(high), "S");
const body = [...bodies().values()][0] as Shape3D;
const vHigh = volume(body);
const [lo, hi] = boxOf(body);
check("lifted path: the rod is swept, sound", !r.err && !!body && health(body).healthy, r.err ?? "");
check("it rises off the plane: to about 30 + its radius", hi[2] > 31 && hi[2] < 36 && lo[2] > -3.5, `z ${lo[2].toFixed(2)} .. ${hi[2].toFixed(2)}`);
// Its length: along the curve drawn (the sum of its pieces), so its volume is that times the rod's section.
let run = 0;
for (let i = 1; i < poly.length; i++) run += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1], hs[i] - hs[i - 1]);
check("as long as the curve through space", run > 125 && near(vHigh, Math.PI * 9 * run, Math.PI * 9 * run * 0.01), `${vHigh.toFixed(1)} / ${(Math.PI * 9 * run).toFixed(1)} (${run.toFixed(2)} long)`);
done();
