// How a mouse moves the view (Settings → Mouse): the way of other CAD
// programs, so hands used to one need not learn another. A left drag on
// empty space is a box selection in every one; a right click without moving
// opens the menu; the wheel zooms (at the pointer), its way can be turned.

export type MousePreset = "supergeometry" | "fusion" | "solidworks" | "onshape" | "inventor" | "blender";

/** A button held with keys: 0 left, 1 middle (the wheel pressed), 2 right. */
export interface Chord {
  button: 0 | 1 | 2;
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
}

interface Preset {
  label: string;
  orbit: Chord[];
  pan: Chord[];
  /** What each does, said in Settings. */
  says: string;
}

export const PRESETS: Record<MousePreset, Preset> = {
  supergeometry: { label: "superGeometry", orbit: [{ button: 2 }, { button: 0, alt: true }], pan: [{ button: 1 }, { button: 2, shift: true }], says: "Turn: right drag (or Alt + left). Move: middle drag (or Shift + right)." },
  fusion: { label: "Fusion 360", orbit: [{ button: 1, shift: true }], pan: [{ button: 1 }], says: "Turn: Shift + middle drag. Move: middle drag. Right click: the menu." },
  solidworks: { label: "SolidWorks", orbit: [{ button: 1 }], pan: [{ button: 1, ctrl: true }], says: "Turn: middle drag. Move: Ctrl + middle drag." },
  onshape: { label: "Onshape", orbit: [{ button: 2 }], pan: [{ button: 1 }, { button: 2, ctrl: true }], says: "Turn: right drag. Move: middle drag (or Ctrl + right)." },
  inventor: { label: "Inventor", orbit: [{ button: 1, shift: true }], pan: [{ button: 1 }], says: "Turn: Shift + middle drag. Move: middle drag." },
  blender: { label: "Blender", orbit: [{ button: 1 }], pan: [{ button: 1, shift: true }], says: "Turn: middle drag. Move: Shift + middle drag." },
};

const KEY = "supergeometry.mouse";

export interface MouseSettings {
  preset: MousePreset;
  /** The wheel turned towards you zooms in (the other way round from the start). */
  invertZoom: boolean;
}

export function mouseSettings(): MouseSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<MouseSettings>;
    return { preset: v.preset && v.preset in PRESETS ? v.preset : "supergeometry", invertZoom: !!v.invertZoom };
  } catch {
    return { preset: "supergeometry", invertZoom: false };
  }
}

export function setMouse(patch: Partial<MouseSettings>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...mouseSettings(), ...patch }));
  } catch {
    // not kept
  }
}

const fits = (c: Chord, e: MouseEvent) => c.button === e.button && !!c.shift === e.shiftKey && !!c.ctrl === (e.ctrlKey || e.metaKey) && !!c.alt === e.altKey;

/** What a mouse press does to the view in the chosen way: turn it, move it, or neither. */
export function mouseNavFor(e: MouseEvent): "orbit" | "pan" | null {
  const id = mouseSettings().preset;
  // The app's own way, as it always was: the middle button moves with any key held.
  if (id === "supergeometry" && e.button === 1) return "pan";
  const p = PRESETS[id];
  if (p.pan.some((c) => fits(c, e))) return "pan";
  if (p.orbit.some((c) => fits(c, e))) return "orbit";
  return null;
}
