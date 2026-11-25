// The selection filter (the funnel at the left edge): which kinds of things a tap can pick - bodies, faces (flat,
// round, cones, balls, the rest), edges, corners, centre points, a sketch's curves, points and shapes, planes. As
// Fusion's Selection Filter (asked for: "a selection filter, to pick only cones, only centres..."). It holds for
// picking with the pointer (Select) and for Measure; tools that wait for a certain pick still ask for theirs.

import { settings, type SelFilter } from "../settings";
import { el } from "../ui/ui";
import { besideButton } from "../ui/calculator";
import type { PickHit, PickOptions, Viewport } from "../view/viewport";

/** The switches, as the window lists them (a group's head, then its kinds). */
export const FILTER_ROWS: [keyof SelFilter, string, number][] = [
  ["bodies", "Bodies", 0],
  ["faces", "Faces", 0],
  ["facePlane", "Flat", 1],
  ["faceCyl", "Cylinders", 1],
  ["faceCone", "Cones", 1],
  ["faceSphere", "Spheres", 1],
  ["faceOther", "Other faces", 1],
  ["edges", "Edges", 0],
  ["vertices", "Vertices", 0],
  ["centres", "Centre points", 0],
  ["sketchCurves", "Sketch curves", 0],
  ["sketchPoints", "Sketch points", 0],
  ["profiles", "Sketch shapes (to extrude)", 0],
  ["planes", "Planes and axes", 0],
];

export const FILTER_ALL: SelFilter = Object.fromEntries(FILTER_ROWS.map(([k]) => [k, true])) as unknown as SelFilter;

const f = () => settings.value.selFilter;

/** Is anything filtered out (the funnel lit)? */
export function filtering(): boolean {
  return FILTER_ROWS.some(([k]) => !f()[k]);
}

/** May a face of this type be picked? */
function faceOk(type: string | undefined): boolean {
  const s = f();
  if (!s.faces) return false;
  const t = (type ?? "").toUpperCase();
  if (t === "PLANE") return s.facePlane;
  if (t.startsWith("CYLIND")) return s.faceCyl;
  if (t === "CONE") return s.faceCone;
  if (t === "SPHERE") return s.faceSphere;
  return s.faceOther;
}

/** The pick options with what the filter keeps out left out. */
export function filterOptions(o: PickOptions): PickOptions {
  const s = f();
  const anyFace = s.faces && (s.facePlane || s.faceCyl || s.faceCone || s.faceSphere || s.faceOther);
  return {
    ...o,
    ...(!(anyFace || s.bodies || s.edges || s.vertices) ? { bodies: false } : {}),
    ...(!s.edges ? { edges: false } : {}),
    ...(!s.vertices ? { vertices: false } : {}),
    ...(!s.sketchCurves && !s.sketchPoints && !s.centres ? { curves: false } : {}),
    ...(!s.profiles ? { profiles: false } : {}),
    ...(!s.planes ? { planes: false, axes: false } : {}),
  };
}

/**
 * What a pick gives once the filter has had its say: a face of a kind kept out is not picked (a body, if bodies
 * may be: a tap on its face picks it whole), a sketch's centre point only with Centre points on, and so on.
 */
export function filterHit(view: Viewport, h: PickHit | null): PickHit | null {
  if (!h) return h;
  const s = f();
  switch (h.kind) {
    case "face": {
      // (Kept out, but bodies let in: the caller takes the body - see wholeBodyFor.)
      return faceOk(view.body(h.body)?.faces[h.face]?.type) || s.bodies ? h : null;
    }
    case "edge":
      return s.edges ? h : null;
    case "vertex":
      return s.vertices ? h : null;
    case "curve":
      return s.sketchCurves ? h : null;
    case "point":
      return (h.p === "c" ? s.centres || s.sketchPoints : s.sketchPoints) ? h : null;
    case "profile":
      return s.profiles ? h : null;
    case "plane":
    case "axis":
      return s.planes ? h : null;
    default:
      return h;
  }
}

/** A face tapped with faces kept out but bodies let in: the body. */
export function wholeBodyFor(h: PickHit | null, view: Viewport): string | null {
  if (!h || h.kind !== "face" || !f().bodies) return null;
  return faceOk(view.body(h.body)?.faces[h.face]?.type) ? null : h.body;
}

let win: HTMLElement | null = null;

/** The filter's window by the funnel: a switch per kind, All and None. */
export function toggleFilterWindow(onChange: () => void): void {
  if (win) {
    win.remove();
    win = null;
    return onChange();
  }
  const w = el("div", "sel-filter");
  const head = el("div", "sel-filter-head");
  head.append(el("span", "", "Selection filter"));
  const all = el("button", "sel-filter-btn", "All");
  const none = el("button", "sel-filter-btn", "None");
  const x = el("button", "sel-filter-btn", "×");
  x.title = "Close";
  head.append(all, none, x);
  w.append(head);
  const boxes: [keyof SelFilter, HTMLInputElement][] = [];
  for (const [k, label, indent] of FILTER_ROWS) {
    const row = el("label", `sel-filter-row${indent ? " sub" : ""}`);
    const b = document.createElement("input");
    b.type = "checkbox";
    b.checked = f()[k];
    b.addEventListener("change", () => (settings.set("selFilter", { ...f(), [k]: b.checked }), onChange()));
    row.append(b, ` ${label}`);
    w.append(row);
    boxes.push([k, b]);
  }
  const setAll = (on: boolean) => {
    settings.set("selFilter", Object.fromEntries(FILTER_ROWS.map(([k]) => [k, on])) as unknown as SelFilter);
    for (const [, b] of boxes) b.checked = on;
    onChange();
  };
  all.addEventListener("click", () => setAll(true));
  none.addEventListener("click", () => setAll(false));
  x.addEventListener("click", () => toggleFilterWindow(onChange));
  document.body.append(w);
  besideButton(w, "selFilter");
  win = w;
  onChange();
}

export function filterWindowOpen(): boolean {
  return !!win;
}
