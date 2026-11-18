// Run: npx tsx tests/pipetee.test.ts [out.json] - a pipe tee: a run 20 across
// and 60 long along X, a branch 20 across rising 30 from its middle, joined;
// shelled 1.5 thick open at all three ends; the three outside rims chamfered
// 0.5. Each step held to its size (the branch's overlap with the run by the
// Steinmetz solid, the chamfer by Pappus) and soundness.
import { readFileSync, writeFileSync } from "node:fs";
import { measureArea, type Face, type Shape3D } from "replicad";
import { after, bodies, block, check, circle, done, health, near, sketch, XY, YZ } from "./kit";
import { measureVolume } from "../src/kernel/ocFree";
import { AUTO_CUT_INSIDE } from "../src/kernel/engine";
import { arrangement, regionRef } from "../src/sketch/regions";
import type { EdgeRef, FaceRef, Feature, SketchEntity, Vec3 } from "../src/doc/types";

const vol = (s: Shape3D) => Math.abs(measureVolume(s));
const body = (id: string) => bodies().get(id) as Shape3D;
const profileOf = (sk: string, es: SketchEntity[]) => ({ kind: "profile" as const, sketch: sk, regions: arrangement(es).regions.map(regionRef) });
const ref = (id: string, f: Face): FaceRef => ({ body: id, center: f.center.toTuple() as Vec3, normal: f.normalAt().toTuple() as Vec3, area: measureArea(f) });
const faceOf = (id: string, pick: (c: Vec3) => boolean) => { const f = body(id).faces.find((f) => f.geomType === "PLANE" && pick(f.center.toTuple() as Vec3)); if (!f) throw new Error(`no such face on ${id}`); return ref(id, f); };
const PI = Math.PI;

const R = 10; // 20 across outside
const L = 60; // the run: 60 long, -30 to 30
const B = 30; // the branch: 30 up from the run's middle
const T = 1.5; // the wall
const C = 0.5; // the outside rims' chamfer

// A run of radius r and length L, a branch of radius r rising B from its
// axis: the branch's lower part inside the run is half a Steinmetz solid.
const tee = (r: number) => PI * r * r * L + PI * r * r * B - (8 * r ** 3) / 3;

// ---------------------------------------------------------------- the tee
const runEs = [circle("run", 0, 0, R)], brEs = [circle("br", 0, 0, R)];
const steps: Feature[] = [
  sketch("RunEnd", YZ(-L / 2), runEs),
  { id: "Run", name: "Extrude", type: "extrude", source: profileOf("RunEnd", runEs), distance: L, mode: "new" } as Feature,
  sketch("BranchFoot", XY(), brEs),
  { id: "Branch", name: "Extrude", type: "extrude", source: profileOf("BranchFoot", brEs), distance: B, mode: "join", target: "Run" } as Feature,
];
let { errors } = await after(steps);
const vTee = vol(body("Run"));
check("the tee: a run and a branch, joined", !errors.length && bodies().size === 1 && near(vTee, tee(R), 1e-6 * tee(R)), [errors, bodies().size, vTee, tee(R)]);
const [[x0, y0, z0], [x1, y1, z1]] = body("Run").boundingBox.bounds;
check("the tee: 60 long, 20 deep, from under the run to the branch's top", near(x0, -L / 2, 1e-4) && near(x1, L / 2, 1e-4) && near(y1 - y0, 2 * R, 1e-4) && near(z0, -R, 1e-4) && near(z1, B, 1e-4), body("Run").boundingBox.bounds);

// Auto, as a beginner leaves it: drawn on the floor through the run, it
// cuts (the top half of the run out, a notch) - and says so, with Add named.
{
  const auto = steps.map((f) => (f.id === "Branch" ? ({ ...f, mode: "auto", target: undefined } as Feature) : f));
  const { r, errors } = await after(auto);
  const notes = r.notes?.filter((n) => n.featureId === "Branch").map((n) => n.message) ?? [];
  check("Auto from inside the run: a notch, and a note naming Add", !errors.length && vol(body("Run")) < PI * R * R * L && notes.includes(AUTO_CUT_INSIDE), [errors, vol(body("Run")), notes]);
  // A hole drawn on the floor under a block (on its face, not inside it): cut, no note.
  const holeEs = [circle("h", 10, 10, 3)];
  const plate: Feature[] = [...block("Plate", 20, 20, 5), sketch("Hole", XY(), holeEs), { id: "Drill", name: "Extrude", type: "extrude", source: profileOf("Hole", holeEs), distance: 20, mode: "auto" } as Feature];
  const p = await after(plate);
  check("Auto from a block's underside: a hole, no note", !p.errors.length && near(vol(body("Plate")), 2000 - PI * 9 * 5, 1e-6 * 2000) && !p.r.notes?.some((n) => n.featureId === "Drill"), [p.errors, vol(body("Plate")), p.r.notes]);
  await after(steps);
}

// ---------------------------------------------------------------- the shell
// Open at the three ends: inside, the same tee 8.5 round (less a sliver
// where the inside meets round the branch's foot).
const ends = [faceOf("Run", (c) => near(c[0], -L / 2, 1e-6)), faceOf("Run", (c) => near(c[0], L / 2, 1e-6)), faceOf("Run", (c) => near(c[2], B, 1e-6))];
steps.push({ id: "Hollow", name: "Shell", type: "shell", body: "Run", faces: ends, thickness: T } as Feature);
({ errors } = await after(steps));
const vShell = vol(body("Run"));
const wall = tee(R) - tee(R - T);
check("the shell: 1.5 thick, open at all three ends", !errors.length && bodies().size === 1 && Math.abs(vShell - wall) < 0.01 * wall, [errors, vShell, wall]);
const flats = body("Run").faces.filter((f) => f.geomType === "PLANE");
const ring = PI * (R * R - (R - T) ** 2);
check("the shell: three flat rims, each a ring 1.5 wide", flats.length === 3 && flats.every((f) => near(measureArea(f), ring, 1e-4)), flats.map((f) => measureArea(f)));

// ---------------------------------------------------------------- the chamfer
// The outside circle at each end, 0.5 off: a triangle (½·c²) turned round
// the axis, its middle c/3 in from the outside.
const rims: EdgeRef[] = body("Run").edges.filter((e) => {
  const m = e.pointAt(0.5).toTuple();
  const atEnd = near(Math.abs(m[0]), L / 2, 1e-6) || near(m[2], B, 1e-6);
  const r = near(m[2], B, 1e-6) ? Math.hypot(m[0], m[1]) : Math.hypot(m[1], m[2]);
  return atEnd && near(r, R, 1e-6);
}).map((e) => ({ body: "Run", mid: e.pointAt(0.5).toTuple() as Vec3, dir: e.tangentAt(0.5).toTuple() as Vec3, length: e.length }));
steps.push({ id: "Rims", name: "Chamfer", type: "chamfer", edges: rims, radius: C } as Feature);
({ errors } = await after(steps));
const vCham = vol(body("Run"));
const cut = 3 * 2 * PI * (R - C / 3) * (C * C) / 2;
check("the chamfer: the three outside rims, 0.5", !errors.length && rims.length === 3 && near(vShell - vCham, cut, 1e-4 * cut + 1e-6), [errors, rims.length, vShell - vCham, cut]);

const h = health(body("Run"), "Run");
check("the tee: sound, one body", h.healthy && bodies().size === 1, h.healthy ? `${Math.round(h.volume)} mm³` : h);
const codeVol = vol(body("Run"));
const codeFaces = body("Run").faces.length;
const codeBox = body("Run").boundingBox.bounds;
console.log("tee", vTee.toFixed(1), "shell", vShell.toFixed(1), "wall", wall.toFixed(1), "final", codeVol.toFixed(1), "faces", codeFaces);

// ---------------------------------------------- the tee built by hand
let hand: Feature[] | undefined;
try { hand = JSON.parse(readFileSync(new URL("./fixtures/pipetee-hand.json", import.meta.url), "utf8")).features as Feature[]; } catch { /* not built yet */ }
if (hand) {
  const { errors } = await after(hand);
  check("by hand: no errors", errors.length === 0, errors);
  const B = [...bodies().values()].map((s) => s as Shape3D);
  check("by hand: one body, sound", B.length === 1 && health(B[0], "hand").healthy, B.length);
  check("by hand: the same tee (to 0.1 %)", B.length === 1 && Math.abs(vol(B[0]) - codeVol) < codeVol * 1e-3, `${B[0] ? vol(B[0]).toFixed(1) : "-"} / ${codeVol.toFixed(1)}`);
  check("by hand: as many faces, the same box", B[0]?.faces.length === codeFaces && B[0].boundingBox.bounds.flat().every((x, i) => near(x, codeBox.flat()[i], 1e-3)), [B[0]?.faces.length, codeFaces, B[0]?.boundingBox.bounds]);
}

if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ format: "super", version: 2, name: "Pipe tee", features: steps }));
done();
