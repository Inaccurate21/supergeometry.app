// What an AI assistant working in the tab builds with (on the `sg` handle): one call per change, a short answer back.
//
// An assistant pays for every call (the whole conversation is sent again each time) and for every character it reads.
// So: `sg.make` / `sg.add` / `sg.change` / `sg.remove` / `sg.vars` each change the model, wait for it to be built and
// answer in a few lines - what failed, each body's size and volume - so there is nothing to look at afterwards.
// Changes go into the open project one undo step at a time (Ctrl + Z steps back through them); only `sg.make`
// starts a project. `sg.ref` gives faces and edges as the references a step takes, a few asked for by a word, not the
// whole list. `sg.guide` gives one part of the reference (public/llms-full.txt), not all of it.
import type { App } from "./app";
import type { Feature, ProjectDoc } from "./doc/types";
import { parseProject } from "./doc/store";
import { newProjectId } from "./doc/library";
import { headFor, holeFor, screwSize } from "./doc/holeSizes";

type V3 = [number, number, number];
type Loose = Record<string, unknown>;
interface Insides {
  switchProject(doc: ProjectDoc, id: string): Promise<void>;
}

const PLANES: Record<string, { origin: V3; xDir: V3; normal: V3 }> = {
  XY: { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, 0, 1] },
  XZ: { origin: [0, 0, 0], xDir: [1, 0, 0], normal: [0, -1, 0] },
  YZ: { origin: [0, 0, 0], xDir: [0, 1, 0], normal: [1, 0, 0] },
};
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const r3 = (x: number) => Math.round(x * 1e3) / 1e3;
const v4 = (v: number[]) => v.map(r4) as V3;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A step as an assistant may write it, made the step the app stores. The short ways:
 *   plane: "XY" | "XZ" | "YZ", or "XY@10" (that plane, 10 along its normal)
 *   a shape in `source.regions` named by its curves alone: "r" or ["a", "l"]
 *   a rect without `rotation`, a polygon without `angle`: 0; an extrude without `mode`: "new"
 *   a hole by its screw alone ({ face, at, size: "M4", head? }) or its diameter: the other sizes from the table;
 *   without `at`: the middle of the face
 */
export function fullStep(step: Loose): Loose {
  const s: Loose = { ...step };
  if (typeof s.plane === "string") {
    const [name, at] = s.plane.split("@");
    const p = PLANES[name.trim().toUpperCase()];
    if (!p) throw new Error(`No plane "${s.plane}": use "XY", "XZ", "YZ" (or "XY@10"), or { origin, xDir, normal }.`);
    const d = Number(at ?? 0) || 0;
    s.plane = { ...p, origin: p.normal.map((n) => n * d) };
  }
  const src = s.source as Loose | undefined;
  if (src && Array.isArray(src.regions)) {
    s.source = {
      kind: "profile",
      ...src,
      regions: src.regions.map((r) => (typeof r === "string" ? { c: [0, 0], a: 0, k: [r] } : Array.isArray(r) ? { c: [0, 0], a: 0, k: [...(r as string[])].sort() } : r)),
    };
  }
  if (s.type === "sketch" && Array.isArray(s.entities))
    s.entities = (s.entities as Loose[]).map((e) => (e.kind === "rect" && e.rotation === undefined ? { ...e, rotation: 0 } : e.kind === "polygon" && e.angle === undefined ? { ...e, angle: 0 } : e));
  if (s.type === "extrude" && s.mode === undefined) s.mode = "new";
  if (s.type === "hole") {
    const head = (s.head as "none" | "counterbore" | "countersink" | undefined) ?? "none";
    const screw = screwSize(s.size as string | undefined);
    if (s.size !== undefined && !screw) throw new Error(`No screw size "${s.size}": M2, M2.5, M3, M4, M5, M6, M8, M10, M12 (or give "diameter").`);
    const sizes = screw ? holeFor(screw, head) : typeof s.diameter === "number" ? { diameter: s.diameter, ...headFor(s.diameter, head) } : null;
    if (!sizes) throw new Error(`A hole needs "size" (like "M4") or "diameter".`);
    const face = s.face as { center?: number[] } | undefined;
    const through = s.through ?? s.depth === undefined;
    Object.assign(s, { head, through, depth: s.depth ?? 10, ...sizes, ...(s.diameter !== undefined ? { diameter: s.diameter } : {}), ...(s.headDiameter !== undefined ? { headDiameter: s.headDiameter } : {}), ...(s.headDepth !== undefined ? { headDepth: s.headDepth } : {}), at: s.at ?? face?.center });
  }
  return s;
}

/** A value set at a path ("entities.0.w") in a step. */
function setAt(obj: Loose, path: string, value: unknown): void {
  const keys = path.split(".");
  let o = obj as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== "object") throw new Error(`Nothing at "${path}" in that step.`);
    o = o[k] as Record<string, unknown>;
  }
  o[keys[keys.length - 1]] = value;
}

export function assistMethods(app: App, idle: () => Promise<boolean>) {
  const inside = app as unknown as Insides;
  const features = () => app.store.doc.features;
  const stepOf = (key: string): Feature => {
    const f = features().find((x) => x.id === key) ?? features().find((x) => same(x.name, key));
    if (!f) throw new Error(`No step "${key}". Steps: ${features().map((x) => `${x.id} (${x.name})`).join(", ") || "none"}.`);
    return f;
  };
  const bodyOf = (key: string) => {
    const names = app.store.doc.names ?? {};
    const list = app.view.bodyList;
    const b = list.find((x) => x.id === key) ?? list.find((x) => same(names[x.id] ?? x.name, key));
    if (!b) throw new Error(`No body "${key}". Bodies: ${list.map((x) => x.id).join(", ") || "none"}.`);
    return b;
  };
  /** Steps as written, made whole: ids and names given where missing, the app's defaults filled in. */
  const whole = (steps: Loose[], among: Feature[]): Feature[] => {
    const taken = [...among];
    const full = steps.map((raw) => {
      const s = fullStep(raw);
      if (typeof s.type !== "string") throw new Error(`A step needs a "type": ${JSON.stringify(raw).slice(0, 80)}`);
      const label = s.type[0].toUpperCase() + s.type.slice(1);
      let n = taken.filter((f) => f.type === s.type).length + 1;
      const id = typeof s.id === "string" && s.id ? s.id : `${s.type}${n}`;
      if (taken.some((f) => f.id === id)) throw new Error(`There is already a step with the id "${id}". Use sg.change("${id}", {...}) to change it, or another id.`);
      while (taken.some((f) => f.name === `${label} ${String(n).padStart(2, "0")}`)) n++;
      const f = { ...s, id, name: typeof s.name === "string" && s.name ? s.name : `${label} ${String(n).padStart(2, "0")}` } as unknown as Feature;
      taken.push(f);
      return f;
    });
    return parseProject(JSON.stringify({ format: "super", version: 2, name: "x", features: full })).features as Feature[];
  };

  /** The model as it stands, in a few lines: what failed, and each body measured. */
  const report = async () => {
    await idle();
    const r = app.result;
    const byId = new Map(features().map((f) => [f.id, f.name]));
    const errors = [...app.store.problems, ...(r?.errors ?? []).map((e) => `${e.featureId} (${byId.get(e.featureId) ?? "?"}): ${e.message}`)];
    let bodies: unknown[] = [];
    try {
      bodies = (await app.kernel.health(features())).map((b) => {
        const box = b.box as [V3, V3] | undefined;
        return {
          id: b.id,
          ...(box ? { size: [0, 1, 2].map((i) => r3(box[1][i] - box[0][i])), from: box[0].map(r3) } : {}),
          volume: r3(b.volume),
          ...(b.healthy ? {} : { broken: true }),
        };
      });
    } catch {
      bodies = app.view.bodyList.map((b) => ({ id: b.id }));
    }
    return { ok: errors.length === 0, steps: features().length, ...(errors.length ? { errors } : {}), bodies };
  };

  const closeWindows = () => document.querySelectorAll<HTMLElement>(".dialog-back .library-close").forEach((b) => b.click());

  return {
    /**
     * Start a model: these steps (or a whole project) as a new project - in the open one if it is still empty.
     * Answers with what was built. For a change to the model that is open, use add / change / remove instead.
     */
    async make(steps: Loose[] | Loose, name?: string) {
      closeWindows();
      app.setTool(null);
      const given = Array.isArray(steps) ? { features: steps } : steps;
      const list = whole((given.features as Loose[]) ?? [], []);
      const doc = parseProject(JSON.stringify({ format: "super", version: 2, ...given, name: name ?? (given.name as string) ?? "Untitled", features: list }));
      if (!features().length) {
        app.store.commit((d) => {
          d.features = doc.features;
          d.variables = doc.variables;
          if (name ?? given.name) d.name = doc.name;
        });
      } else await inside.switchProject(doc, newProjectId());
      return report();
    },

    /** Add steps at the end of the open project (one undo step). Answers with what the model is now. */
    async add(...steps: (Loose | Loose[])[]) {
      app.setTool(null);
      const list = whole(steps.flat() as Loose[], features());
      app.store.commit((d) => void d.features.push(...list));
      return report();
    },

    /**
     * Change a step (by id or name): the values given replace its own. A key with dots reaches inside:
     * sg.change("s1", { "entities.0.w": 80 }). A value that followed a formula follows it no more.
     */
    async change(key: string, patch: Loose) {
      app.setTool(null);
      const id = stepOf(key).id;
      app.store.commit((d) => {
        const f = d.features.find((x) => x.id === id) as unknown as Loose;
        const full = fullStep({ ...patch, type: f.type });
        for (const [k, v] of Object.entries(full)) {
          if (k === "type" || k === "id") continue;
          setAt(f, k, v);
          const ex = f.exprs as Record<string, string> | undefined;
          if (ex && k !== "exprs") for (const p of Object.keys(ex)) if (p === k || p.startsWith(k + ".")) delete ex[p];
        }
      });
      return report();
    },

    /** Delete steps (by id or name). */
    async remove(...keys: string[]) {
      app.setTool(null);
      const ids = new Set(keys.map((k) => stepOf(k).id));
      app.store.commit((d) => void (d.features = d.features.filter((f) => !ids.has(f.id))));
      return report();
    },

    /** Set variables: sg.vars({ t: 6, w: "t * 10" }). A new name is added; null deletes one. */
    async vars(values: Record<string, number | string | null>) {
      app.store.commit((d) => {
        const list = [...(d.variables ?? [])];
        for (const [name, v] of Object.entries(values)) {
          const i = list.findIndex((x) => x.name === name);
          if (v === null) i >= 0 && list.splice(i, 1);
          else if (i >= 0) list[i] = { ...list[i], expr: String(v) };
          else list.push({ name, expr: String(v) });
        }
        d.variables = list;
      });
      return report();
    },

    /** The model as it stands: errors, and each body's size, lowest corner and volume. */
    check: report,

    /**
     * Faces and edges as the references a step takes, picked by words (all must hold):
     *   faces: top bottom left right front back (the way it faces), flat, round, hole, largest, smallest
     *   edges: top bottom left right front back (where it lies on the body), vertical, straight, round, longest, shortest
     * sg.ref.faces("plate", "top")   sg.ref.edges("plate", "vertical")   sg.ref.edges("knob", "round top")
     */
    ref: {
      faces(body: string, where = "") {
        const b = bodyOf(body);
        const want = where.toLowerCase().split(/[\s,]+/).filter(Boolean);
        const dirs: Record<string, V3> = { top: [0, 0, 1], bottom: [0, 0, -1], right: [1, 0, 0], left: [-1, 0, 0], back: [0, 1, 0], front: [0, -1, 0] };
        let list = b.faces.filter((f) =>
          want.every((w) => {
            if (dirs[w]) return f.type === "PLANE" && f.normal[0] * dirs[w][0] + f.normal[1] * dirs[w][1] + f.normal[2] * dirs[w][2] > 0.999;
            if (w === "flat") return f.type === "PLANE";
            if (w === "round") return f.type !== "PLANE";
            if (w === "hole") return !!(f.round as { hole?: boolean } | undefined)?.hole;
            if (w === "largest" || w === "smallest") return true;
            throw new Error(`"${w}" is not a word for faces: top bottom left right front back flat round hole largest smallest.`);
          }),
        );
        if (want.includes("largest")) list = [...list].sort((x, y) => y.area - x.area).slice(0, 1);
        if (want.includes("smallest")) list = [...list].sort((x, y) => x.area - y.area).slice(0, 1);
        return list.slice(0, 60).map((f) => ({ body: b.id, center: v4(f.center), normal: v4(f.normal), area: r4(f.area) }));
      },
      edges(body: string, where = "") {
        const b = bodyOf(body);
        const want = where.toLowerCase().split(/[\s,]+/).filter(Boolean);
        const pts = b.edges.flatMap((e) => [e.start, e.end, e.mid]);
        const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
        const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
        const tol = Math.max(1e-6, Math.max(...hi.map((h, i) => h - lo[i])) * 1e-5);
        const side: Record<string, [number, boolean]> = { top: [2, true], bottom: [2, false], right: [0, true], left: [0, false], back: [1, true], front: [1, false] };
        const dirOf = (e: (typeof b.edges)[number]): V3 => {
          const d = [e.end[0] - e.start[0], e.end[1] - e.start[1], e.end[2] - e.start[2]];
          const l = Math.hypot(d[0], d[1], d[2]);
          if (l > 1e-9) return [d[0] / l, d[1] / l, d[2] / l];
          // A closed edge (a whole circle): along it at its start, as near as the middle tells.
          const m = [e.mid[0] - e.start[0], e.mid[1] - e.start[1], e.mid[2] - e.start[2]];
          const flat = Math.abs(m[2]) < tol ? [-m[1], m[0], 0] : Math.abs(m[1]) < tol ? [-m[2], 0, m[0]] : [0, -m[2], m[1]];
          const fl = Math.hypot(flat[0], flat[1], flat[2]) || 1;
          return [flat[0] / fl, flat[1] / fl, flat[2] / fl];
        };
        let list = b.edges.filter((e) =>
          want.every((w) => {
            if (side[w]) {
              const [i, up] = side[w];
              const at = up ? hi[i] : lo[i];
              return [e.start, e.mid, e.end].every((p) => Math.abs(p[i] - at) < tol);
            }
            if (w === "straight") return e.type === "LINE";
            if (w === "round") return e.type === "CIRCLE";
            if (w === "vertical") return e.type === "LINE" && Math.abs(dirOf(e)[2]) > 0.999;
            if (w === "longest" || w === "shortest") return true;
            throw new Error(`"${w}" is not a word for edges: top bottom left right front back vertical straight round longest shortest.`);
          }),
        );
        if (want.includes("longest")) list = [...list].sort((x, y) => y.length - x.length).slice(0, 1);
        if (want.includes("shortest")) list = [...list].sort((x, y) => x.length - y.length).slice(0, 1);
        return list.slice(0, 60).map((e) => ({ body: b.id, mid: v4(e.mid), dir: v4(dirOf(e)), length: r4(e.length) }));
      },
    },

    /**
     * What the person has just done, in a line or two - for teaching, where the person does the tapping and the
     * assistant only looks: the tool that is open, the sketch being drawn in (its shapes and their sizes), what is
     * picked, how many steps there are and what the last one is, each body's size, what the app is saying.
     * Read off what is on screen: nothing is built or measured for it, so it costs next to nothing to ask.
     */
    now() {
      const fs = features();
      const names = app.store.doc.names ?? {};
      const tool = app as unknown as { tool: { id: string; editingId?: string; activeSketch?: string; sketchId?: string; entities?: Feature[] } };
      const ui = app.ui as unknown as { hintText: string | null; panelSpec: { title: string } | null };
      const n = (x: number) => r3(x);
      const about = (f: Feature): string => {
        const g = f as unknown as Loose;
        switch (f.type) {
          case "sketch": {
            const kinds = new Map<string, number>();
            for (const e of f.entities) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
            const pl = f.plane.normal;
            const on = Math.abs(pl[2]) > 0.999 ? "flat" : Math.abs(pl[1]) > 0.999 ? "front (XZ)" : Math.abs(pl[0]) > 0.999 ? "side (YZ)" : "tilted";
            return `sketch, ${on}${Math.abs(f.plane.origin[2]) > 1e-9 && on === "flat" ? ` at height ${n(f.plane.origin[2])}` : ""}: ${[...kinds].map(([k, c]) => `${c} ${k}`).join(", ") || "empty"}`;
          }
          case "extrude":
            return `extrude ${n(g.distance as number)}${g.mode && g.mode !== "new" && g.mode !== "auto" ? ` (${g.mode})` : ""}${g.symmetric ? ", both ways" : ""}`;
          case "revolve":
            return `revolve ${n((g.angle as number) ?? 360)} degrees`;
          case "fillet":
          case "chamfer":
            return `${f.type} ${n(g.radius as number)} on ${(g.edges as unknown[] | undefined)?.length ?? 0} edge(s)`;
          case "shell":
            return `shell, walls ${n(g.thickness as number)}, ${(g.faces as unknown[] | undefined)?.length ?? 0} face(s) open`;
          case "hole":
            return `hole ${g.size ?? n(g.diameter as number)}${g.head && g.head !== "none" ? `, ${g.head}` : ""}${g.through ? ", through" : `, ${n(g.depth as number)} deep`} at ${(g.at as number[]).map(n).join(", ")}${g.centered ? " (middle of the face)" : ""}`;
          case "boolean":
            return `${g.op} of ${g.target} with ${(g.tools as string[]).join(", ")}`;
          case "transform": {
            const op = g.op as Loose;
            return `${op.kind}${g.copy ? " (copy)" : ""}${op.count ? `, ${op.count} in all` : ""}`;
          }
          default:
            return f.type;
        }
      };
      const open = tool.tool.editingId ?? tool.tool.activeSketch ?? tool.tool.sketchId ?? null;
      const sk = open ? fs.find((f) => f.id === open) : undefined;
      // (A sketch being drawn is the sketch tool's own until it is left: its shapes are read off the tool.)
      const sketching = tool.tool.id === "sketch";
      const shapes = sketching && Array.isArray(tool.tool.entities) ? (tool.tool.entities as unknown[]) : sk?.type === "sketch" ? (sk.entities as unknown[]) : null;
      const drawn =
        shapes
          ? shapes.slice(-8).map((e) => {
              const x = e as unknown as Loose & { kind: string };
              const v = (q: unknown) => (q as number[]).map(n).join(", ");
              if (x.kind === "rect") return `rectangle ${n(x.w as number)} x ${n(x.h as number)} at ${v(x.center)}`;
              if (x.kind === "circle") return `circle radius ${n(x.radius as number)} at ${v(x.center)}`;
              if (x.kind === "line") return `line ${v(x.a)} to ${v(x.b)} (${n(Math.hypot((x.b as number[])[0] - (x.a as number[])[0], (x.b as number[])[1] - (x.a as number[])[1]))} long)`;
              if (x.kind === "polygon") return `polygon, ${x.sides} sides, radius ${n(x.radius as number)}`;
              if (x.kind === "arc") return `arc ${v(x.a)} to ${v(x.b)}`;
              return x.kind;
            })
          : undefined;
      const errs = (app.result?.errors ?? []).map((e) => `${fs.find((f) => f.id === e.featureId)?.name ?? e.featureId}: ${e.message}`);
      const last = fs[fs.length - 1];
      return {
        tool: tool.tool.id === "select" ? "none" : (ui.panelSpec?.title ?? tool.tool.id),
        ...(shapes ? { inSketch: sk?.name ?? "a new sketch", drawn, sizes: ((tool.tool as unknown as { constraints?: unknown[] }).constraints ?? (sk as unknown as { constraints?: unknown[] } | undefined)?.constraints ?? []).length } : {}),
        picked: app.selection.map((s) => {
          const x = s as unknown as Loose & { kind: string };
          return x.body ? `${x.kind === "body" ? "body" : `a ${x.kind} of`} ${names[x.body as string] ?? x.body}`.replace("body ", "body ") : x.kind === "profile" ? "a sketch shape" : x.kind;
        }),
        steps: fs.length,
        ...(last ? { last: `${last.name}: ${about(last)}` } : {}),
        bodies: app.view.bodyList.map((b) => {
          const pts = b.edges.flatMap((e) => [e.start, e.end, e.mid]);
          const size = pts.length ? [0, 1, 2].map((i) => n(Math.max(...pts.map((q) => q[i])) - Math.min(...pts.map((q) => q[i])))) : [];
          return { id: b.id, size, faces: b.faces.length };
        }),
        ...(ui.hintText ? { says: ui.hintText } : {}),
        ...(errs.length ? { errors: errs } : {}),
      };
    },

    /**
     * For teaching the app: no number - how to teach, and the list of lessons; a number - that lesson
     * (public/llms-teach.txt, a lesson at a time so that only what is being taught is read).
     */
    async teach(lesson?: number): Promise<string> {
      const text = await (await fetch("./llms-teach.txt")).text();
      const parts = text.split(/\n(?=## Lesson \d+)/);
      if (lesson === undefined) return parts[0].trim();
      const hit = parts.find((p) => new RegExp(`^## Lesson ${lesson}\\b`).test(p));
      return hit ? hit.trim() : `No lesson ${lesson}. There are ${parts.length - 1}: await sg.teach() lists them.`;
    },

    /**
     * One part of the reference, by a word of its heading ("revolve", "hole", "shell", "variables", "example").
     * No word: the list of parts.
     */
    async guide(topic?: string): Promise<string> {
      const text = await (await fetch("./llms-full.txt")).text();
      const parts = text.split(/\n(?=#{2,4} |\*\*[A-Z][^*\n]*\*\*(?: \([^\n]*\))?\n)/);
      const titles = parts.map((p) => p.split("\n")[0].replace(/^#+\s*/, "").replace(/\*\*/g, ""));
      if (!topic) return `Parts: ${titles.slice(1).join(" | ")}. sg.guide("<a word of one>") gives it.`;
      const word = topic.toLowerCase();
      // The part that begins with the word, if there is one ("hole": the Hole step, not the example with holes in it).
      const first = parts.filter((_, i) => i > 0 && titles[i].toLowerCase().startsWith(word));
      const hits = first.length ? first : parts.filter((_, i) => i > 0 && titles[i].toLowerCase().includes(word));
      return hits.length ? hits.join("\n").trim() : `No part "${topic}". Parts: ${titles.slice(1).join(" | ")}.`;
    },
  };
}
