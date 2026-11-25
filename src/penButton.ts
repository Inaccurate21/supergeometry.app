// The S Pen's side button, in the Android app (android/ passes it on as
// sgPenButton): what it does is set in Settings → S Pen.
// - Touching with the button held, not moving: a "tap" action (by default the
//   menu a right-click opens).
// - Touching with the button held and moving: turns or moves the view (as a
//   mouse's right or middle drag does).
// - Pressing the button while the pen hovers: a "hover" action (by default Undo).
// Done the way a mouse or a keyboard would do it, so every tool takes it.

export type PenTap = "context" | "undo" | "escape" | "done" | "fit" | "none";
export type PenDrag = "orbit" | "pan" | "none";
export interface PenButtonSettings {
  tap: PenTap;
  drag: PenDrag;
  hover: PenTap;
}

const KEY = "supergeometry.penButton";
const DEFAULTS: PenButtonSettings = { tap: "context", drag: "orbit", hover: "undo" };

export function penButtonSettings(): PenButtonSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<PenButtonSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPenButton(patch: Partial<PenButtonSettings>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...penButtonSettings(), ...patch }));
  } catch {
    // not kept
  }
}

export const PEN_TAPS: [PenTap, string][] = [
  ["context", "Menu (as a right-click)"],
  ["undo", "Undo"],
  ["escape", "Step back (Esc)"],
  ["done", "Done (Enter)"],
  ["fit", "Fit the view"],
  ["none", "Nothing"],
];
export const PEN_DRAGS: [PenDrag, string][] = [
  ["orbit", "Turn the view"],
  ["pan", "Move the view"],
  ["none", "Nothing"],
];

const canvas = () => document.getElementById("view") as HTMLCanvasElement | null;
const ID = 88;

function mouse(type: string, x: number, y: number, button: number, buttons: number): void {
  canvas()?.dispatchEvent(new PointerEvent(type, { pointerId: ID, pointerType: "mouse", isPrimary: true, clientX: x, clientY: y, button, buttons, bubbles: true, cancelable: true }));
}

function key(k: string): void {
  const target = document.activeElement ?? document.body;
  for (const type of ["keydown", "keyup"]) target.dispatchEvent(new KeyboardEvent(type, { key: k, code: k === "f" ? "KeyF" : k, bubbles: true, cancelable: true }));
}

function act(a: PenTap, x: number, y: number): void {
  switch (a) {
    case "context":
      mouse("pointerdown", x, y, 2, 2);
      mouse("pointerup", x, y, 2, 0);
      return;
    case "undo":
      (document.getElementById("undo-btn") as HTMLButtonElement | null)?.click();
      return;
    case "escape":
      return key("Escape");
    case "done":
      return key("Enter");
    case "fit":
      return key("f");
    case "none":
      return;
  }
}

let press: { x: number; y: number; dragging: boolean } | null = null;

function handle(kind: string, px: number, py: number, w: number): void {
  const vv = window.visualViewport;
  const k = (vv?.width ?? innerWidth) / (w || innerWidth);
  const x = px * k + (vv?.offsetLeft ?? 0);
  const y = py * k + (vv?.offsetTop ?? 0);
  const s = penButtonSettings();
  if (kind === "hover-down") return act(s.hover, x, y);
  if (kind === "touch-down") {
    press = { x, y, dragging: false };
    return;
  }
  if (!press) return;
  if (kind === "touch-move") {
    if (!press.dragging) {
      if (Math.hypot(x - press.x, y - press.y) < 8 || s.drag === "none") return;
      press.dragging = true;
      // A mouse's right drag turns the view, a middle drag moves it.
      const b = s.drag === "pan" ? 1 : 2;
      mouse("pointerdown", press.x, press.y, b, b === 1 ? 4 : 2);
    }
    mouse("pointermove", x, y, -1, s.drag === "pan" ? 4 : 2);
    return;
  }
  if (kind === "touch-up" || kind === "touch-cancel") {
    if (press.dragging) mouse("pointerup", x, y, s.drag === "pan" ? 1 : 2, 0);
    else if (kind === "touch-up") act(s.tap, x, y);
    press = null;
  }
}

if ("SGAndroid" in window) (window as unknown as { sgPenButton: typeof handle }).sgPenButton = handle;
