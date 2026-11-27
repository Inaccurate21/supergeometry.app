// Run: npx tsx tests/extrudeapart.test.ts
// Shapes of one sketch that stand apart, pulled up together as a new body, are a body each (ExtrudeFeature.separate,
// set on extrudes made in the app from now on): the first shape picked keeps the step's id, the others are id:2,
// id:3. Shapes that touch are one solid and one body. An extrude without the mark - one from a project made
// before - is one body in pieces, as it was. Adding to a body, or cutting, is not changed.
import type { Feature, SketchEntity } from "../src/doc/types";
import { XY, after, bodies, check, circle, done, extrude, health, near, profile, rect, sketch, volume } from "./kit";

const PI = Math.PI;
// Three circles apart (radius 5, 8, 3), and a rectangle 20 x 10 well away from them.
const es: SketchEntity[] = [circle("a", 0, 0, 5), circle("b", 30, 0, 8), circle("c", 0, 30, 3), rect("r", 50, 20, 70, 30)];
const s = sketch("s", XY(), es);
const ids = () => [...bodies().keys()];
const vol = (id: string) => volume(bodies().get(id));
const marked = (f: Feature, more: Record<string, unknown> = {}) => ({ ...f, separate: true, ...more }) as Feature;

{
  const { errors } = await after([s, marked(extrude("x", s, 10))]);
  check("four shapes apart, pulled up 10 as a new body: four bodies", !errors.length && ids().length === 4, ids());
  check("the first shape is the step's own body, the others x:2, x:3, x:4", ["x", "x:2", "x:3", "x:4"].every((id) => bodies().has(id)), ids());
  check("each is the solid of its own shape, in the order the shapes are in", near(vol("x"), PI * 25 * 10, 1e-3) && near(vol("x:2"), PI * 64 * 10, 1e-3) && near(vol("x:3"), PI * 9 * 10, 1e-3) && near(vol("x:4"), 2000, 1e-3), ids().map((id) => Math.round(vol(id))));
  check("each a sound solid in one piece", ids().every((id) => health(bodies().get(id)!).healthy));
}
{
  // The same shapes picked in another order: the bodies follow the picking.
  const src = profile("s", es, (rs) => [rs[3], rs[0], rs[2], rs[1]]);
  const f = marked({ id: "x", name: "x", type: "extrude", source: src, distance: 10, mode: "new" } as Feature);
  const { errors } = await after([s, f]);
  const got = ["x", "x:2", "x:3", "x:4"].map((id) => Math.round(vol(id)));
  const want = src.regions.map((r) => Math.round(Math.abs((r as { a: number }).a) * 10));
  check("picked in another order: the bodies are in that order", !errors.length && near(got[0], want[0], 20) && near(got[1], want[1], 20) && near(got[2], want[2], 20) && near(got[3], want[3], 20), `${got} / ${want}`);
}
{
  // Downwards, both ways, leaning, and with Auto: apart all the same.
  for (const [name, more, each] of [
    ["down 10", { distance: -10 }, 1],
    ["both ways 10", { symmetric: true }, 2],
    ["Auto on an empty floor", { mode: "auto", byDirection: true }, 1],
  ] as [string, Record<string, unknown>, number][]) {
    const { errors } = await after([s, marked(extrude("x", s, 10), more)]);
    check(`${name}: four bodies, the first its circle's solid`, !errors.length && ids().length === 4 && near(vol("x"), PI * 25 * 10 * each, 1e-2), `${ids().length} ${vol("x")}`);
  }
  const leaning = await after([s, marked(extrude("x", s, 10), { draft: 5 })]);
  check("with a draft of 5 degrees: four bodies still, each smaller than its straight solid", !leaning.errors.length && ids().length === 4 && vol("x") < PI * 25 * 10 && vol("x") > PI * 25 * 10 * 0.6, `${ids().length} ${vol("x")}`);
  const taper = await after([s, marked(extrude("x", s, 10), { taper: 0.5 })]);
  check("tapered to half: four bodies", !taper.errors.length && ids().length === 4, ids());
}
{
  // Shapes that touch are one body: a circle and the ring round it (two circles about one middle), and one apart.
  const ring: SketchEntity[] = [circle("in", 0, 0, 5), circle("out", 0, 0, 9), circle("far", 40, 0, 4)];
  const s2 = sketch("s2", XY(), ring);
  const { errors } = await after([s2, marked(extrude("x", s2, 10))]);
  check("a disc, the ring round it and a circle apart: two bodies", !errors.length && ids().length === 2, ids());
  const vs = ids().map(vol).sort((p, q) => q - p);
  check("the disc and its ring are one solid, the other circle the second", near(vs[0], PI * 81 * 10, 1e-2) && near(vs[1], PI * 16 * 10, 1e-2), vs);
}
{
  // One shape: one body, as ever.
  const s3 = sketch("s3", XY(), [circle("one", 0, 0, 5)]);
  const { errors } = await after([s3, marked(extrude("x", s3, 10))]);
  check("one shape: one body, the step's own", !errors.length && ids().join() === "x");
}
{
  // Not marked (a project made before): one body in four pieces.
  const { errors } = await after([s, extrude("x", s, 10)]);
  check("an extrude made before: one body, of all four solids", !errors.length && ids().join() === "x" && near(vol("x"), (PI * (25 + 64 + 9) + 200) * 10, 1e-2), `${ids()} ${vol("x")}`);
}
{
  // Added to a body, or cut out of one: the body it acts on, nothing new.
  const slab = sketch("p", XY(), [rect("pr", -20, -20, 80, 40)]);
  const base = extrude("slab", slab, 5);
  const up = sketch("u", XY(5), es);
  const join = await after([slab, base, up, marked(extrude("x", up, 10, "join", { target: "slab" }))]);
  check("added to a slab under them: one body, the slab with four bosses", !join.errors.length && ids().join() === "slab" && near(vol("slab"), 100 * 60 * 5 + (PI * (25 + 64 + 9) + 200) * 10, 1), `${ids()} ${vol("slab")}`);
  const cut = await after([slab, base, up, marked(extrude("x", up, -3, "cut", { target: "slab" }))]);
  check("cut into the slab: one body, four pockets", !cut.errors.length && ids().join() === "slab" && near(vol("slab"), 100 * 60 * 5 - (PI * (25 + 64 + 9) + 200) * 3, 1), `${ids()} ${vol("slab")}`);
}
{
  // A later step works on one of them by its own id: the second body rounded, the others as they were.
  const top = { body: "x:2", mid: [22, 0, 10], dir: [0, 1, 0], length: 2 * PI * 8 };
  const fillet = { id: "f", name: "f", type: "fillet", edges: [top], radius: 2 } as unknown as Feature;
  const { errors } = await after([s, marked(extrude("x", s, 10)), fillet]);
  check("the second body's top rim rounded by 2: that body is smaller, the first is not", !errors.length && vol("x:2") < PI * 64 * 10 - 1 && near(vol("x"), PI * 25 * 10, 1e-3), `${errors} ${vol("x:2")}`);
}
done();
