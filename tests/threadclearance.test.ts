// Run: npx tsx tests/threadclearance.test.ts
// A threaded bolt subtracted from a block with a clearance: a threaded hole a little bigger than the bolt all
// round, so the printed bolt turns in it. (It failed every time: "Couldn't keep 0.2 mm clear ...".)
import { after, bodies, block, check, cylinder, done, health, near, volume } from "./kit";
import { getOC, type Shape3D } from "replicad";
import type { Feature } from "../src/doc/types";

const oc = getOC();
const gap = (a: Shape3D, b: Shape3D) => {
  const d = new oc.BRepExtrema_DistShapeShape(a.wrapped, b.wrapped);
  try {
    return d.IsDone() ? d.Value() : -1;
  } finally {
    d.delete();
  }
};
// A block 30 x 30 x 12 and an M10 bolt shank (r 5, 24 long) standing through its middle.
const blockF = block("blk", 30, 30, 12);
const bolt = cylinder("bolt", 5, 24, 15, 15, -6);
const first = await after([...blockF, ...bolt]);
const side = first.r.bodies.find((b) => b.id === "bolt")!.faces.find((f) => f.type === "CYLINDRE")!;
const thread: Feature = { id: "thr", name: "Thread", type: "thread", face: { body: "bolt", center: side.center, normal: side.normal, area: side.area }, pitch: 1.5 } as Feature;
const cut = (extra: object): Feature => ({ id: "cut", name: "Subtract", type: "boolean", op: "subtract", target: "blk", tools: ["bolt"], keepTools: true, ...extra }) as Feature;
const B = (id: string) => bodies().get(id) as Shape3D;

let r = await after([...blockF, ...bolt, thread]);
const vBolt = volume(B("bolt"));
check("the bolt is threaded", !r.errors.length && health(B("bolt")).healthy && vBolt < Math.PI * 25 * 24, `${vBolt.toFixed(1)} ${r.errors.join("; ")}`);

r = await after([...blockF, ...bolt, thread, cut({})]);
const vTight = volume(B("blk"));
check("no clearance: a threaded hole the bolt's own size", !r.errors.length && health(B("blk")).healthy && near(gap(B("blk"), B("bolt")), 0, 1e-3), `${r.errors.join("; ")} gap ${gap(B("blk"), B("bolt")).toFixed(4)}`);

for (const c of [0.1, 0.2, 0.4]) {
  const t0 = performance.now();
  r = await after([...blockF, ...bolt, thread, cut({ clearance: c })]);
  const ok = !r.errors.length && !!B("blk");
  const g = ok ? gap(B("blk"), B("bolt")) : -1;
  const v = ok ? volume(B("blk")) : 0;
  // The hole is the thread that much bigger all round: nowhere nearer the bolt than the clearance (its sides and
  // its crests at just that; its roots have more).
  check(`clearance ${c}: the cut is made, sound, the bolt kept`, ok && health(B("blk")).healthy && near(volume(B("bolt")), vBolt, 1e-6), `${r.errors.join("; ")} ${Math.round(performance.now() - t0)} ms`);
  check(`clearance ${c}: the hole stands ${c} off the bolt at its nearest, and is bigger than the tight one`, ok && g > c * 0.97 && g < c * 1.03 && v < vTight, `gap ${g.toFixed(4)}, block ${v.toFixed(1)} against ${vTight.toFixed(1)}`);
}
// Cut the other way: the bolt gives way to the block.
r = await after([...blockF, ...bolt, thread, cut({ clearance: 0.2, cutFrom: "tools" })]);
check("clearance taken from the bolt instead: made, or said why in plain words", !r.errors.length || /clear|smaller/i.test(r.errors.join()), r.errors.join("; "));
done();
