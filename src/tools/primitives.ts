// The window for Create → Box, Cylinder, Cone, Sphere, Torus, Coil (the steps it makes: src/doc/primitives.ts).

import type { PlaneDef, Vec3 } from "../doc/types";
import { PLANES, PRIMITIVES, primitiveSteps, SIZES, type PrimitiveKind } from "../doc/primitives";
import { el } from "../ui/ui";
import { evaluate, toDisplay, trim } from "../units";
import type { AppContext } from "./tool";

export { PRIMITIVES, type PrimitiveKind };

/** What is wrong with the sizes, in words (or null). */
function fault(kind: PrimitiveKind, s: Record<string, number>): string | null {
  for (const [k, label, , unit] of SIZES[kind]) if (!(s[k] > 0) && !(k === "top" && s[k] === 0)) return `${label}: must be more than 0${unit === "number" ? "" : " mm"}`;
  if (kind === "torus" && !(s.tube < s.dia)) return "The tube must be thinner than the ring is across";
  if (kind === "coil" && !(s.wire < s.dia)) return "The wire must be thinner than the coil is across";
  if (kind === "coil" && !(s.pitch > s.wire)) return "The pitch must be more than the wire's diameter (or the turns run into each other)";
  return null;
}

/** The window: what to make, on which plane, round which point, its sizes; then Create. */
export function openPrimitive(app: AppContext, kind: PrimitiveKind, face?: { center: Vec3; normal: Vec3; xDir: Vec3 }): void {
  const back = el("div", "dialog-back");
  const box = el("div", "dialog prim-dialog");
  const head = el("div", "library-head");
  head.append(el("div", "panel-title", PRIMITIVES.find((p) => p.kind === kind)!.label));
  const x = el("button", "icon-btn library-close", "×");
  x.title = "Close";
  head.append(x);
  const list = el("div", "prim-list");
  const row = (label: string, input: HTMLElement) => {
    const r = el("label", "prim-row");
    r.append(el("span", "", label), input);
    list.append(r);
  };
  const select = (opts: [string, string][], value: string) => {
    const s = document.createElement("select");
    s.className = "prim-select";
    for (const [v, l] of opts) s.append(new Option(l, v, v === value, v === value));
    return s;
  };
  const num = (v: number) => {
    const i = document.createElement("input");
    i.className = "prim-num";
    i.inputMode = "decimal";
    i.value = trim(v, 4);
    return i;
  };
  const planeSel = select([...(face ? ([["face", "The face picked"]] as [string, string][]) : []), ["XY", "XY (ground)"], ["XZ", "XZ (front)"], ["YZ", "YZ (side)"]], face ? "face" : "XY");
  row("Plane", planeSel);
  const cu = num(0);
  const cv = num(0);
  const ce = num(0);
  row("Centre: across", cu);
  row("Centre: up the plane", cv);
  row("Off the plane", ce);
  const sizes: [string, HTMLInputElement, "length" | "number"][] = SIZES[kind].map(([k, label, v, unit]) => {
    const i = num(unit === "length" ? toDisplay(v) : v);
    row(label, i);
    return [k, i, unit];
  });
  const modeSel = select([["new", "New body"], ["join", "Join (to what it touches)"], ["cut", "Cut (from what it runs into)"]], "new");
  row("Operation", modeSel);
  const err = el("div", "prim-err");
  const foot = el("div", "prim-foot");
  const cancel = el("button", "text-btn", "Cancel");
  const ok = el("button", "text-btn primary", "Create");
  foot.append(cancel, ok);
  box.append(head, list, err, foot);
  back.append(box);
  const close = () => back.remove();
  const make = () => {
    const len = (i: HTMLInputElement) => evaluate(i.value, "length");
    const s: Record<string, number> = {};
    for (const [k, i, unit] of sizes) {
      const v = unit === "length" ? len(i) : evaluate(i.value, "number");
      if (v === null) return void (err.textContent = `"${i.value}" isn't a valid value`);
      s[k] = v;
    }
    const why = fault(kind, s);
    if (why) return void (err.textContent = why);
    const [u, v, w] = [len(cu), len(cv), len(ce)];
    if (u === null || v === null || w === null) return void (err.textContent = "The centre isn't a valid value");
    const base: PlaneDef = planeSel.value === "face" && face ? { origin: face.center, xDir: face.xDir, normal: face.normal } : PLANES[planeSel.value];
    const steps = primitiveSteps(app, kind, base, [u, v], w, s, modeSel.value as "new" | "join" | "cut");
    app.store.commit((d) => d.features.push(...steps));
    close();
  };
  ok.addEventListener("click", make);
  cancel.addEventListener("click", close);
  x.addEventListener("click", close);
  back.addEventListener("pointerdown", (e) => e.target === back && close());
  box.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") make();
    if (e.key === "Escape") close();
  });
  document.body.append(back);
  sizes[0]?.[1].focus();
}
