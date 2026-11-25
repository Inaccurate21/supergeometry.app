// Run: npx tsx tests/filletapart.test.ts
// Two edges that run on from each other along one line but lie between different walls, rounded in one step: two
// plain rounds, not one round with a swooping surface between. Reported with a project: a block's upright corner,
// its upper half between the left wall and the slanting wall of a cut, both halves rounded 9.
import { regenerate } from "../src/kernel/engine";
import type { Feature, SketchEntity } from "../src/doc/types";
import { after, check, done, extrude, health, near, poly, rect, sketch, volume, XY } from "./kit";

const ref = (body: string, e: any) => ({ body, mid: e.mid, dir: e.dir, length: e.length, steps: e.steps, curves: e.curves });
const rounds = (r: any) => r.bodies[0].faces.filter((f: any) => f.round);
const kinds = (r: any) => r.bodies[0].faces.map((f: any) => f.type).sort().join(",");

// A block 100 x 100 x 48 with a wedge cut 25 down from its top, the wedge's point on the block's corner: the
// corner's edge is two edges, 0 to 23 (front wall) and 23 to 48 (the cut's slanting wall, `slope` degrees off the front).
const part = (slope: number): Feature[] => {
  const s = sketch("s", XY(), [rect("r", 0, 0, 100, 100)]);
  const w = sketch("w", XY(48), [poly("t", [[0, 0], [100, 0], [100, 100 * Math.tan((slope * Math.PI) / 180)]]) as SketchEntity]);
  return [s, extrude("E", s, 48), w, extrude("W", w, -25, "cut", { target: "E" })];
};

for (const slope of [15, 30, 5]) {
  const base = part(slope);
  const r0: any = await regenerate(base);
  const corner = r0.bodies[0].edges.filter((e: any) => e.type === "LINE" && near(e.mid[0], 0, 1e-6) && near(e.mid[1], 0, 1e-6)).sort((a: any, b: any) => a.mid[2] - b.mid[2]);
  check(`a wedge cut at ${slope}°: the corner's edge is two, 23 and 25 long`, corner.length === 2 && near(corner[0].length, 23, 1e-6) && near(corner[1].length, 25, 1e-6), corner.map((e: any) => e.length));
  const V0 = volume((await after(base, "E")).body);
  for (const radius of [9, 4]) {
    const F = { id: "F", name: "F", type: "fillet", edges: corner.map((e: any) => ref("E", e)), radius } as Feature;
    const a = await after([...base, F], "E");
    const rs = rounds(a.r);
    // Each a part of a cylinder of that radius: a quarter round below (a square corner), more above (a sharper one).
    const turnUp = Math.PI - ((90 - slope) * Math.PI) / 180;
    const want = [radius * (Math.PI / 2) * 23, radius * turnUp * 25];
    const got = rs.map((f: any) => f.area).sort((x: number, y: number) => x - y);
    check(`... both rounded ${radius} in one step: two plain rounds, nothing else new`, !a.err && rs.length === 2 && rs.every((f: any) => near(f.round.r, radius, 1e-6)) && near(got[0], Math.min(...want), 0.5) && near(got[1], Math.max(...want), 0.5) && !/BSPLINE/.test(kinds(a.r)), `${rs.map((f: any) => `${f.type} r${f.round.r.toFixed(2)} A${f.area.toFixed(1)}`)} want ${want.map((x) => x.toFixed(1))} | ${kinds(a.r)} ${a.errors}`);
    check(`... a sound body, a little taken off`, health(a.body!).healthy && volume(a.body) < V0 && volume(a.body) > V0 - radius * radius * 48, `${volume(a.body)} / ${V0}`);
    // The same as rounding the upper, then the lower, as two steps.
    const two = await after([...base, { ...F, id: "U", edges: [ref("E", corner[1])] } as Feature, { ...F, id: "L", edges: [ref("E", corner[0])] } as Feature], "E");
    check(`... as the upper then the lower would be, as two steps`, !two.err && near(volume(a.body), volume(two.body), 1e-3), `${volume(a.body)} / ${volume(two.body)} ${two.errors}`);
    const C = { id: "C", name: "C", type: "chamfer", edges: corner.map((e: any) => ref("E", e)), radius } as Feature;
    const c = await after([...base, C], "E");
    check(`... and bevelled ${radius}: sound, flat faces only`, !c.err && health(c.body!).healthy && !rounds(c.r).length && volume(c.body) < V0, `${kinds(c.r)} ${c.errors}`);
  }
}

// What must stay as it was: edges that run on between the same walls, or walls that run on smoothly, are one round.
{
  // A block made of two blocks side by side, joined: its long top edge is one edge - or two between the same walls.
  const s = sketch("s", XY(), [rect("a", 0, 0, 40, 30), rect("b", 40, 0, 90, 30)]);
  const base: Feature[] = [s, extrude("E", s, 20)];
  const r0: any = await regenerate(base);
  const top = r0.bodies[0].edges.filter((e: any) => e.type === "LINE" && near(e.mid[1], 0, 1e-6) && near(e.mid[2], 20, 1e-6));
  const F = { id: "F", name: "F", type: "fillet", edges: top.map((e: any) => ref("E", e)), radius: 5 } as Feature;
  const a = await after([...base, F], "E");
  const want = 90 * 30 * 20 - (25 - (Math.PI * 25) / 4) * 90;
  check("a long edge of a joined block: one round its whole length", !a.err && near(volume(a.body), want, 1e-3) && rounds(a.r).length >= 1 && health(a.body!).healthy, `${top.length} edges, ${volume(a.body)} / ${want} ${a.errors}`);
  // All four upright corners of a plate at once: four rounds (edges that do not meet are never set apart).
  const p = sketch("p", XY(), [rect("r", 0, 0, 60, 40)]);
  const pb: Feature[] = [p, extrude("E", p, 10)];
  const rp: any = await regenerate(pb);
  const ups = rp.bodies[0].edges.filter((e: any) => e.type === "LINE" && Math.abs(e.dir[2]) > 0.99);
  const b = await after([...pb, { id: "F", name: "F", type: "fillet", edges: ups.map((e: any) => ref("E", e)), radius: 6 } as Feature], "E");
  check("a plate's four corners at once: four rounds", !b.err && rounds(b.r).length === 4 && near(volume(b.body), 60 * 40 * 10 - (36 - Math.PI * 9) * 4 * 10, 1e-3), `${rounds(b.r).length} ${b.errors}`);
}

done();
