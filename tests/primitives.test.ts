// Run: npx tsx tests/primitives.test.ts
// Create → Box, Cylinder, Cone, Sphere, Torus, Coil: each a sketch and its extrude or revolve, the right size.
import { primitiveSteps } from "../src/doc/primitives";
import type { PlaneDef } from "../src/doc/types";
import { after, check, done, near, volume } from "./kit";

let n = 0;
const app = { store: { newIdentity: (t: string, l?: string) => ({ id: `${t}${++n}`, name: `${l ?? t} 01` }) } } as any;
const XY: PlaneDef = { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, 0, 1] };
const XZ: PlaneDef = { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, -1, 0] };
const PI = Math.PI;

async function make(kind: any, s: Record<string, number>, plane = XY, c: [number, number] = [0, 0], elev = 0) {
  const steps = primitiveSteps(app, kind, plane, c, elev, s, "new");
  const a = await after(steps);
  return { r: a.r as any, body: a.body, errors: a.errors };
}

for (const [kind, s, want] of [
  ["box", { w: 20, d: 10, h: 5 }, 1000],
  ["cylinder", { dia: 10, h: 10 }, PI * 25 * 10],
  ["cone", { dia: 10, top: 4, h: 10 }, ((PI * 10) / 3) * (25 + 10 + 4)],
  ["sphere", { dia: 10 }, (4 / 3) * PI * 125],
  ["torus", { dia: 30, tube: 6 }, 2 * PI * PI * 15 * 9],
  ["coil", { dia: 20, wire: 2, pitch: 4, turns: 3 }, PI * 1 * 2 * PI * 10 * 3],
] as [string, Record<string, number>, number][]) {
  const m = await make(kind, s);
  check(`${kind}: one body, no errors`, !m.errors?.length && m.r.bodies?.length === 1, m.errors);
  const v = volume(m.body);
  check(`${kind}: volume ${want.toFixed(1)}`, Math.abs(v - want) / want < (kind === "coil" ? 0.03 : 1e-3), v);
}
{
  const m = await make("cylinder", { dia: 10, h: 10 }, XZ, [5, 7], 3);
  check("a cylinder on the front plane, off its centre: no errors", !m.errors?.length, m.errors);
}
done();
