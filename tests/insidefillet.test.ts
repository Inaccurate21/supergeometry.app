// Run: npx tsx tests/insidefillet.test.ts
// A Smooth (G2) fillet in an inside corner is a fill added to the body. It was made as long as the edge and a
// little more, whatever the faces did: on the flat top of a round boss against a wall (the top narrows to nothing
// at the edge's ends) it stood out past the boss as a bar, with a block under each end. The fill now stays where
// both faces are there to carry it.
import type { Feature } from "../src/doc/types";
import { XY, after, block, bodies, check, circle, done, extrude, sketch, volume } from "./kit";

const fillet = (mid: number[], length: number, radius: number) => ({ id: "F", name: "F", type: "fillet", edges: [{ body: "wall", mid, dir: [1, 0, 0], length }], radius, g2: true }) as unknown as Feature;

// A wall 120 x 40 x 60 and a round boss of radius 30, 20 high, half in the wall and half out of its front (y = 0).
const s2 = sketch("s2", XY(), [circle("c", 60, 0, 30)]);
const bossed = [...block("wall", 120, 40, 60), s2, extrude("boss", s2, 20, "join", { target: "wall" })];
for (const r of [3, 8]) {
  const { errors } = await after([...bossed, fillet([60, 0, 20], 60, r)], "wall");
  const s = bodies().get("wall")!;
  const [[x0, y0, z0], [x1, y1, z1]] = s.boundingBox.bounds;
  check(`radius ${r}: the body is no bigger than the wall and its boss`, !errors.length && x0 > -1e-6 && x1 < 120 + 1e-6 && y0 > -30 - 1e-6 && y1 < 40 + 1e-6 && z0 > -1e-6 && z1 < 60 + 1e-6, `${[x0, y0, z0, x1, y1, z1].map((v) => v.toFixed(3)).join(" ")} ${errors.join("; ")}`);
  // Nothing of the fill beside the boss: whatever stands in front of the wall is over the boss's circle.
  let out = 0;
  for (const e of s.edges) {
    const p = e.pointAt(0.5).toTuple();
    if (p[1] < -1e-6 && Math.hypot(p[0] - 60, p[1]) > 30 + 1e-6) out++;
  }
  check(`radius ${r}: no edge of the fill hangs beside the boss`, out === 0, `${out} edges outside`);
  // The fill is there: where the boss's top is deeper than the fillet, the corner is filled.
  const before = volume((await after(bossed, "wall")).body);
  const added = volume((await after([...bossed, fillet([60, 0, 20], 60, r)], "wall")).body) - before;
  check(`radius ${r}: the corner is filled (less than a square bar of it, more than a third)`, added > 0.33 * 0.2146 * r * r * 60 && added < r * r * 60, `added ${added.toFixed(2)} mm3`);
}

// A plain inside corner (an L, 50 long): filled along its whole length, nothing past its ends.
{
  const s3 = sketch("s3", XY(), [{ id: "u", kind: "polyline", points: [[0, 0], [50, 0], [50, 10], [0, 10]], closed: true } as never]);
  const L = [...block("wall", 50, 40, 10), s3, extrude("up", s3, 40, "join", { target: "wall" })];
  const before = volume((await after(L, "wall")).body);
  const { errors, body } = await after([...L, fillet([25, 10, 10], 50, 5)], "wall");
  const added = volume(body) - before;
  const [[x0], [x1]] = body!.boundingBox.bounds;
  // A round of radius 5 would add (1 - pi/4) * 25 * 50 = 268.
  check("an L's inside corner: filled along its whole 50 mm, nothing past its ends", !errors.length && added > 150 && added < 400 && x0 > -1e-6 && x1 < 50 + 1e-6, `added ${added.toFixed(1)}, x ${x0.toFixed(3)}..${x1.toFixed(3)} ${errors.join("; ")}`);
}

// What stands beside the edge is left alone. An outside edge that ends at a wall: the round stops at the wall
// (it was refused: which way each face lies was asked at the edge's end, a corner of the wall).
const cutBy = async (fs: Feature[], f: Feature) => {
  const before = volume((await after(fs, "wall")).body);
  const { errors, body } = await after([...fs, f], "wall");
  return { errors, removed: before - volume(body), body: body! };
};
const g2 = (mid: number[], dir: number[], length: number, radius: number) => ({ id: "F", name: "F", type: "fillet", edges: [{ body: "wall", mid, dir, length }], radius, g2: true }) as unknown as Feature;
{
  const s4 = sketch("s4", XY(10), [{ id: "t", kind: "polyline", points: [[0, 0], [20, 0], [20, 40], [0, 40]], closed: true } as never]);
  const step = [...block("wall", 60, 40, 10), s4, extrude("tower", s4, 20, "join", { target: "wall" })];
  // The edge from the tower to the far end, 40 long: a Smooth blend of radius 5 takes 4.42 mm2 of the corner.
  const { errors, removed } = await cutBy(step, g2([40, 0, 10], [1, 0, 0], 40, 5));
  check("an outside edge ending at a wall: rounded along its 40 mm, the wall untouched", !errors.length && Math.abs(removed - 4.4198 * 40) < 0.5, `removed ${removed.toFixed(2)} ${errors.join("; ")}`);
  // A tower standing 2 mm back from the edge, nearer than the radius: not cut into.
  const s5 = sketch("s5", XY(10), [{ id: "t", kind: "polyline", points: [[0, 2], [20, 2], [20, 40], [0, 40]], closed: true } as never]);
  const back = [...block("wall", 60, 40, 10), s5, extrude("tower", s5, 20, "join", { target: "wall" })];
  const r2 = await cutBy(back, g2([30, 0, 10], [1, 0, 0], 60, 5));
  // (Cut into, it lost 565 mm3: the round and a 3 x 20 x 5 bite of the tower's foot.)
  check("a tower 2 mm from the edge: the round takes less than a clear edge would, the tower nothing", !r2.errors.length && r2.removed > 4.4198 * 40 && r2.removed < 4.4198 * 60 - 1, `removed ${r2.removed.toFixed(2)} ${r2.errors.join("; ")}`);
}
// A rib on a plate, its foot: a fill as long as the rib (it was refused, for the same reason).
{
  const s6 = sketch("s6", XY(8), [{ id: "r", kind: "polyline", points: [[15, 17], [45, 17], [45, 23], [15, 23]], closed: true } as never]);
  const rib = [...block("wall", 60, 40, 8), s6, extrude("rib", s6, 22, "join", { target: "wall" })];
  const { errors, removed } = await cutBy(rib, g2([30, 17, 8], [1, 0, 0], 30, 4));
  check("a rib's foot: filled along the rib's 30 mm and no further", !errors.length && Math.abs(-removed - 0.17679 * 16 * 30) < 0.5, `added ${(-removed).toFixed(2)} ${errors.join("; ")}`);
}
// A round boss 3 mm from the plate's edge, its foot at radius 6: the fill stops at the plate's edge.
{
  const s7 = sketch("s7", XY(5), [circle("c7", 0, 0, 10)]);
  const s0 = sketch("s0", XY(), [{ id: "p", kind: "polyline", points: [[-30, -13], [30, -13], [30, 30], [-30, 30]], closed: true } as never]);
  const boss = [s0, extrude("wall", s0, 5), s7, extrude("boss", s7, 15, "join", { target: "wall" })];
  const { errors, body } = await cutBy(boss, { id: "F", name: "F", type: "fillet", edges: [{ body: "wall", mid: [-10, 0, 5], dir: [0, 1, 0], length: 2 * Math.PI * 10 }], radius: 6, g2: true } as unknown as Feature);
  const y0 = body.boundingBox.bounds[0][1];
  check("a boss near the plate's edge: its foot's fill does not hang over the edge", !errors.length && y0 > -13 - 1e-6, `lowest y ${y0.toFixed(3)} ${errors.join("; ")}`);
}
done();
