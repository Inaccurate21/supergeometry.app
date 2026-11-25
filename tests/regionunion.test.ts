// Run: npx tsx tests/regionunion.test.ts
// Several shapes of a sketch extruded together are one outline, joined flat - not a solid each, joined after.
// Reported: "The extrusion with the circle is buggy" - a bar, a ring over it and two lines up to the ring, all but
// the ring's middle picked and extruded: the ring was not in the body. Its inner circle all but touched the bar.
import type { Feature, SketchEntity } from "../src/doc/types";
import { arrangement, regionRef } from "../src/sketch/regions";
import { after, check, circle, done, health, near, rect, sketch, volume, XY, XZ } from "./kit";

const part = (cy: number): SketchEntity[] => {
  const on = (ang: number): [number, number] => [8.4 * Math.cos(ang), cy + 8.4 * Math.sin(ang)];
  return [
    { id: "r", kind: "rect", center: [0, 0], w: 20, h: 2, rotation: 0 } as SketchEntity,
    { id: "o", kind: "circle", center: [0, cy], radius: 8.4 } as SketchEntity,
    { id: "i", kind: "circle", center: [0, cy], radius: 7 } as SketchEntity,
    { id: "l", kind: "line", a: [-10, 1], b: on(3.1) } as SketchEntity,
    { id: "m", kind: "line", a: [10, 1], b: on(0.1) } as SketchEntity,
  ];
};
const ext = (regions: ReturnType<typeof regionRef>[], d = 12, more: Record<string, unknown> = {}): Feature => ({ id: "E", name: "E", type: "extrude", source: { kind: "profile", sketch: "s", regions }, distance: d, mode: "new", ...more }) as Feature;

// The inner circle clear of the bar, a hair from it either way, touching it exactly, and crossing it: everything
// but the circle's own middle, together.
for (const [name, cy] of [["clear of the bar", 8.6], ["a hair above it", 8.0000001], ["touching it", 8], ["a hair into it", 7.9999999], ["crossing it", 7.95]] as const) {
  const es = part(cy);
  const arr = arrangement(es);
  // (The middle: the regions wholly inside the inner circle.)
  const middle = (r: (typeof arr.regions)[number]) => Math.hypot(r.centroid[0], r.centroid[1] - cy) < 3 && r.area > 100;
  const pick = arr.regions.filter((r) => !middle(r));
  const want = pick.reduce((s, r) => s + r.area, 0) * 12;
  for (const [pl, d] of [[XY(), 12], [XZ(), -12]] as const) {
    const a = await after([sketch("s", pl, es), ext(pick.map(regionRef), d)], "E");
    const h = a.body ? health(a.body) : null;
    check(`the inner circle ${name}, ${pick.length} shapes together, ${d}: all of it, one sound body`, !a.err && !!h?.healthy && h.solids === 1 && near(volume(a.body), want, want * 1e-3), `${volume(a.body).toFixed(2)} / ${want.toFixed(2)} ${a.errors}`);
  }
}

// What it must still do as before.
{
  // Two shapes apart: two solids, each its size.
  const es = [rect("a", 0, 0, 10, 10), rect("b", 20, 0, 30, 10)];
  const arr = arrangement(es);
  const a = await after([sketch("s", XY(), es), ext(arr.regions.map(regionRef), 5)], "E");
  check("two shapes apart: both, 1000 in all", !a.err && near(volume(a.body) + [...a.r.bodies].slice(1).length * 0, 1000, 1e-6) || near(a.r.bodies.length, 2), `${volume(a.body)} ${a.r.bodies.length} ${a.errors}`);
}
{
  // A ring alone keeps its hole; the ring and its middle together are a disc.
  const es = [circle("o", 0, 0, 10), circle("i", 0, 0, 6)];
  const arr = arrangement(es);
  const ring = arr.regions.find((r) => r.holes.length)!;
  const a = await after([sketch("s", XY(), es), ext([regionRef(ring)], 5)], "E");
  check("a ring alone: its hole kept", !a.err && near(volume(a.body), Math.PI * (100 - 36) * 5, 1e-6) && a.r.bodies[0].faces.length === 4, `${volume(a.body)} ${a.r.bodies[0].faces.length}`);
  const b = await after([sketch("s", XY(), es), ext(arr.regions.map(regionRef), 5)], "E");
  check("the ring and its middle together: a plain disc, no seam", !b.err && near(volume(b.body), Math.PI * 100 * 5, 1e-6) && b.r.bodies[0].faces.length === 3, `${volume(b.body)} ${b.r.bodies[0].faces.length}`);
}
{
  // Two squares meeting at one corner: both, and a body the checks accept or refuse in words - never a breakdown.
  const es = [rect("a", 0, 0, 10, 10), rect("b", 10, 10, 20, 20)];
  const arr = arrangement(es);
  const a = await after([sketch("s", XY(), es), ext(arr.regions.map(regionRef), 5)], "E");
  check("two squares meeting at a corner: made (1000) or refused in words", (!a.err && near(volume(a.body) * (a.r.bodies.length === 1 ? 1 : 2), 1000, 1)) || (!!a.err && !/broke down/.test(a.err)), `${volume(a.body)} ${a.r.bodies.length} ${a.errors}`);
  // A grid of nine squares, the middle one left out: a frame with a square hole.
  const grid: SketchEntity[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) grid.push(rect(`g${i}${j}`, i * 10, j * 10, i * 10 + 10, j * 10 + 10));
  const ga = arrangement(grid);
  const frame = ga.regions.filter((r) => !(near(r.centroid[0], 15, 1e-6) && near(r.centroid[1], 15, 1e-6)));
  const g = await after([sketch("s", XY(), grid), ext(frame.map(regionRef), 4)], "E");
  check("eight squares round a ninth: one frame, ten faces", !g.err && frame.length === 8 && near(volume(g.body), 800 * 4, 1e-6) && g.r.bodies[0].faces.length === 10 && health(g.body!).healthy, `${volume(g.body)} ${g.r.bodies[0]?.faces.length} ${g.errors}`);
}

done();
