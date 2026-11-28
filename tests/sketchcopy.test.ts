// Run: npx tsx tests/sketchcopy.test.ts
// A copy made in a sketch (dragged with Copy on; Move, Rotate or Scale with Copy on) takes with it the constraints
// that lie between the curves copied, each as it holds for the copy where it stands. It had none: a shape drawn
// once and copied to be changed a little fell apart at the first drag (reported). Checked by what the copy's
// constraints are and by their being met on the copy, not by what the code says.
import type { SketchConstraint, SketchEntity, Vec2 } from "../src/doc/types";
import { constraintError, copiedConstraints, solve } from "../src/sketch/constraints";
import { rotateXf, scaleXf, transformEntity, translateXf, type Xf } from "../src/sketch/edit";
import { check, done, near } from "./kit";

type LineE = Extract<SketchEntity, { kind: "line" }>;
const line = (id: string, a: Vec2, b: Vec2): LineE => ({ id, kind: "line", a, b });

// An L of three lines, joined at its corners, with a circle in its elbow and a line that is not part of it.
const A = line("a", [0, 0], [40, 0]);
const B = line("b", [40, 0], [40, 30]);
const C = line("c", [40, 30], [20, 30]);
const O: SketchEntity = { id: "o", kind: "circle", center: [30, 15], radius: 4 };
const OUT = line("x", [0, -20], [40, -20]);
const sketch: SketchEntity[] = [A, B, C, O, OUT];
const cons: SketchConstraint[] = [
  { id: "j1", type: "coincident", pts: [{ e: "a", p: "b" }, { e: "b", p: "a" }] },
  { id: "j2", type: "coincident", pts: [{ e: "b", p: "b" }, { e: "c", p: "a" }] },
  { id: "h", type: "horizontal", curves: ["a"] },
  { id: "v", type: "vertical", curves: ["b"] },
  { id: "par", type: "parallel", curves: ["a", "c"] },
  { id: "len", type: "dim", curves: ["a"], prop: "length", value: 40, expr: "shaft" },
  { id: "rad", type: "dim", curves: ["o"], prop: "radius", value: 4 },
  { id: "ang", type: "dim", curves: ["a", "b"], prop: "angle", value: 90 },
  { id: "far", type: "distance", pts: [{ e: "a", p: "a" }, { e: "c", p: "b" }], value: Math.hypot(20, 30) },
  { id: "off", type: "distance", pts: [{ e: "o", p: "c" }], curves: ["b"], value: 10 },
  // What must not go with a copy: a lock, ties to the line left behind, links to an original.
  { id: "lock", type: "fix", pts: [{ e: "a", p: "a" }], at: [0, 0] },
  { id: "tie", type: "parallel", curves: ["a", "x"] },
  { id: "gap", type: "distance", pts: [{ e: "a", p: "a" }, { e: "x", p: "a" }], value: 20 },
  { id: "pat", type: "pattern", curves: ["a", "c"], at: [0, 30] },
  { id: "fol", type: "follow", curves: ["a", "c"], how: { offset: 30 } },
];
check("the sketch as drawn meets its own constraints", constraintError(sketch, cons.filter((c) => c.type !== "pattern" && c.type !== "follow")) < 1e-9);

let n = 0;
const newId = () => `n${++n}`;
/** The curves `ids` copied by `xf`: the sketch with the copies in it, the copies' constraints, and which copy is whose. */
const copy = (ids: string[], xf: Xf) => {
  const map = new Map<string, string>();
  const copies = sketch.filter((e) => ids.includes(e.id)).map((e) => {
    const c = transformEntity(e, xf, true);
    map.set(e.id, c.id);
    return c;
  });
  const all = [...sketch, ...copies];
  const got = copiedConstraints(cons, map, all, newId);
  return { all, got, map, copies, of: (id: string) => got.find((c) => c.id !== id && [...(c.curves ?? []), ...(c.pts ?? []).map((p) => p.e)].join() === [...(cons.find((x) => x.id === id)!.curves ?? []), ...(cons.find((x) => x.id === id)!.pts ?? []).map((p) => p.e)].map((e) => map.get(e)).join() && (c.type === cons.find((x) => x.id === id)!.type || ((c.type === "horizontal" || c.type === "vertical") && (id === "h" || id === "v"))) && c.prop === cons.find((x) => x.id === id)!.prop) };
};
const types = (cs: SketchConstraint[]) => cs.map((c) => (c.type === "dim" ? `dim ${c.prop}` : c.type)).sort().join(", ");

// ---------------------------------------------------------------- moved
{
  const r = copy(["a", "b", "c", "o"], translateXf(60, 5));
  check("a moved copy: all ten that lie within it, no lock, no tie to what stays, no link to an original", r.got.length === 10 && types(r.got) === "coincident, coincident, dim angle, dim length, dim radius, distance, distance, horizontal, parallel, vertical", types(r.got));
  check("each is on the copies, none on an original", r.got.every((c) => [...(c.curves ?? []), ...(c.pts ?? []).map((p) => p.e)].every((id) => r.copies.some((e) => e.id === id))));
  check("each has an id of its own", new Set([...r.got.map((c) => c.id), ...cons.map((c) => c.id)]).size === r.got.length + cons.length);
  check("and they are met on the copy as it stands", constraintError(r.all, r.got) < 1e-9, constraintError(r.all, r.got));
  check("a size that follows a variable still does (the copy is the same size)", r.of("len")?.expr === "shaft" && r.of("len")?.value === 40, JSON.stringify(r.of("len")));
  // The point of it: the copy holds together when one of its lines is changed.
  const longer = r.got.map((c) => (c === r.of("len") ? { ...c, value: 55, expr: undefined } : c));
  const s = solve(r.all, [...cons.filter((c) => c.type !== "pattern" && c.type !== "follow"), ...longer]);
  const at = (id: string) => s.entities.find((e) => e.id === r.map.get(id)) as LineE;
  check("the copy's first line made 55 long: it is, still level, and the next line still starts at its end", s.ok && near(Math.hypot(at("a").b[0] - at("a").a[0], at("a").b[1] - at("a").a[1]), 55, 1e-6) && near(at("a").a[1], at("a").b[1], 1e-6) && near(Math.hypot(at("a").b[0] - at("b").a[0], at("a").b[1] - at("b").a[1]), 0, 1e-6), JSON.stringify([at("a"), at("b")]));
  const orig = s.entities.find((e) => e.id === "a") as LineE;
  check("and the original is as it was", near(orig.b[0] - orig.a[0], 40, 1e-6));
}

// ---------------------------------------------------------------- turned
{
  const quarter = copy(["a", "b", "c", "o"], rotateXf([0, 0], Math.PI / 2));
  check("turned a quarter round: the level line is upright and the upright one level", quarter.of("h")?.type === "vertical" && quarter.of("v")?.type === "horizontal", types(quarter.got));
  check("and all ten are there, met", quarter.got.length === 10 && constraintError(quarter.all, quarter.got) < 1e-9, `${quarter.got.length} ${constraintError(quarter.all, quarter.got)}`);
  const half = copy(["a", "b", "c", "o"], rotateXf([0, 0], Math.PI));
  check("turned half round: level is level, upright upright", half.of("h")?.type === "horizontal" && half.of("v")?.type === "vertical" && half.got.length === 10);
  const some = copy(["a", "b", "c", "o"], rotateXf([10, 5], Math.PI / 6));
  check("turned 30 degrees: neither level nor upright any more, the other eight kept", some.got.length === 8 && !some.got.some((c) => c.type === "horizontal" || c.type === "vertical") && constraintError(some.all, some.got) < 1e-9, types(some.got));
  check("its sizes are the same sizes", some.of("len")?.value === 40 && some.of("rad")?.value === 4 && some.of("ang")?.value === 90);
}

// ---------------------------------------------------------------- scaled
{
  const r = copy(["a", "b", "c", "o"], scaleXf([0, 0], 2));
  check("scaled to twice the size: all ten, met", r.got.length === 10 && constraintError(r.all, r.got) < 1e-9, `${r.got.length} ${types(r.got)}`);
  check("its sizes and distances are its own: 80, 8, 20 - the angle still 90", near(r.of("len")?.value ?? 0, 80) && near(r.of("rad")?.value ?? 0, 8) && near(r.of("off")?.value ?? 0, 20) && r.of("ang")?.value === 90 && near(r.of("far")?.value ?? 0, 2 * Math.hypot(20, 30)), JSON.stringify(r.got.filter((c) => c.value !== undefined).map((c) => [c.type, c.prop, c.value])));
  check("the one that followed a variable no longer does (it is another size)", r.of("len")?.expr === undefined);
}

// ---------------------------------------------------------------- part of the shape, and nothing
{
  const r = copy(["a", "b"], translateXf(0, 80));
  check("two of the three lines copied: their corner, level, upright, the length and the angle between them - nothing that reaches the third", types(r.got) === "coincident, dim angle, dim length, horizontal, vertical", types(r.got));
  const none = copy(["x"], translateXf(0, -10));
  check("a line with nothing on it but ties to others: its copy has none", none.got.length === 0, types(none.got));
  check("nothing copied: nothing", copiedConstraints(cons, new Map(), sketch, newId).length === 0);
}

done();
