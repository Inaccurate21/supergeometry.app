// Run: npx tsx tests/holesnap.test.ts
// What a hole catches on, on its face, besides the face's own middle and round edges: the point where an axis
// passes through the face, and a sketch drawn on the face - its lines' ends, where they meet, its circles' centres.
import type { Feature, Vec3 } from "../src/doc/types";
import { holeSnaps } from "../src/tools/holeSnaps";
import { check, done, near } from "./kit";

const has = (pts: { at: Vec3; what: string }[], p: Vec3, what?: RegExp) => pts.some((s) => near(s.at[0], p[0], 1e-6) && near(s.at[1], p[1], 1e-6) && near(s.at[2], p[2], 1e-6) && (!what || what.test(s.what)));
const list = (pts: { at: Vec3; what: string }[]) => pts.map((s) => `${s.at.map((x) => +x.toFixed(3))} ${s.what}`);

// The top of a plate: z = 6, facing up.
const top: [Vec3, Vec3] = [[20, 10, 6], [0, 0, 1]];
{
  const s = holeSnaps([], [], ...top, 50);
  check("no sketch, no axis made: the one point is where the Z axis comes up through the face", s.length === 1 && has(s, [0, 0, 6], /Z axis passes through/), list(s));
  const front = holeSnaps([], [], [20, -20, 3], [0, -1, 0], 50);
  check("a front face: where the Y axis comes through, not X or Z (they run along it)", front.length === 1 && has(front, [0, -20, 0], /Y axis/), list(front));
  const slant = holeSnaps([], [], [0, 0, 10], [0, Math.SQRT1_2, Math.SQRT1_2], 50);
  check("a slanting face: Y and Z each come through it (at 10 along themselves)", slant.length === 2 && has(slant, [0, 10 * Math.SQRT2 / Math.SQRT2 * 1, 0].map((v, i) => (i === 1 ? 10 : v)) as Vec3, /Y axis/) && has(slant, [0, 0, 10], /Z axis/), list(slant));
}
{
  // An axis made with Construct, standing at (15, 5): its point on the face. Hidden, or switched off: not.
  const axis = { id: "ax", name: "Axis 01", type: "axis", origin: [15, 5, 0], dir: [0, 0, 2] } as unknown as Feature;
  const lying = { id: "ay", name: "Axis 02", type: "axis", origin: [0, 5, 6], dir: [1, 0, 0] } as unknown as Feature;
  const s = holeSnaps([axis, lying], [], ...top, 50);
  check("an axis made with Construct: where it passes through, by its name", has(s, [15, 5, 6], /Axis 01 passes through/) && s.length === 2, list(s));
  check("... hidden: not caught on", holeSnaps([axis], ["ax"], ...top, 50).length === 1, "");
  check("... switched off: not caught on", holeSnaps([{ ...axis, suppressed: true } as Feature], [], ...top, 50).length === 1, "");
  const tilted = { id: "at", name: "Axis 03", type: "axis", origin: [10, 0, 0], dir: [1, 0, 1] } as unknown as Feature;
  check("a tilted axis: where it meets the face's plane", has(holeSnaps([tilted], [], ...top, 50), [16, 0, 6], /Axis 03/), list(holeSnaps([tilted], [], ...top, 50)));
}
{
  // A sketch drawn on the face.
  const plane = { origin: [0, 0, 6], xDir: [1, 0, 0], normal: [0, 0, 1] };
  const sk = (id: string, entities: unknown[], pl: unknown = plane) => ({ id, name: id, type: "sketch", plane: pl, entities }) as unknown as Feature;
  const cross = sk("s", [
    { id: "a", kind: "line", a: [10, 0], b: [30, 20] },
    { id: "b", kind: "line", a: [10, 20], b: [30, 0] },
  ]);
  const s = holeSnaps([cross], [], ...top, 50);
  check("two lines that cross: their four ends and where they cross", [[10, 0, 6], [30, 20, 6], [10, 20, 6], [30, 0, 6], [20, 10, 6]].every((p) => has(s, p as Vec3, /sketch/)) && s.length === 6, list(s));
  const tee = holeSnaps([sk("s", [{ id: "a", kind: "line", a: [0, 5], b: [40, 5] }, { id: "b", kind: "line", a: [25, 5], b: [25, 18] }])], [], ...top, 50);
  check("a line that ends on another: that point, and the three free ends", [[0, 5, 6], [40, 5, 6], [25, 5, 6], [25, 18, 6]].every((p) => has(tee, p as Vec3)) && tee.length === 5, list(tee));
  const round = holeSnaps([sk("s", [{ id: "c", kind: "circle", center: [22, 12], radius: 4 }])], [], ...top, 50);
  check("a circle: its centre - and nothing on the circle itself", has(round, [22, 12, 6], /centre of a sketch circle/) && round.length === 2, list(round));
  const cut = holeSnaps([sk("s", [{ id: "c", kind: "circle", center: [22, 12], radius: 4 }, { id: "l", kind: "line", a: [10, 12], b: [34, 12] }])], [], ...top, 50);
  check("a circle with a line through it: the centre, the line's ends, and the two points it cuts the circle at", [[22, 12, 6], [10, 12, 6], [34, 12, 6], [18, 12, 6], [26, 12, 6]].every((p) => has(cut, p as Vec3)), list(cut));
  const arc = holeSnaps([sk("s", [{ id: "a", kind: "arc", a: [30, 10], m: [20, 20], b: [10, 10] }])], [], ...top, 50);
  check("an arc: its centre and its two ends", has(arc, [20, 10, 6], /centre of a sketch arc/) && has(arc, [30, 10, 6]) && has(arc, [10, 10, 6]), list(arc));
  const rect = holeSnaps([sk("s", [{ id: "r", kind: "rect", center: [20, 10], w: 20, h: 10, rotation: 0 }])], [], ...top, 50);
  check("a rectangle: its four corners", [[10, 5, 6], [30, 5, 6], [30, 15, 6], [10, 15, 6]].every((p) => has(rect, p as Vec3)), list(rect));
  // Only a sketch that is on the face, and shown.
  check("the sketch hidden: not caught on", holeSnaps([cross], ["s"], ...top, 50).length === 1, "");
  check("a sketch on another level: not caught on", holeSnaps([sk("s", (cross as any).entities, { ...plane, origin: [0, 0, 0] })], [], ...top, 50).length === 1, "");
  check("a sketch on an upright plane: not caught on", holeSnaps([sk("s", (cross as any).entities, { origin: [0, 0, 6], xDir: [1, 0, 0], normal: [0, -1, 0] })], [], ...top, 50).length === 1, "");
  // Drawn from below (the plane's normal the other way): still on the face, its points where they are.
  const under = holeSnaps([sk("s", [{ id: "a", kind: "line", a: [10, 0], b: [30, 20] }], { origin: [0, 0, 6], xDir: [1, 0, 0], normal: [0, 0, -1] })], [], ...top, 50);
  check("a sketch whose plane faces the other way: its ends, where they are in space", has(under, [10, 0, 6]) && has(under, [30, -20, 6]), list(under));
  // The same place twice is one point.
  const twice = holeSnaps([sk("s", [{ id: "a", kind: "line", a: [0, 0], b: [10, 0] }, { id: "b", kind: "line", a: [0, 0], b: [0, 10] }])], [], ...top, 50);
  check("a line's end where the Z axis comes through: one point, not two", twice.filter((p) => near(p.at[0], 0) && near(p.at[1], 0)).length === 1 && twice.length === 3, list(twice));
}

done();
