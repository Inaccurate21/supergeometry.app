// Run: npx tsx tests/rimround.test.ts
// A shelled bowl's rim rounded on both edges by half the wall: a full round rim. Reported: "check why i cant make
// two 0.5mm fillets ... on a shell that is 1mm thick" - "the radius is too big for the faces around those edges".
import type { Feature, SketchEntity } from "../src/doc/types";
import { arrangement, regionRef } from "../src/sketch/regions";
import { regenerate } from "../src/kernel/engine";
import { after, check, done, health, sketch, volume, XY } from "./kit";

// An arc and three lines turned round the top line, shelled with its flat end open.
const es: SketchEntity[] = [
  { id: "a", kind: "arc", a: [40, 0], m: [47.07, 2.93], b: [50, 10] } as SketchEntity,
  { id: "f", kind: "line", a: [40, 0], b: [40, 14] } as SketchEntity,
  { id: "g", kind: "line", a: [50, 10], b: [50, 14] } as SketchEntity,
  { id: "h", kind: "line", a: [50, 14], b: [40, 14] } as SketchEntity,
];
const s = sketch("s", XY(), es);
const R = { id: "R", name: "R", type: "revolve", source: { kind: "profile", sketch: "s", regions: arrangement(es).regions.map(regionRef) }, axis: { origin: [50, 14, 0], dir: [-1, 0, 0] }, angle: 360, mode: "new" } as unknown as Feature;
const r0: any = await regenerate([s, R]);
const open = r0.bodies[0].faces.find((f: any) => f.type === "PLANE" && f.normal[0] < -0.9);
const ref = (e: any) => ({ body: "R", mid: e.mid, dir: e.dir, length: e.length, steps: e.steps, curves: e.curves });

for (const wall of [1, 2, 0.8]) {
  const S = { id: "S", name: "S", type: "shell", body: "R", faces: [{ body: "R", center: open.center, normal: open.normal, area: open.area, step: open.step, curve: open.curve }], thickness: wall } as Feature;
  const base = [s, R, S];
  const r1: any = await regenerate(base);
  const rim = r1.bodies[0].edges.filter((e: any) => Math.abs(e.mid[0] - 40) < 1e-3 && e.length > 60).sort((x: any, y: any) => x.length - y.length);
  check(`a bowl shelled ${wall}: its rim has an inner and an outer edge`, !r1.errors.length && rim.length === 2, `${rim.length} ${r1.errors.map((e: any) => e.message)}`);
  const V = volume((await after(base, "R")).body);
  const F = (radius: number, pick = [0, 1]) => ({ id: "F", name: "F", type: "fillet", edges: pick.map((k) => ref(rim[k])), radius }) as Feature;
  const a = await after([...base, F(wall / 2)], "R");
  // What two quarter rounds take off a square rim: (1 - pi/4) r^2 each, round each edge's length.
  const off = (1 - Math.PI / 4) * (wall / 2) ** 2 * (rim[0].length + rim[1].length);
  check(`... both edges rounded ${wall / 2}, half the wall: a round rim`, !a.err && health(a.body!).healthy && Math.abs(V - volume(a.body) - off) < off * 0.05, `${a.err ?? ""} took ${(V - volume(a.body)).toFixed(3)} / ${off.toFixed(3)}`);
  const b = await after([...base, F(wall * 0.3)], "R");
  check(`... and ${(wall * 0.3).toFixed(2)}, with room to spare`, !b.err && health(b.body!).healthy && volume(b.body) < V, b.err ?? "");
  const c = await after([...base, F(wall * 0.75)], "R");
  check(`... ${(wall * 0.75).toFixed(2)}, more than the rim has room for: refused in words, the bowl as it was`, !!c.err && Math.abs(volume(c.body) - V) < 1e-6, c.err ?? "made");
}

done();
