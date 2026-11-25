// Create → Box, Cylinder, Cone, Sphere, Torus, Coil (as Fusion's solid primitives): each made as a sketch and the
// step that makes it solid - an extrude (a box, a cylinder, a cone - an extrude that tapers) or a revolve (a sphere,
// a torus, and a coil: a revolve that travels along its axis) - so its sizes stay in History, to change later.
// On a plane of the origin (or the flat face picked), round a centre given in it; a new body, or joined to / cut
// from what it runs into.

import type { Feature, PlaneDef, SketchEntity, Vec2, Vec3 } from "../doc/types";
import { add, cross, norm, scale } from "../geom";
import { arrangement, regionRef } from "../sketch/regions";
type Ids = { store: { newIdentity(type: Feature["type"], label?: string): { id: string; name: string } } };

export type PrimitiveKind = "box" | "cylinder" | "cone" | "sphere" | "torus" | "coil";

export const PRIMITIVES: { kind: PrimitiveKind; label: string; icon: string }[] = [
  { kind: "box", label: "Box", icon: "ffBox" },
  { kind: "cylinder", label: "Cylinder", icon: "ffCylinder" },
  { kind: "cone", label: "Cone", icon: "ffCylinder" },
  { kind: "sphere", label: "Sphere", icon: "ffSphere" },
  { kind: "torus", label: "Torus", icon: "ffTorus" },
  { kind: "coil", label: "Coil", icon: "thread" },
];

/** The sizes each asks for (mm, or a count / degrees), with the ones it starts with. */
export const SIZES: Record<PrimitiveKind, [string, string, number, "length" | "number"][]> = {
  box: [["w", "Width (X)", 20, "length"], ["d", "Depth (Y)", 20, "length"], ["h", "Height", 20, "length"]],
  cylinder: [["dia", "Diameter", 20, "length"], ["h", "Height", 20, "length"]],
  cone: [["dia", "Bottom diameter", 20, "length"], ["top", "Top diameter (0: a point)", 0, "length"], ["h", "Height", 20, "length"]],
  sphere: [["dia", "Diameter", 20, "length"]],
  torus: [["dia", "Diameter (across the ring)", 30, "length"], ["tube", "Tube diameter", 6, "length"]],
  coil: [["dia", "Diameter (across the coil)", 20, "length"], ["wire", "Wire diameter", 2, "length"], ["pitch", "Pitch (one turn)", 4, "length"], ["turns", "Turns", 5, "number"]],
};

export const PLANES: Record<string, PlaneDef> = {
  XY: { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, 0, 1] },
  XZ: { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, -1, 0] },
  YZ: { origin: [0, 0, 0], xDir: [0, 1, 0], normal: [1, 0, 0] },
};

const yOf = (p: PlaneDef): Vec3 => norm(cross(p.normal, p.xDir));
const at = (p: PlaneDef, u: number, v: number, w = 0): Vec3 => add(add(add(p.origin, scale(p.xDir, u)), scale(yOf(p), v)), scale(p.normal, w));

/** The steps that make it: a sketch and its extrude or revolve. */
export function primitiveSteps(app: Ids, kind: PrimitiveKind, base: PlaneDef, c: Vec2, elev: number, s: Record<string, number>, mode: "new" | "join" | "cut"): Feature[] {
  const sk = app.store.newIdentity("sketch");
  const id = (n: string) => `${sk.id}-${n}`;
  const name = PRIMITIVES.find((p) => p.kind === kind)!.label;
  // Extruded ones: drawn on the plane (lifted by the elevation) round the centre.
  if (kind === "box" || kind === "cylinder" || kind === "cone") {
    const plane: PlaneDef = { origin: at(base, c[0], c[1], elev), xDir: base.xDir, normal: base.normal };
    const r = (s.dia ?? 0) / 2;
    const entities: SketchEntity[] =
      kind === "box"
        ? [{ id: id("r"), kind: "rect", center: [0, 0], w: s.w, h: s.d, rotation: 0 }]
        : [{ id: id("c"), kind: "circle", center: [0, 0], radius: r }];
    const regions = arrangement(entities).regions.map(regionRef);
    const ex = app.store.newIdentity("extrude", name);
    const taper = kind === "cone" ? Math.max(1e-3, (s.top ?? 0) / (s.dia || 1)) : undefined;
    return [
      { ...sk, name: `${name} ${sk.name.split(" ").pop()}`, type: "sketch", plane, entities } as Feature,
      { ...ex, type: "extrude", source: { kind: "profile", sketch: sk.id, regions }, distance: s.h, mode: mode === "new" ? "new" : mode, ...(taper !== undefined && Math.abs(taper - 1) > 1e-9 ? { taper } : {}) } as Feature,
    ];
  }
  // Revolved ones: drawn upright through the centre (its up the plane's normal), turned round that line.
  const o = at(base, c[0], c[1], elev);
  const up = norm(base.normal);
  const plane: PlaneDef = { origin: o, xDir: base.xDir, normal: norm(cross(base.xDir, up)) };
  let entities: SketchEntity[];
  let axisLine: string;
  let angle = 360;
  let travel: number | undefined;
  if (kind === "sphere") {
    const r = s.dia / 2;
    entities = [
      { id: id("a"), kind: "arc", a: [0, -r], m: [r, 0], b: [0, r] },
      { id: id("ax"), kind: "line", a: [0, -r], b: [0, r] },
    ];
    axisLine = id("ax");
  } else {
    const R = s.dia / 2;
    const r = (kind === "coil" ? s.wire : s.tube) / 2;
    // (A coil starts sitting on the plane; a torus round its middle.)
    const v0 = kind === "coil" ? r : 0;
    entities = [
      { id: id("c"), kind: "circle", center: [R, v0], radius: r },
      { id: id("ax"), kind: "line", a: [0, -R - r], b: [0, R + r], construction: true },
    ];
    axisLine = id("ax");
    if (kind === "coil") {
      angle = 360 * Math.max(0.01, s.turns);
      travel = s.pitch * s.turns;
    }
  }
  const regions = arrangement(entities).regions.map(regionRef);
  const rv = app.store.newIdentity("revolve", name);
  return [
    { ...sk, name: `${name} ${sk.name.split(" ").pop()}`, type: "sketch", plane, entities } as Feature,
    { ...rv, type: "revolve", source: { kind: "profile", sketch: sk.id, regions }, axis: { origin: o, dir: up, ref: { kind: "sketchLine", sketch: sk.id, entity: axisLine } }, angle, ...(travel ? { travel } : {}), mode: mode === "new" ? "new" : mode } as Feature,
  ];
}

