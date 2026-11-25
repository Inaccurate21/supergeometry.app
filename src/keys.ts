// The keyboard shortcuts that can be changed (Settings → Keyboard shortcuts): each action's key, kept in the
// settings (`keys`, only the ones changed). A key is written as the editor shows it: "d", "shift+x", "ctrl+f".
// Asked for: "D for Measure ... S for favourite tools, with typing a tool and adding to favourites ... Ctrl+F full
// screen, F11 stays ... shortcut editing in the settings".

import { settings } from "./settings";

export interface KeyAction {
  id: string;
  label: string;
  /** The key it has unless changed ("" none). */
  key: string;
  group: "General" | "View" | "Model" | "Draw";
}

export const KEY_ACTIONS: KeyAction[] = [
  { id: "toolbox", label: "Favourite tools and search", key: "s", group: "General" },
  { id: "search", label: "Search commands", key: "x", group: "General" },
  { id: "measure", label: "Measure", key: "d", group: "General" },
  { id: "calculator", label: "Calculator", key: "", group: "General" },
  { id: "filter", label: "Selection filter", key: "", group: "General" },
  { id: "save", label: "Save", key: "ctrl+s", group: "General" },
  { id: "shortcuts", label: "Keyboard shortcuts", key: "?", group: "General" },
  { id: "fullscreen", label: "Full screen", key: "ctrl+f", group: "View" },
  { id: "fit", label: "Fit the view (nothing picked)", key: "f", group: "View" },
  { id: "selectThrough", label: "Select Through", key: "ctrl+shift+s", group: "View" },
  { id: "sketch", label: "New sketch", key: "k", group: "Model" },
  { id: "extrude", label: "Extrude", key: "e", group: "Model" },
  { id: "fillet", label: "Fillet", key: "f", group: "Model" },
  { id: "shell", label: "Shell", key: "h", group: "Model" },
  { id: "move", label: "Move/Rotate", key: "m", group: "Model" },
  { id: "translate", label: "Translate", key: "n", group: "Model" },
  { id: "project", label: "Project as Sketch", key: "p", group: "Model" },
  { id: "revolve", label: "Revolve", key: "v", group: "Model" },
  { id: "sweep", label: "Sweep", key: "w", group: "Model" },
  { id: "offsetEdge", label: "Offset Edge", key: "o", group: "Model" },
  { id: "scale", label: "Scale", key: "", group: "Model" },
  { id: "draw-line", label: "Line (a new sketch)", key: "l", group: "Draw" },
  { id: "draw-arc", label: "Arc (a new sketch)", key: "a", group: "Draw" },
  { id: "draw-circle", label: "Circle (a new sketch)", key: "c", group: "Draw" },
  { id: "draw-rect", label: "Rectangle (a new sketch)", key: "r", group: "Draw" },
  { id: "draw-polygon", label: "Polygon (a new sketch)", key: "g", group: "Draw" },
  { id: "draw-spline", label: "Spline (a new sketch)", key: "i", group: "Draw" },
  { id: "draw-trim", label: "Trim (a new sketch)", key: "t", group: "Draw" },
];

/** A key press as written in the editor ("ctrl+shift+s", "d", "f11"). */
export function comboOf(e: KeyboardEvent): string {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (["control", "shift", "alt", "meta"].includes(k)) return "";
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  // (Shift with a sign key - "?" - is in the sign itself.)
  if (e.shiftKey && (k.length > 1 || /[a-z0-9]/.test(k))) parts.push("shift");
  parts.push(k === " " ? "space" : k);
  return parts.join("+");
}

/** The key an action has now. */
export function keyOf(id: string): string {
  const own = settings.value.keys?.[id];
  return own ?? KEY_ACTIONS.find((a) => a.id === id)?.key ?? "";
}

/** The actions on this key, in the list's order. */
export function actionsOn(combo: string): string[] {
  if (!combo) return [];
  return KEY_ACTIONS.filter((a) => keyOf(a.id) === combo).map((a) => a.id);
}

/** Set an action's key ("" none; the default again: null). */
export function setKey(id: string, key: string | null): void {
  const keys = { ...(settings.value.keys ?? {}) };
  if (key === null) delete keys[id];
  else keys[id] = key;
  settings.set("keys", keys);
}

/** As shown: "Ctrl + Shift + S". */
export function showKey(k: string): string {
  return k
    ? k
        .split("+")
        .map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
        .join(" + ")
    : "—";
}
