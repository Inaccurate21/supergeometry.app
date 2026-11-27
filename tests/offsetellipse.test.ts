// Run: npx tsx tests/offsetellipse.test.ts
// The offset of an ellipse, and of part of one, is the curve that distance from it everywhere - not an ellipse with
// other radii, which is that far away only on its axes. Part of an ellipse is a piece of an outline like a line or
// an arc: offset with its neighbours it still meets them, and the outline made is closed. Measured on what comes out.
import type { SketchConstraint, SketchEntity, Vec2 } from "../src/doc/types";
import { connectedChain, ellipseEnds, offsetChain, offsetEntity, offsetSeveral, splineEnds } from "../src/sketch/edit";
import { entityPrims, evalPrim } from "../src/sketch/curves";
import { arrangement } from "../src/sketch/regions";
import { solve } from "../src/sketch/constraints";
import { XY, after, check, done, extrude, near, sketch, volume } from "./kit";

type EllipseE = Extract<SketchEntity, { kind: "ellipse" }>;
type SplineE = Extract<SketchEntity, { kind: "spline" }>;
const gap = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]);
/** A point of the ellipse at its own angle t. */
const on = (e: EllipseE, t: number): Vec2 => {
  const [c, s] = [Math.cos(e.rotation), Math.sin(e.rotation)];
  const [x, y] = [e.rx * Math.cos(t), e.ry * Math.sin(t)];
  return [e.center[0] + x * c - y * s, e.center[1] + x * s + y * c];
};
/** How far q is from the ellipse (all of it): a fine search, then closed in. */
const away = (e: EllipseE, q: Vec2): number => {
  let [best, bt] = [Infinity, 0];
  for (let i = 0; i < 2000; i++) {
    const t = (i * Math.PI) / 1000;
    const d = gap(on(e, t), q);
    if (d < best) [best, bt] = [d, t];
  }
  let h = Math.PI / 1000;
  for (let k = 0; k < 40; k++, h /= 2) for (const t of [bt - h, bt + h]) if (gap(on(e, t), q) < best) [best, bt] = [gap(on(e, t), q), t];
  return best;
};
/** The least and most a curve is from the ellipse, along all of it. */
const spread = (e: EllipseE, made: SketchEntity): [number, number] => {
  const p = entityPrims(made)[0];
  let [lo, hi] = [Infinity, 0];
  for (let i = 0; i <= 600; i++) {
    const d = away(e, evalPrim(p, i / 600));
    [lo, hi] = [Math.min(lo, d), Math.max(hi, d)];
  }
  return [lo, hi];
};
const ell = (id: string, center: Vec2, rx: number, ry: number, rotation = 0, a0?: number, sweep?: number): EllipseE => ({ id, kind: "ellipse", center, rx, ry, rotation, ...(sweep === undefined ? {} : { a0, sweep }) });

// ---- whole ellipses, outward and inward, round, long and thin, turned
for (const [rx, ry, d, rot] of [[40, 25, 5, 0], [40, 25, -6, 0.7], [100, 25, 30, 0], [100, 25, -4, -1.1], [100, 10, 60, 0.3], [12, 20, 3, 2], [380, 465, -70, 0]] as number[][]) {
  const e = ell("e", [7, -3], rx, ry, rot);
  const o = offsetEntity(e, d);
  const [lo, hi] = o ? spread(e, o) : [0, 0];
  const tol = Math.max(rx, ry) * 4e-4;
  check(`a whole ellipse ${rx} x ${ry} offset by ${d}: a closed curve that far from it all round`, !!o && o.kind === "spline" && !!o.closed && near(lo, Math.abs(d), tol) && near(hi, Math.abs(d), tol), `${lo.toFixed(4)} to ${hi.toFixed(4)}, ${(o as SplineE | null)?.points.length} points`);
  check(`  and in few points`, !!o && o.kind === "spline" && o.points.length <= 48, (o as SplineE | null)?.points.length);
}
// ---- parts of ellipses: that far all along, and the ends exactly the ellipse's ends moved straight out
for (const [rx, ry, d, a0, sweep, rot] of [[40, 25, 5, 0, Math.PI / 2, 0], [380, 465, -70, -Math.PI / 4, -Math.PI / 2, 0], [100, 25, 30, 0, Math.PI, 0.4], [100, 25, -4, 0.3, 2.2, -2], [100, 10, 5, -0.5, 1, 1], [30, 50, 8, 2, -4.5, 0.2]] as number[][]) {
  const e = ell("e", [-20, 11], rx, ry, rot, a0, sweep);
  const o = offsetEntity(e, d) as SplineE | null;
  const [lo, hi] = o ? spread(e, o) : [0, 0];
  const tol = Math.max(rx, ry) * 4e-4;
  check(`part of an ellipse ${rx} x ${ry} (${Math.round((sweep * 180) / Math.PI)} degrees) offset by ${d}: that far from it all along`, !!o && o.kind === "spline" && !o.closed && near(lo, Math.abs(d), tol) && near(hi, Math.abs(d), tol), `${lo.toFixed(4)} to ${hi.toFixed(4)}, ${o?.points.length} points`);
  const ends = o && splineEnds(o);
  const src = ellipseEnds(e)!;
  // (Straight out: along the line that is square to the ellipse there, so the end is |d| from the ellipse's end.)
  check(`  its ends ${Math.abs(d)} from the ellipse's ends, each square to it`, !!ends && near(gap(ends[0], src[0]), Math.abs(d), 1e-9) && near(gap(ends[1], src[1]), Math.abs(d), 1e-9) && near(away(e, ends[0]), Math.abs(d), 1e-6) && near(away(e, ends[1]), Math.abs(d), 1e-6), ends);
}
// ---- as round as a circle: still an ellipse, the radius changed; inward by more than it bends: nothing
{
  const o = offsetEntity(ell("e", [0, 0], 20, 20), 5);
  check("an ellipse as round as a circle: an ellipse 5 larger", !!o && o.kind === "ellipse" && near(o.rx, 25) && near(o.ry, 25), o);
  // 40 x 10 bends tightest at its tips: a circle of 10 * 10 / 40 = 2.5 fits there.
  check("inward by as much as its tightest bend: no curve (it would fold over itself)", offsetEntity(ell("e", [0, 0], 40, 10), -2.5) === null && offsetEntity(ell("e", [0, 0], 40, 10), -3) === null);
  check("inward by a little less: a curve", offsetEntity(ell("e", [0, 0], 40, 10), -2.4)?.kind === "spline");
  // (A part that keeps away from the tips can go further in.)
  check("a part away from the tips goes further in than the whole can", offsetEntity(ell("e", [0, 0], 40, 10, 0, Math.PI / 2 - 0.4, 0.8), -6)?.kind === "spline");
}
// ---- an outline with part of an ellipse in it: a line, a quarter of an ellipse, a line, and back
{
  // From (60, 0) up the quarter ellipse (centre at 0, 0; 60 x 35) to (0, 35); a line down the left to (0, -20);
  // a line along the bottom to (60, -20); a line up to (60, 0).
  const q = ell("q", [0, 0], 60, 35, 0, 0, Math.PI / 2);
  const es: SketchEntity[] = [q, { id: "l", kind: "line", a: [0, 35], b: [0, -20] }, { id: "b", kind: "line", a: [0, -20], b: [60, -20] }, { id: "r", kind: "line", a: [60, -20], b: [60, 0] }];
  const chain = connectedChain(es, "l");
  check("part of an ellipse is a piece of the outline: four pieces, closed", chain?.links.length === 4 && chain.closed, chain);
  const tips = (e: SketchEntity): [Vec2, Vec2] => (e.kind === "line" || e.kind === "arc" ? [e.a, e.b] : splineEnds(e)!);
  for (const d of [4, -4]) {
    const all = offsetChain(es, "l", d);
    const made = all?.slice(es.length) ?? [];
    let worst = 0;
    for (let i = 0; i < made.length; i++) worst = Math.max(worst, gap(tips(made[i])[1], tips(made[(i + 1) % made.length])[0]));
    check(`the outline offset by ${d}: its pieces meet end to end`, made.length >= 4 && worst < 1e-9, `${made.map((e) => e.kind).join(", ")}; widest gap ${worst}`);
    const regions = arrangement([...es, ...made]).regions;
    check(`  and with the outline it makes closed shapes (the band between them is one)`, regions.length === 2, regions.length);
    const sp = made.find((e) => e.kind === "spline");
    const [lo, hi] = sp ? spread(ell("w", [0, 0], 60, 35), sp) : [0, 0];
    check(`  its curved piece 4 from the ellipse`, !!sp && near(lo, 4, 0.03) && near(hi, 4, 0.03), `${lo} to ${hi}`);
  }
  // Three of them picked one by one (Offset, Edge): the same, an open run.
  const three = offsetSeveral([es[1], q, es[3]], 4);
  const meets = (a: SketchEntity, b: SketchEntity) => Math.min(...tips(a).flatMap((p) => tips(b).map((w) => gap(p, w))));
  const sp = three.find((e) => e.kind === "spline");
  const ls = three.filter((e) => e.kind === "line");
  check("a line, the part of an ellipse and a line picked one by one: the three offsets meet", three.length === 3 && !!sp && ls.length === 2 && meets(sp, ls[0]) < 1e-9 && meets(sp, ls[1]) < 1e-9, three.map((e) => e.kind));
}
// ---- the offset follows its ellipse: the ellipse given other radii, the offset is its offset still
{
  const e = ell("e", [0, 0], 40, 25);
  const o = { ...offsetEntity(e, 5)!, id: "o" };
  const cs: SketchConstraint[] = [
    { id: "f", type: "follow", curves: ["e", "o"], how: { offset: 5 } },
    { id: "rx", type: "dim", curves: ["e"], prop: "rx", value: 70 },
    { id: "ry", type: "dim", curves: ["e"], prop: "ry", value: 30 },
    { id: "pin", type: "fix", pts: [{ e: "e", p: "c" }], at: [0, 0] },
  ];
  const r = solve([e, o], cs);
  const E = r.entities.find((x) => x.id === "e") as EllipseE;
  const O = r.entities.find((x) => x.id === "o")!;
  const [lo, hi] = spread(E, O);
  check("an ellipse with its offset, made 70 x 30 by its sizes: the offset is 5 from it still", r.ok && near(E.rx, 70, 1e-5) && near(E.ry, 30, 1e-5) && near(lo, 5, 0.03) && near(hi, 5, 0.03), `${E.rx} x ${E.ry}; ${lo} to ${hi}`);
}
// ---- solids of them: the curve is one the kernel takes, and its area is the area such a curve has
{
  // The curve a distance d outside an ellipse encloses: the ellipse's area, d times its length round, and pi d d.
  const e = ell("e", [0, 0], 40, 25);
  let round = 0;
  for (let i = 0; i < 20000; i++) round += gap(on(e, (i * Math.PI) / 10000), on(e, ((i + 1) * Math.PI) / 10000));
  for (const d of [5, -6]) {
    const o = { ...offsetEntity(e, d)!, id: "o" };
    const s = sketch("s", XY(), [o]);
    const { body, err } = await after([s, extrude("x", s, 10)]);
    const want = (Math.PI * 40 * 25 + d * round + Math.PI * d * d) * 10;
    check(`the offset by ${d} of a 40 x 25 ellipse, made 10 tall: the solid that curve encloses`, !err && near(volume(body), want, want * 2e-4), `${volume(body)} against ${want} ${err ?? ""}`);
  }
  // The outline with a quarter of an ellipse in it, offset 4 inward: a solid of the offset alone, and one of the band.
  const q = ell("q", [0, 0], 60, 35, 0, 0, Math.PI / 2);
  const es: SketchEntity[] = [q, { id: "l", kind: "line", a: [0, 35], b: [0, -20] }, { id: "b", kind: "line", a: [0, -20], b: [60, -20] }, { id: "r", kind: "line", a: [60, -20], b: [60, 0] }];
  const made = offsetChain(es, "l", -4)!.slice(es.length);
  // (Its area by many short steps along its pieces.)
  const ring = made.flatMap((m) => Array.from({ length: 400 }, (_, i) => evalPrim(entityPrims(m)[0], i / 400)));
  let area = 0;
  for (let i = 0; i < ring.length; i++) area += ring[i][0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * ring[i][1];
  area = Math.abs(area) / 2;
  const whole = (Math.PI * 60 * 35) / 4 + 60 * 20;
  const s1 = sketch("s1", XY(), made);
  const one = await after([s1, extrude("x1", s1, 10)]);
  check("the outline's offset 4 inward, made 10 tall: a solid, of its area", !one.err && near(volume(one.body), area * 10, area * 10 * 2e-4) && area < whole - 4 * 150, `${volume(one.body)} against ${area * 10} ${one.err ?? ""}`);
  const s2 = sketch("s2", XY(), [...es, ...made]);
  const both = await after([s2, extrude("x2", s2, 10)]);
  check("the outline and its offset together, made 10 tall: the whole outline's solid", !both.err && near(volume(both.body), whole * 10, whole * 10 * 2e-4), `${volume(both.body)} against ${whole * 10} ${both.err ?? ""}`);
}
done();
