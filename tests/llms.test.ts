// Run: npx tsx tests/llms.test.ts
// The page for AI assistants (public/llms.txt) says how to write a project by hand. Every complete example in it
// is opened here as the app would open it and built: no step may fail, and what comes out is what the page says.
// And the smaller things it claims, tried one by one - so the page cannot tell an assistant something that is not so.
import { readFileSync } from "node:fs";
import { regenerate } from "../src/kernel/engine";
import { parseProject } from "../src/doc/store";
import { resolveDoc } from "../src/doc/params";
import type { Feature } from "../src/doc/types";
import { after, check, done, health, near, volume } from "./kit";

const page = readFileSync(new URL("../public/llms-full.txt", import.meta.url), "utf8");

// ---------------------------------------------------------------- the complete examples
const examples = [...page.matchAll(/<!-- example: (\w+)((?: \w+=[\d.]+)*) -->\s*```json\n([\s\S]*?)\n```/g)];
check("the page has its three complete examples", examples.length === 3, examples.map((m) => m[1]));
const built = new Map<string, any>();
for (const [, name, says, json] of examples) {
  const want = Object.fromEntries(says.trim().split(/\s+/).filter(Boolean).map((kv) => kv.split("=").map((x, i) => (i ? Number(x) : x))));
  // As File > Open reads it (formulas worked out, as the app does on opening).
  const doc = parseProject(json);
  const problems = resolveDoc(doc);
  const r: any = await regenerate(doc.features as Feature[]);
  built.set(name, { doc, r });
  check(`${name}: opens, every formula worked out, every step builds`, !problems.length && !r.errors.length, [...problems, ...r.errors.map((e: any) => `${e.featureId}: ${e.message}`)]);
  check(`${name}: ${want.bodies} ${want.bodies === 1 ? "body" : "bodies"}`, r.bodies.length === want.bodies, r.bodies.map((b: any) => b.id));
  if (want.volume) {
    const a = await after(doc.features as Feature[], r.bodies[0].id);
    check(`${name}: a sound body of the volume the page gives (${want.volume})`, health(a.body!).healthy && near(volume(a.body), want.volume, 0.5), volume(a.body).toFixed(2));
  }
}
{
  // The plate: exactly what was asked - rounded corners 5, four holes of 4.5 right through, 6 thick by its variable.
  const { doc, r } = built.get("plate");
  const faces = r.bodies[0].faces;
  const holes = faces.filter((f: any) => f.round?.hole);
  const corners = faces.filter((f: any) => f.round && !f.round.hole);
  check("plate: four holes of 4.5 and four corners of 5", holes.length === 4 && holes.every((f: any) => near(f.round.r, 2.25, 1e-6)) && corners.length === 4 && corners.every((f: any) => near(f.round.r, 5, 1e-6)), faces.map((f: any) => f.round?.r));
  const exact = (2400 - (4 - Math.PI) * 25) * 6 - 4 * Math.PI * 2.25 ** 2 * 6;
  const a = await after(doc.features, "plate");
  check("plate: the volume worked out by hand", near(volume(a.body), exact, 1e-3), `${volume(a.body)} / ${exact}`);
  // Its thickness follows the variable.
  const thick = parseProject(JSON.stringify({ ...doc, variables: [{ name: "t", expr: "10" }] }));
  resolveDoc(thick);
  const b = await after(thick.features as Feature[], "plate");
  check("plate: t made 10 - the plate is 10 thick, holes and all", !b.err && near(volume(b.body), (exact / 6) * 10, 1e-3), `${volume(b.body)} ${b.errors}`);
}
{
  const { doc, r } = built.get("knob");
  const a = await after(doc.features, "knob");
  const plain = Math.PI * (144 * 6 + (4 / 3) * (144 + 72 + 36) + 36 * 14);
  check("knob: the turned shape less a 1 mm bevel round its top", volume(a.body) < plain && volume(a.body) > plain - 25 && r.bodies[0].faces.some((f: any) => f.type === "CONE"), `${volume(a.body)} / ${plain}`);
}
{
  const { doc, r } = built.get("box");
  const ids = r.bodies.map((b: any) => b.id).sort();
  check("box: the bodies are 'box' and 'lid', by the ids of the steps that made them", JSON.stringify(ids) === JSON.stringify(["box", "lid"]), ids);
  const box = await after(doc.features, "box");
  const lid = await after(doc.features, "lid");
  check("box: hollow, 2 mm walls and floor, open on top", near(volume(box.body), 50 * 40 * 30 - 46 * 36 * 28, 1e-3), volume(box.body));
  check("box: the lid with its lip, 0.2 clear of the opening all round", near(volume(lid.body), 50 * 40 * 3 + 45.6 * 35.6 * 3, 1e-3), volume(lid.body));
}

// ---------------------------------------------------------------- the smaller things it says
const plane = { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, 0, 1] };
const sk = (id: string, entities: unknown[], pl: unknown = plane) => ({ id, name: id, type: "sketch", plane: pl, entities });
const ex = (id: string, sketch: string, k: string[], distance: number, more: Record<string, unknown> = {}) => ({ id, name: id, type: "extrude", source: { kind: "profile", sketch, regions: [{ c: [0, 0], a: 100, k }] }, distance, mode: "new", ...more });
const build = async (features: unknown[], body: string) => after(features as Feature[], body);
{
  // The least a file needs.
  const doc = parseProject(JSON.stringify({ format: "super", version: 2, name: "x", features: [] }));
  check("the least a file needs: format, version, name, features", doc.units === "mm" && Array.isArray(doc.variables) && doc.features.length === 0, doc.units);
}
{
  // Each kind of curve the page lists makes a shape that extrudes, named by its own id.
  const curves: [string, Record<string, unknown>, number][] = [
    ["rect", { kind: "rect", center: [0, 0], w: 20, h: 10, rotation: 0 }, 200],
    ["circle", { kind: "circle", center: [0, 0], radius: 5 }, Math.PI * 25],
    ["polygon", { kind: "polygon", center: [0, 0], radius: 10, sides: 6, angle: 0 }, 3 * 100 * Math.sin(Math.PI / 3)],
    ["polyline", { kind: "polyline", points: [[0, 0], [20, 0], [0, 10]], closed: true }, 100],
    ["ellipse", { kind: "ellipse", center: [0, 0], rx: 10, ry: 5, rotation: 0 }, Math.PI * 50],
  ];
  for (const [name, curve, area] of curves) {
    const a = await build([sk("s", [{ id: "x", ...curve }]), ex("E", "s", ["x"], 2)], "E");
    check(`a ${name}: extruded 2, the volume of its area`, !a.err && near(volume(a.body), area * 2, area * 2 * 2e-3), `${volume(a.body)} / ${area * 2} ${a.errors}`);
  }
  // Lines and an arc end to end: one shape, named by all their ids, sorted.
  const d = await build([sk("s", [{ id: "l", kind: "line", a: [-10, 0], b: [10, 0] }, { id: "a", kind: "arc", a: [10, 0], m: [0, 10], b: [-10, 0] }]), ex("E", "s", ["a", "l"], 2)], "E");
  check("a line and an arc end to end: a half disc", !d.err && near(volume(d.body), Math.PI * 100, 0.5), `${volume(d.body)} ${d.errors}`);
  // A closed spline.
  const sp = await build([sk("s", [{ id: "x", kind: "spline", points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, mode: "fit" }]), ex("E", "s", ["x"], 2)], "E");
  check("a closed spline: a body", !sp.err && volume(sp.body) > 100, `${volume(sp.body)} ${sp.errors}`);
}
{
  // A sketch point [u, v] on the upright plane is world [u, 0, v]; + distance goes along the plane's normal.
  const up = { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, -1, 0] };
  const a = await build([sk("s", [{ id: "x", kind: "rect", center: [10, 20], w: 4, h: 6, rotation: 0 }], up), ex("E", "s", ["x"], 3)], "E");
  const box = health(a.body!).box;
  check("the upright plane: [u, v] is [u, 0, v], and + goes along its normal (-Y)", near(box[0][0], 8) && near(box[1][0], 12) && near(box[0][2], 17) && near(box[1][2], 23) && near(box[0][1], -3) && near(box[1][1], 0), box);
  const b = await build([sk("s", [{ id: "x", kind: "rect", center: [0, 0], w: 4, h: 6, rotation: 0 }], { ...plane, origin: [0, 0, 7] }), ex("E", "s", ["x"], -2)], "E");
  check("a ground sketch at z 7, extruded -2: from 5 to 7", near(health(b.body!).box[0][2], 5) && near(health(b.body!).box[1][2], 7), health(b.body!).box);
}
{
  // Extrude's options; join and cut with a target.
  const base = [sk("s", [{ id: "x", kind: "rect", center: [0, 0], w: 20, h: 20, rotation: 0 }])];
  const sym = await build([...base, ex("E", "s", ["x"], 5, { symmetric: true })], "E");
  check("symmetric: that distance both ways", near(volume(sym.body), 400 * 10, 1e-6), volume(sym.body));
  const tap = await build([...base, ex("E", "s", ["x"], 9, { taper: 0.5 })], "E");
  check("taper 0.5: the far end half size", near(volume(tap.body), (9 / 3) * (400 + 100 + 200), 1e-3), volume(tap.body));
  const two = [...base, ex("E", "s", ["x"], 5), sk("s2", [{ id: "c", kind: "circle", center: [0, 0], radius: 4 }], { ...plane, origin: [0, 0, 5] })];
  const join = await build([...two, ex("J", "s2", ["c"], 3, { mode: "join", target: "E" })], "E");
  check("join with a target: added to that body", !join.err && join.r.bodies.length === 1 && near(volume(join.body), 2000 + Math.PI * 16 * 3, 0.2), `${volume(join.body)} ${join.errors}`);
  const cut = await build([...two, ex("C", "s2", ["c"], -2, { mode: "cut", target: "E" })], "E");
  check("cut with a target: taken from it", !cut.err && near(volume(cut.body), 2000 - Math.PI * 16 * 2, 0.2), `${volume(cut.body)} ${cut.errors}`);
  const thru = await build([...two, ex("C", "s2", ["c"], -1, { mode: "cut", target: "E", extent: "through" })], "E");
  check("a cut with extent through: right through", !thru.err && near(volume(thru.body), 2000 - Math.PI * 16 * 5, 0.2), `${volume(thru.body)} ${thru.errors}`);
  // A face and an edge given roughly are still found.
  const rough = await build([...base, ex("E", "s", ["x"], 5), { id: "F", name: "F", type: "fillet", radius: 2, edges: [{ body: "E", mid: [10.2, 9.9, 2.4], dir: [0, 0, 1], length: 5.1 }] }], "E");
  check("an edge given a little off: found, rounded", !rough.err && near(volume(rough.body), 2000 - (4 - Math.PI) * 5, 1e-3), `${volume(rough.body)} ${rough.errors}`);
  // A round edge: its circumference, and any point of the circle.
  for (const mid of [[4, 0, 8], [-4, 0, 8], [0, 4, 8], [2.83, -2.83, 8]]) {
    const c = await build([...two, ex("J", "s2", ["c"], 3, { mode: "join", target: "E" }), { id: "K", name: "K", type: "chamfer", radius: 1, edges: [{ body: "E", mid, dir: [0, 1, 0], length: 25.1 }] }], "E");
    check(`a round edge given by the point ${mid} of its circle: bevelled`, !c.err && volume(c.body) < volume(join.body) - 5, `${volume(c.body)} ${c.errors}`);
  }
}
{
  // Hole: each head; to a depth; a counterbore's sizes from the table.
  const base = [sk("s", [{ id: "x", kind: "rect", center: [0, 0], w: 30, h: 30, rotation: 0 }]), ex("E", "s", ["x"], 10)];
  const hole = (more: Record<string, unknown>) => ({ id: "H", name: "H", type: "hole", face: { body: "E", center: [0, 0, 10], normal: [0, 0, 1], area: 900 }, at: [5, 5, 10], size: "M5", diameter: 5.5, through: true, depth: 10, head: "none", headDiameter: 10, headDepth: 5.4, ...more });
  const R = 2.75;
  const plain = await build([...base, hole({})], "E");
  check("a hole right through", !plain.err && near(volume(plain.body), 9000 - Math.PI * R * R * 10, 1e-3), `${volume(plain.body)} ${plain.errors}`);
  const blind = await build([...base, hole({ through: false, depth: 4 })], "E");
  check("a hole to a depth", !blind.err && near(volume(blind.body), 9000 - Math.PI * R * R * 4, 1e-3), volume(blind.body));
  const bore = await build([...base, hole({ head: "counterbore" })], "E");
  check("with a counterbore", !bore.err && near(volume(bore.body), 9000 - Math.PI * R * R * 10 - Math.PI * (25 - R * R) * 5.4, 1e-3), volume(bore.body));
  const sink = await build([...base, hole({ head: "countersink", headDiameter: 10.6 })], "E");
  check("with a countersink", !sink.err && volume(sink.body) < volume(plain.body) && sink.r.bodies[0].faces.some((f: any) => f.type === "CONE"), `${volume(sink.body)} ${sink.errors}`);
  // The table on the page is the app's own.
  const { SCREW_SIZES } = await import("../src/doc/holeSizes");
  const rows = [...page.matchAll(/^\| (M[\d.]+) \| ([\d.]+) \| ([\d.]+) x ([\d.]+) \| ([\d.]+) \|$/gm)].map((m) => ({ name: m[1], clearance: +m[2], bore: +m[3], boreDepth: +m[4], sink: +m[5] }));
  check("the screw table on the page is the app's own, row for row", rows.length === SCREW_SIZES.length && rows.every((r, i) => { const s = SCREW_SIZES[i]; return s.name === r.name && s.clearance === r.clearance && s.bore === r.bore && s.boreDepth === r.boreDepth && s.sink === r.sink; }), rows.length);
}
{
  // Combine, with a gap; move, mirror, patterns and the ids of copies.
  const two = [sk("s", [{ id: "x", kind: "rect", center: [0, 0], w: 20, h: 20, rotation: 0 }]), ex("a", "s", ["x"], 10), sk("s2", [{ id: "c", kind: "circle", center: [0, 0], radius: 4 }], { ...plane, origin: [0, 0, 2] }), ex("b", "s2", ["c"], 20)];
  const sub = await build([...two, { id: "B", name: "B", type: "boolean", op: "subtract", target: "a", tools: ["b"] }], "a");
  check("subtract: the tool cut out, the result keeps the target's id", !sub.err && sub.r.bodies.length === 1 && sub.r.bodies[0].id === "a" && near(volume(sub.body), 4000 - Math.PI * 16 * 8, 0.3), `${sub.r.bodies.map((b: any) => b.id)} ${volume(sub.body)} ${sub.errors}`);
  const gap = await build([...two, { id: "B", name: "B", type: "boolean", op: "subtract", target: "a", tools: ["b"], clearance: 0.5 }], "a");
  check("subtract with a clearance: a wider cut", !gap.err && volume(gap.body) < volume(sub.body) - 50, `${volume(gap.body)} / ${volume(sub.body)} ${gap.errors}`);
  const uni = await build([...two, { id: "B", name: "B", type: "boolean", op: "union", target: "a", tools: ["b"] }], "a");
  check("union: one body", !uni.err && uni.r.bodies.length === 1 && near(volume(uni.body), 4000 + Math.PI * 16 * 12, 0.3), `${volume(uni.body)} ${uni.errors}`);
  const one = two.slice(0, 2);
  const mv = await build([...one, { id: "M", name: "M", type: "transform", bodies: ["a"], copy: false, op: { kind: "move", translate: [15, 0, 0] } }], "a");
  check("move: the body is there", !mv.err && mv.r.bodies.length === 1 && near(health(mv.body!).box[0][0], 5), health(mv.body!).box);
  const cp: any = await regenerate([...one, { id: "M", name: "M", type: "transform", bodies: ["a"], copy: true, op: { kind: "move", translate: [30, 0, 0] } }] as unknown as Feature[]);
  check("a moved copy: the original stays, the copy is 'M:a:0'", !cp.errors.length && JSON.stringify(cp.bodies.map((b: any) => b.id).sort()) === JSON.stringify(["M:a:0", "a"]), cp.bodies.map((b: any) => b.id));
  const mir: any = await regenerate([...one, { id: "M", name: "M", type: "transform", bodies: ["a"], copy: true, op: { kind: "mirror", plane: { origin: [20, 0, 0], xDir: [0, 1, 0], normal: [1, 0, 0] } } }] as unknown as Feature[]);
  check("a mirrored copy: two bodies", !mir.errors.length && mir.bodies.length === 2, mir.bodies.map((b: any) => b.id));
  const lin: any = await regenerate([...one, { id: "M", name: "M", type: "transform", bodies: ["a"], copy: true, op: { kind: "linear", dir: [1, 0, 0], spacing: 30, count: 4 } }] as unknown as Feature[]);
  check("a row of 4: the original and 'M:a:0' to 'M:a:2'", !lin.errors.length && JSON.stringify(lin.bodies.map((b: any) => b.id).sort()) === JSON.stringify(["M:a:0", "M:a:1", "M:a:2", "a"]), lin.bodies.map((b: any) => b.id));
  const cir: any = await regenerate([{ ...(one[0] as object), entities: [{ id: "x", kind: "rect", center: [30, 0], w: 6, h: 6, rotation: 0 }] }, one[1], { id: "M", name: "M", type: "transform", bodies: ["a"], copy: true, op: { kind: "circular", axis: { origin: [0, 0, 0], dir: [0, 0, 1] }, count: 6, angle: 360 } }] as unknown as Feature[]);
  check("six round a centre: six bodies", !cir.errors.length && cir.bodies.length === 6, cir.bodies.map((b: any) => b.id));
}
{
  // A step that cannot be built says why, in words.
  const base = [sk("s", [{ id: "x", kind: "rect", center: [0, 0], w: 20, h: 20, rotation: 0 }]), ex("E", "s", ["x"], 5)];
  const bad: any = await regenerate([...base, { id: "H", name: "H", type: "hole", face: { body: "E", center: [0, 0, 5], normal: [0, 0, 1], area: 400 }, at: [200, 0, 5], size: "M4", diameter: 4.5, through: true, depth: 5, head: "none", headDiameter: 8, headDepth: 4.4 }] as unknown as Feature[]);
  check("a hole off the face: that step says so in a sentence, the body stays", bad.errors.length === 1 && bad.errors[0].featureId === "H" && /off the body/.test(bad.errors[0].message) && bad.bodies.length === 1, bad.errors);
}

// ---------------------------------------------------------------- the short page, and steps written short
{
  // The start page (public/llms.txt) is what an assistant in the tab reads first, and pays for: it stays short.
  const start = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
  check("the start page is short: under 6000 characters", start.length < 6000, start.length);
  check("the start page names the full reference, and the commands", /llms-full\.txt/.test(start) && ["sg.make", "sg.add", "sg.change", "sg.remove", "sg.vars", "sg.check", "sg.ref.faces", "sg.ref.edges", "sg.guide"].every((w) => start.includes(w)), "");
  const { fullStep } = await import("../src/assist");
  // Its "A whole part in one call", as sg would run it: the steps written short, the edges and face it asks sg.ref for.
  const full = (steps: Record<string, unknown>[]) => parseProject(JSON.stringify({ format: "super", version: 2, name: "x", features: steps.map((s, i) => ({ id: `x${i}`, name: `x${i}`, ...fullStep(s) })) })).features as Feature[];
  const base = [
    { id: "s", type: "sketch", plane: "XY", entities: [{ id: "r", kind: "rect", center: [0, 0], w: 60, h: 40 }] },
    { id: "plate", type: "extrude", source: { sketch: "s", regions: ["r"] }, distance: 6 },
  ];
  const r0: any = await regenerate(full(base));
  const ups = r0.bodies[0].edges.filter((e: any) => e.type === "LINE" && Math.abs(e.end[2] - e.start[2]) > 5).map((e: any) => ({ body: "plate", mid: e.mid, dir: [0, 0, 1], length: e.length }));
  const top = { body: "plate", center: [0, 0, 6], normal: [0, 0, 1], area: 2400 };
  const all = full([...base, { type: "fillet", radius: 5, edges: ups }, ...[[22, 12], [-22, 12], [22, -12], [-22, -12]].map(([x, y]) => ({ type: "hole", face: top, at: [x, y, 6], size: "M4" }))]);
  const a = await after(all, "plate");
  check("the start page's plate, written short: the plate of the full page's example", !a.err && near(volume(a.body), (2400 - (4 - Math.PI) * 25) * 6 - 4 * Math.PI * 2.25 ** 2 * 6, 1e-3), `${volume(a.body)} ${a.errors}`);
  // The short ways, one by one.
  const up = fullStep({ type: "sketch", plane: "XY@10", entities: [] }).plane as any;
  check('plane "XY@10": the ground, 10 up', up.origin[2] === 10 && up.normal[2] === 1, up);
  const xz = fullStep({ type: "sketch", plane: "xz", entities: [] }).plane as any;
  check('plane "XZ": upright, its normal -Y', xz.normal[1] === -1 && xz.xDir[0] === 1, xz);
  let said = "";
  try { fullStep({ type: "sketch", plane: "top", entities: [] }); } catch (e) { said = (e as Error).message; }
  check("a plane it does not know: says which there are", /"XY", "XZ", "YZ"/.test(said), said);
  const ring = await after(full([{ id: "s", type: "sketch", plane: "XY", entities: [{ id: "r", kind: "rect", center: [0, 0], w: 60, h: 40 }, { id: "c", kind: "circle", center: [0, 0], radius: 5 }] }, { id: "E", type: "extrude", source: { sketch: "s", regions: [["r", "c"]] }, distance: 6 }]), "E");
  check("a shape with a hole drawn in it, named by both curves (in any order)", !ring.err && near(volume(ring.body), (2400 - Math.PI * 25) * 6, 1e-3), `${volume(ring.body)} ${ring.errors}`);
  const sink = fullStep({ type: "hole", face: top, size: "M5", head: "countersink" }) as any;
  check("a hole by its screw and head alone: the table's sizes, right through, in the middle of the face", sink.diameter === 5.5 && sink.headDiameter === 10.6 && sink.through === true && JSON.stringify(sink.at) === "[0,0,6]", sink);
  const blind = fullStep({ type: "hole", face: top, at: [1, 2, 6], diameter: 6, depth: 3 }) as any;
  check("a hole by a diameter and a depth: that deep, not through", blind.diameter === 6 && blind.through === false && blind.depth === 3 && blind.head === "none", blind);
  const b = await after(full([...base, blind]), "plate");
  check("... and it builds", !b.err && near(volume(b.body), 14400 - Math.PI * 9 * 3, 1e-3), `${volume(b.body)} ${b.errors}`);
  said = "";
  try { fullStep({ type: "hole", face: top, size: "M7" }); } catch (e) { said = (e as Error).message; }
  check("a screw size there is not: says which there are", /M2, M2\.5, M3/.test(said), said);
}

// ---------------------------------------------------------------- the course for teaching the app
{
  // public/llms-teach.txt: read a lesson at a time by an assistant that guides while the person taps. Every word
  // it prints in bold as "on the screen" must be a word the app has - a tool renamed must be renamed here too.
  const { readdirSync, statSync } = await import("node:fs");
  const teach = readFileSync(new URL("../public/llms-teach.txt", import.meta.url), "utf8");
  const parts = teach.split(/\n(?=## Lesson \d+)/);
  const lessons = parts.slice(1);
  check("the course: an opening and eight lessons, numbered in order", lessons.length === 8 && lessons.every((l, i) => l.startsWith(`## Lesson ${i + 1}:`)), lessons.map((l) => l.split("\n")[0]));
  check("the opening is short enough to read at the start of a chat (under 5500 characters)", parts[0].length < 5500, parts[0].length);
  check("each lesson is short (under 2200 characters) and says what to check", lessons.every((l) => l.length < 2200 && /\nCheck/.test(l)), lessons.map((l) => l.length));
  check("the opening lists each lesson, and says how to look without a screenshot", lessons.every((_, i) => new RegExp(`\\n${i + 1}\\. `).test(parts[0])) && parts[0].includes("sg.now()") && parts[0].includes("sg.teach("), "");
  // The app's own words: everything in its source and its page.
  let words = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const walk = (dir: URL) => {
    for (const n of readdirSync(dir)) {
      const u = new URL(n + (statSync(new URL(n, dir)).isDirectory() ? "/" : ""), dir);
      if (u.pathname.endsWith("/")) walk(u);
      else if (n.endsWith(".ts")) words += readFileSync(u, "utf8");
    }
  };
  walk(new URL("../src/", import.meta.url));
  const shown = teach.slice(teach.indexOf("## How the app works"));
  const bold = [...new Set([...shown.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]))];
  // (Not words of the app: the course's own headings, and a step's name as History shows it - "Extrude 01".)
  const own = (w: string) => /[.:]$/.test(w) || /^(New to CAD|Has used|Wants one|Has a part)/.test(w) || /^[A-Z][a-z]+ \d\d$/.test(w);
  const missing = bold.filter((w) => !own(w) && ![`"${w}"`, `>${w}<`, `'${w}'`, `\`${w}\``, `"${w} `, `>${w} `, `"${w}…`].some((x) => words.includes(x)));
  check(`every word the course shows as on the screen is a word of the app (${bold.length} of them)`, bold.length > 40 && !missing.length, missing);
  // The start page sends an assistant here, and stays short itself.
  const start = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
  // The page's own text is what an assistant in the tab reads first: it must send a request to be taught to the
  // course (asked "teach me the lessons", an assistant that had read only of making models found the bolt tutorial).
  const pageText = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  check("the page's own text tells an assistant about teaching: sg.teach(), and that More > Tutorial is another thing", /learn or be\s+taught/.test(pageText) && pageText.includes("await sg.teach()") && /More &gt; Tutorial/.test(pageText), "");
  check("the start page says: to teach, sg.teach() - and is still short", start.includes("sg.teach()") && start.includes("offerLessons") && start.length < 6000, start.length);
}

done();
