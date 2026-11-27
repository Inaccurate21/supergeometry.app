// Run: npx tsx tests/offsetseveral.test.ts
// Offset Edge with several edges picked one by one (not the whole outline, as Chain takes): those that join end to
// end go as one run, their corners kept; a run apart from the first goes to the same side of the lot as the first;
// and the first goes where it would go alone. Checked by measuring what comes out, not by what the code says.
import type { SketchEntity, Vec2 } from "../src/doc/types";
import { offsetEntity, offsetSeveral, outlineOffsetCurves } from "../src/sketch/edit";
import { check, done, near } from "./kit";

type LineE = Extract<SketchEntity, { kind: "line" }>;
const line = (id: string, a: Vec2, b: Vec2): LineE => ({ id, kind: "line", a, b });
const lines = (es: SketchEntity[]) => es.filter((e): e is LineE => e.kind === "line");
const same = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9;
/** How far a point is from a segment's own line. */
const off = (q: Vec2, l: LineE) => {
  const [dx, dy] = [l.b[0] - l.a[0], l.b[1] - l.a[1]];
  return Math.abs((q[0] - l.a[0]) * dy - (q[1] - l.a[1]) * dx) / Math.hypot(dx, dy);
};

// A rectangle 40 x 30 as four lines, drawn round anticlockwise from its bottom left corner.
const B = line("b", [0, 0], [40, 0]);
const R = line("r", [40, 0], [40, 30]);
const T = line("t", [40, 30], [0, 30]);
const L = line("l", [0, 30], [0, 0]);

{
  // One edge alone: what Offset Edge always made of it.
  const one = offsetSeveral([B], 5);
  const alone = offsetEntity(B, 5) as LineE;
  check("one edge: as it goes alone", one.length === 1 && same((one[0] as LineE).a, alone.a) && same((one[0] as LineE).b, alone.b), one);
}
{
  // Three sides, joined: one run of three lines that still meet at their corners, each 5 from its side.
  const made = lines(offsetSeveral([B, R, T], 5));
  check("three joined sides: three lines", made.length === 3, made.length);
  const meets = made.length === 3 && [0, 1].every((i) => made.some((x) => x !== made[i] && (same(x.a, made[i].b) || same(x.b, made[i].b) || same(x.a, made[i].a) || same(x.b, made[i].a))));
  check("  still joined at their two corners", meets, made);
  const each = [B, R, T].every((src) => made.some((m) => near(off(m.a, src), 5, 1e-9) && near(off(m.b, src), 5, 1e-9)));
  check("  each 5 from its own side", each, made);
  // All to one side of the rectangle: inside it (the first, the bottom drawn left to right, goes to its left - up).
  const inside = made.every((m) => [m.a, m.b].every((q) => q[0] > -1e-9 && q[0] < 40 + 1e-9 && q[1] > -1e-9 && q[1] < 30 + 1e-9));
  check("  all inside the rectangle, as the first one went", inside, made);
  // The corners are kept: the bottom's offset ends where the right side's begins, 5 in from both.
  check("  the corner between them at 35, 5", made.some((m) => same(m.a, [35, 5]) || same(m.b, [35, 5])), made);
  // The other way: all outside.
  const out = lines(offsetSeveral([B, R, T], -5));
  check("the other way: three lines outside it, the corner at 45, -5", out.length === 3 && out.some((m) => same(m.a, [45, -5]) || same(m.b, [45, -5])), out);
}
{
  // The fourth side left out is what Chain could not do: it is not offset, and the run is open.
  const made = lines(offsetSeveral([B, R, T], 5));
  check("the side not picked has no offset", !made.some((m) => near(off(m.a, L), 5, 1e-9) && near(off(m.b, L), 5, 1e-9) && Math.abs(m.a[0] - m.b[0]) < 1e-9), made);
}
{
  // Two opposite sides (apart): both towards the middle between them, or both away - never one each way. Whichever
  // way they were drawn.
  for (const top of [T, line("t", [0, 30], [40, 30])]) {
    const made = lines(offsetSeveral([B, top], 5));
    const ys = made.map((m) => m.a[1]).sort((x, y) => x - y);
    check(`two opposite sides (the top drawn ${top === T ? "right to left" : "left to right"}): both inward`, made.length === 2 && near(ys[0], 5, 1e-9) && near(ys[1], 25, 1e-9), ys);
    const back = lines(offsetSeveral([B, top], -5));
    const yb = back.map((m) => m.a[1]).sort((x, y) => x - y);
    check("  and the other way: both outward", back.length === 2 && near(yb[0], -5, 1e-9) && near(yb[1], 35, 1e-9), yb);
  }
}
{
  // The first tapped says the side: started from the right side, 5 goes to its left too.
  const made = lines(offsetSeveral([R, B], 5));
  const alone = offsetEntity(R, 5) as LineE;
  check("the first one tapped goes where it goes alone", made.some((m) => near(off(m.a, alone), 0, 1e-9) && near(off(m.b, alone), 0, 1e-9)), made);
}
{
  // A dashed one among them joins the run like the others.
  const made = lines(offsetSeveral([B, { ...R, construction: true }], 5));
  check("a dashed edge joins the run", made.length === 2 && made.some((m) => same(m.a, [35, 5]) || same(m.b, [35, 5])), made);
}
{
  // The same on a face's own outline (kept as a link to the face): the edge tapped, and the others by where they were tapped.
  const outline = [B, R, T, L].map((e) => ({ ...e, id: `bnd-${e.id}` }));
  const made = lines(outlineOffsetCurves(outline, [{ id: "o", distance: 5, at: [20, 0], single: true, also: [[40, 15]] }]));
  check("a face's outline: two of its edges together, joined at 35, 5", made.length === 2 && made.some((m) => same(m.a, [35, 5]) || same(m.b, [35, 5])), made);
  const one = lines(outlineOffsetCurves(outline, [{ id: "o", distance: 5, at: [20, 0], single: true }]));
  check("  one edge of it alone: as before", one.length === 1 && near(one[0].a[1], 5, 1e-9) && near(one[0].b[1], 5, 1e-9), one);
  const whole = lines(outlineOffsetCurves(outline, [{ id: "o", distance: -5, at: [20, 0] }]));
  check("  the whole loop (Chain): as before, four lines", whole.length === 4, whole.length);
}

done();
