// The selection filter (the funnel at the left edge): which kinds of things a tap can pick - bodies, faces (flat,
// round, cones, balls, the rest), edges, corners, centre points, a sketch's curves, points and shapes, planes. As
// Fusion's Selection Filter (asked for: "a selection filter, to pick only cones, only centres..."). It holds for
// picking with the pointer (Select) and for Measure; tools that wait for a certain pick still ask for theirs.

import { settings, type SelFilter } from "../settings";
import { el } from "../ui/ui";
import { tr } from "../i18n";
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
/** A filter kept under a name (the window's Profiles): picked again in one tap. */
export interface FilterProfile {
  name: string;
  filter: SelFilter;
}

/** Profiles the app starts with (the person's own come after them). */
const only = (keys: (keyof SelFilter)[]): SelFilter => Object.fromEntries(FILTER_ROWS.map(([k]) => [k, keys.includes(k)])) as unknown as SelFilter;
const BUILT_IN: FilterProfile[] = [
  { name: "Everything", filter: FILTER_ALL },
  { name: "Bodies only", filter: only(["bodies"]) },
  { name: "Faces only", filter: only(["faces", "facePlane", "faceCyl", "faceCone", "faceSphere", "faceOther"]) },
  { name: "Round faces (holes, pins)", filter: only(["faces", "faceCyl", "faceCone"]) },
  { name: "Edges and vertices", filter: only(["edges", "vertices"]) },
  { name: "Centre points", filter: only(["centres"]) },
  { name: "Sketches", filter: only(["sketchCurves", "sketchPoints", "centres", "profiles"]) },
];

/** The kinds in the window's order (as the person put them; a face's kinds stay under Faces). */
function ordered(): (typeof FILTER_ROWS)[number][] {
  const heads = FILTER_ROWS.filter(([, , d]) => !d);
  const want = settings.value.selFilterOrder ?? [];
  heads.sort((a, b) => {
    const ia = want.indexOf(a[0]);
    const ib = want.indexOf(b[0]);
    return (ia < 0 ? 99 + FILTER_ROWS.indexOf(a) : ia) - (ib < 0 ? 99 + FILTER_ROWS.indexOf(b) : ib);
  });
  return heads.flatMap((h) => (h[0] === "faces" ? FILTER_ROWS.filter(([k, , d]) => k === "faces" || (d && k.startsWith("face"))) : [h]));
}

/** The filter's window by the funnel: its profiles, a switch per kind (in the order chosen: ▲ ▼), All and None. */
export function toggleFilterWindow(onChange: () => void): void {
  if (win) {
    win.remove();
    win = null;
    return onChange();
  }
  const w = el("div", "sel-filter");
  win = w;
  const draw = () => {
    w.replaceChildren();
    const head = el("div", "sel-filter-head");
    head.append(el("span", "", "Selection filter"));
    const all = el("button", "sel-filter-btn", "All");
    const none = el("button", "sel-filter-btn", "None");
    const x = el("button", "sel-filter-btn", "×");
    x.title = "Close";
    head.append(all, none, x);
    w.append(head);
    // Profiles: the app's and the person's own (saved from the switches as they are).
    const mine = settings.value.selFilterProfiles ?? [];
    const profs = el("div", "sel-filter-profiles");
    const pick = document.createElement("select");
    pick.className = "sel-filter-select";
    pick.append(new Option(tr("Profile…"), ""));
    for (const p of BUILT_IN) pick.append(new Option(tr(p.name), `b:${p.name}`));
    for (const p of mine) pick.append(new Option(`★ ${p.name}`, `m:${p.name}`));
    pick.addEventListener("change", () => {
      const v = pick.value;
      const p = v.startsWith("b:") ? BUILT_IN.find((x) => x.name === v.slice(2)) : mine.find((x) => x.name === v.slice(2));
      if (p) settings.set("selFilter", { ...FILTER_ALL, ...p.filter });
      onChange();
      draw();
    });
    const save = el("button", "sel-filter-btn", "Save as…");
    save.title = "Keep the switches as they are now as a profile of your own";
    // (Named in a box here: a browser's prompt() does not show in the Android app.)
    save.addEventListener("click", () => {
      const box = el("div", "sel-filter-profiles");
      const name = document.createElement("input");
      name.className = "sel-filter-select";
      name.placeholder = tr("Name of the profile");
      const ok = el("button", "sel-filter-btn", "Save");
      const keep = () => {
        const n = name.value.trim();
        if (!n) return name.focus();
        settings.set("selFilterProfiles", [...mine.filter((p) => p.name !== n), { name: n, filter: { ...f() } }]);
        draw();
      };
      ok.addEventListener("click", keep);
      name.addEventListener("keydown", (e) => (e.stopPropagation(), e.key === "Enter" && keep(), e.key === "Escape" && draw()));
      box.append(name, ok);
      profs.after(box);
      name.focus();
    });
    profs.append(pick, save);
    w.append(profs);
    if (mine.length) {
      const list = el("div", "sel-filter-mine");
      for (const p of mine) {
        const r = el("div", "sel-filter-prof");
        const use = el("button", "sel-filter-link", `★ ${p.name}`);
        use.addEventListener("click", () => (settings.set("selFilter", { ...FILTER_ALL, ...p.filter }), onChange(), draw()));
        const del = el("button", "sel-filter-btn", "×");
        del.title = "Delete this profile";
        del.addEventListener("click", () => (settings.set("selFilterProfiles", mine.filter((q) => q.name !== p.name)), draw()));
        r.append(use, del);
        list.append(r);
      }
      w.append(list);
    }
    // The switches, in the order chosen.
    const rows = ordered();
    const heads = rows.filter(([, , d]) => !d).map(([k]) => k);
    for (const [k, label, indent] of rows) {
      const row = el("div", `sel-filter-row${indent ? " sub" : ""}`);
      const lab = el("label", "sel-filter-lab");
      const b = document.createElement("input");
      b.type = "checkbox";
      b.checked = f()[k];
      b.addEventListener("change", () => (settings.set("selFilter", { ...f(), [k]: b.checked }), onChange()));
      lab.append(b, ` ${label}`);
      row.append(lab);
      if (!indent) {
        const at = heads.indexOf(k);
        const move = (d: number) => {
          const next = [...heads];
          const j = at + d;
          if (j < 0 || j >= next.length) return;
          [next[at], next[j]] = [next[j], next[at]];
          settings.set("selFilterOrder", next);
          draw();
        };
        const up = el("button", "sel-filter-mv", "▲");
        up.title = "Up";
        up.disabled = at === 0;
        up.addEventListener("click", () => move(-1));
        const down = el("button", "sel-filter-mv", "▼");
        down.title = "Down";
        down.disabled = at === heads.length - 1;
        down.addEventListener("click", () => move(1));
        row.append(up, down);
      }
      w.append(row);
    }
    const setAll = (on: boolean) => {
      settings.set("selFilter", Object.fromEntries(FILTER_ROWS.map(([k]) => [k, on])) as unknown as SelFilter);
      onChange();
      draw();
    };
    all.addEventListener("click", () => setAll(true));
    none.addEventListener("click", () => setAll(false));
    x.addEventListener("click", () => toggleFilterWindow(onChange));
  };
  draw();
  document.body.append(w);
  besideButton(w, "selFilter");
  onChange();
}

export function filterWindowOpen(): boolean {
  return !!win;
}
