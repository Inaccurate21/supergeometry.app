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
done();
