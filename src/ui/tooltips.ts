// Tool tips as Fusion's: the pointer (a mouse or a pen) held over a tool a moment, a card by it - the tool's name,
// its key, what it does in a sentence or two, and a picture of it. For the tools on the line at the bottom, in its
// lists, the columns at the sides and the tools' columns. Asked for: "an explanation with a picture for every tool,
// as Fusion's, when the pointer is over it".

import { tr } from "../i18n";
import { icons, type IconName } from "./icons";
import { el } from "./ui";

interface Tip {
  text: string;
  /** The picture: one of the app's icons, drawn big (missing: the tool's own). */
  art?: IconName;
}

/** By the tool's id (the line's "v-<id>", a column's data-tool / data-left). */
const TIPS: Record<string, Tip> = {
  // ---- the model
  sketch: { text: "Draw on a plane or a flat face: lines, rectangles, circles... with sizes and constraints. A closed shape can then be made solid.", art: "sketch" },
  extrude: { text: "Pull a sketch's closed shape (or a face) straight out into a solid - or into the body, to cut. Taper, both ways, up to a face, through all.", art: "extrude" },
  revolve: { text: "Turn a sketch's shape round an axis into a solid: a vase, a wheel, a knob. Less than 360° leaves a part of it; with travel, a spring or a thread.", art: "revolve" },
  sweep: { text: "Carry a shape along a path (a sketch's curve, a body's edges): a handle, a pipe, a rail.", art: "sweep" },
  loft: { text: "A smooth solid through shapes on different planes: from a square at the bottom to a circle at the top.", art: "loft" },
  hole: { text: "A screw's hole in a flat face, by the screw (M2 to M12): plain, counterbore or countersink, through or to a depth, a chamfer round the mouth, a drill point. Drag its dot - OSNAP catches the middle, edges and lines of symmetry.", art: "hole" },
  thread: { text: "A real thread on a round face: a bolt's or a nut's, by the size; several starts too.", art: "thread" },
  threadC: { text: "A real thread on a round face: a bolt's or a nut's, by the size; several starts too.", art: "thread" },
  primitives: { text: "A box, a cylinder, a cone, a sphere, a torus or a coil, by its sizes, on a plane or the face picked. Each is a sketch and its step: its sizes can be changed later in History.", art: "ffBox" },
  "prim-box": { text: "A box by its width, depth and height, round a centre on the plane.", art: "ffBox" },
  "prim-cylinder": { text: "A cylinder by its diameter and height.", art: "ffCylinder" },
  "prim-cone": { text: "A cone by its bottom and top diameters (0: to a point) and its height.", art: "ffCylinder" },
  "prim-sphere": { text: "A sphere by its diameter, round a centre.", art: "ffSphere" },
  "prim-torus": { text: "A ring (a doughnut) by its diameter across and the tube's.", art: "ffTorus" },
  "prim-coil": { text: "A spring: its diameter, the wire's, the pitch of one turn and the number of turns.", art: "thread" },
  pressPull: { text: "Push or pull what is picked: a face moves in or out (Offset Face), an edge is rounded (Fillet).", art: "offsetFace" },
  combine: { text: "Bodies together: Join them, Cut the others out of the target, or keep only where they Intersect. Keep the tools, or make the result a new body.", art: "union" },
  splitBodyC: { text: "Cut a body in pieces along a plane, a face or another body. Each piece is a body of its own.", art: "split" },
  split: { text: "Cut a body in pieces along a plane, a face or another body. Each piece is a body of its own.", art: "split" },
  splitFace: { text: "Divide a face in two (or more) along a sketch's shape drawn on it, or along edges - to push or pull just a part of it.", art: "projectEdge" },
  shell: { text: "Hollow a body out, leaving walls of the thickness given; a face picked is left open.", art: "shell" },
  shellC: { text: "Hollow a body out, leaving walls of the thickness given; a face picked is left open.", art: "shell" },
  fillet: { text: "Round edges (or a corner of a sketch). Drag the arrow or type the radius; variable, chord or smooth.", art: "fillet" },
  filletC: { text: "Round edges. Drag the arrow or type the radius; variable, chord or smooth.", art: "fillet" },
  chamfer: { text: "Cut an edge at an angle: equal distances, two distances, or a distance and an angle.", art: "chamfer" },
  chamferC: { text: "Cut an edge at an angle: equal distances, two distances, or a distance and an angle.", art: "chamfer" },
  offsetFace: { text: "Move a face in or out by a distance: the body grows or shrinks with it.", art: "offsetFace" },
  offsetEdge: { text: "A copy of edges a set distance away, on their face.", art: "offsetEdge" },
  wrap: { text: "Wrap a sketch's shape round a round face, raised from it or sunk into it.", art: "wrap" },
  union: { text: "Join bodies that touch or overlap into one.", art: "union" },
  subtract: { text: "Cut bodies out of another, with a gap if wanted.", art: "subtract" },
  intersect: { text: "Keep only where bodies overlap.", art: "intersect" },
  move: { text: "Move and turn what is picked: drag the arrows and rings, type the distances and angles, or go point to point.", art: "move" },
  translate: { text: "Move bodies by a distance along X, Y and Z.", art: "translate" },
  rotate: { text: "Turn round an axis or a point by an angle.", art: "rotateAxis" },
  scale: { text: "Make bigger or smaller: by a factor, or each way by its own.", art: "scale" },
  mirror: { text: "A mirrored copy across a plane (in a sketch: across a line).", art: "mirror" },
  linear: { text: "Copies in a row or a grid, a set distance apart.", art: "patternLinear" },
  circular: { text: "Copies round an axis, evenly or by an angle.", art: "patternCircular" },
  pattern: { text: "Copies in a row (Linear) or round a centre (Circular).", art: "patternLinear" },
  measure: { text: "Sizes and distances of anything tapped: lengths, diameters, X, Y, Z, angles. Snap points pick ends and centres. Copy a value to the calculator, or pin it.", art: "measure" },
  section: { text: "Cut the view open along a plane to see inside. Nothing is changed.", art: "section" },
  isolate: { text: "Show only the bodies picked; the rest is hidden until Isolate is off.", art: "isolate" },
  selFilter: { text: "What a tap can pick: bodies, kinds of faces, edges, corners, centre points, a sketch's curves... Your own profiles, and the order you like.", art: "filter" },
  calculator: { text: "Work out a size: + - × ÷, brackets, √, π and the project's variables. Copy the result or insert it into the box typed in last.", art: "calculator" },
  fit: { text: "Zoom so that everything is in view.", art: "fit" },
  // ---- a sketch
  select: { text: "Pick curves and points to change them: drag, type sizes, add constraints.", art: "pointer" },
  line: { text: "Lines, one after another. Close on the first point to finish a shape.", art: "line" },
  arc: { text: "An arc through three points, or from its centre.", art: "arc" },
  spline: { text: "A smooth curve through points (or by control points, or freehand).", art: "spline" },
  rect: { text: "A rectangle from its centre (or two corners, or three points). Type its sizes as you draw.", art: "rect" },
  circle: { text: "A circle from its centre (or two or three points). Type its diameter.", art: "circle" },
  ellipse: { text: "An ellipse from its centre, from the ends of its axis, or in a box.", art: "ellipse" },
  slot: { text: "A slot: two rounded ends joined by straight sides - from centre to centre, end to end, or from its middle.", art: "slot" },
  point: { text: "A lone point: a hole's centre, a place to dimension to.", art: "sketchPoint" },
  dimension: { text: "Give a size: a line's length, a circle's diameter, the distance between two things, the angle between two lines. Then type the size.", art: "dimension" },
  polygon: { text: "A regular polygon: a triangle, a square, a hexagon... by its centre and a corner.", art: "polygon" },
  text: { text: "Text as curves, to cut or raise.", art: "text" },
  project: { text: "Copy a body's edges (or another sketch's curves) into this sketch, linked to them.", art: "project" },
  offset: { text: "A copy of a curve or a shape a set distance away.", art: "offset" },
  fill: { text: "Fill a closed shape with a pattern: lines, a grid, honeycomb...", art: "hatch" },
  trim: { text: "Cut away a piece of a curve between where others cross it (or swipe across several).", art: "trim" },
  break: { text: "Cut a curve where another crosses it: every piece stays.", art: "breakLine" },
  extend: { text: "Lengthen a line to the next curve it would meet.", art: "extend" },
  align: { text: "Line a line up with another.", art: "alignLine" },
  delete: { text: "Delete what is tapped.", art: "trash" },
};

let card: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let over: Element | null = null;

function hide(): void {
  clearTimeout(timer);
  card?.remove();
  card = null;
  over = null;
}

/** The tool an element stands for: its id and its name (English, as written in the code). */
function toolOf(e: Element): { id: string; label: string; key?: string; icon?: string } | null {
  const word = e.closest<HTMLElement>("[data-sig]");
  if (word?.dataset.sig?.startsWith("verb|")) {
    const id = (word.dataset.key ?? "").replace(/^v-/, "");
    return { id, label: word.dataset.sig.split("|")[1] ?? id, key: word.querySelector(".sn-kbd")?.textContent ?? undefined, icon: word.querySelector(".sn-icon")?.innerHTML };
  }
  const tool = e.closest<HTMLElement>(".tool[data-tool]");
  if (tool) return { id: tool.dataset.tool!, label: tool.dataset.label ?? tool.dataset.tool!, key: tool.querySelector(".tool-key")?.textContent ?? undefined, icon: tool.querySelector("svg")?.outerHTML };
  const left = e.closest<HTMLElement>("[data-left]");
  if (left) return { id: left.dataset.left!, label: left.querySelector(".right-label")?.textContent ?? left.dataset.left!, icon: left.querySelector("svg")?.outerHTML };
  return null;
}

function show(e: Element, t: { id: string; label: string; key?: string; icon?: string }): void {
  const tip = TIPS[t.id];
  if (!tip) return;
  hide();
  over = e;
  const c = el("div", "tooltip-card");
  const head = el("div", "tooltip-head");
  head.append(el("span", "tooltip-name", tr(t.label)));
  if (t.key) head.append(el("kbd", "cmd-key", t.key));
  const art = el("div", "tooltip-art");
  art.innerHTML = (tip.art && icons[tip.art]) || t.icon || "";
  c.append(head, art, el("div", "tooltip-text", tip.text));
  document.body.append(c);
  card = c;
  // Beside it: above the line at the bottom, to the right of a column at the left, to the left of one at the right.
  const r = e.getBoundingClientRect();
  const w = c.offsetWidth;
  const h = c.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  let y = r.top - h - 10;
  if (y < 8) y = r.bottom + 10;
  if (r.left < 120 && r.height > r.width * 0.7) ((x = r.right + 10), (y = r.top + r.height / 2 - h / 2));
  if (r.right > window.innerWidth - 120 && r.height > r.width * 0.7) ((x = r.left - w - 10), (y = r.top + r.height / 2 - h / 2));
  c.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x))}px`;
  c.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, y))}px`;
}

export function setupTooltips(): void {
  document.addEventListener("pointerover", (ev) => {
    // (A finger has no hover: its tap is the tool.)
    if (ev.pointerType === "touch") return;
    const t = ev.target instanceof Element ? toolOf(ev.target) : null;
    const target = ev.target instanceof Element ? ev.target.closest("[data-sig], .tool[data-tool], [data-left]") : null;
    if (!t || !target) {
      if (over && !(ev.target instanceof Element && over.contains(ev.target))) hide();
      return;
    }
    if (target === over) return;
    hide();
    over = target;
    timer = setTimeout(() => target.isConnected && over === target && show(target, t), 650);
  });
  document.addEventListener("pointerdown", hide, true);
  document.addEventListener("keydown", hide, true);
  window.addEventListener("blur", hide);
}
