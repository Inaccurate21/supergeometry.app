// Quick actions: a short row of round buttons right beside whatever is
// picked - on the model a face, an edge, a point, a body, a sketch's shape, a
// plane, an axis, an image; in a sketch its curves and points - with the two
// tools most likely next for it (a flat face: Sketch, Shell, Move; a round one:
// Thread; an edge: Chamfer, Move; a body: Shell, Fillet; a sketch's curves:
// Construction, Delete). The most likely of all already has its handle on it
// (a face's arrow, an edge's fillet dot, a gimbal): these are the next ones, a
// tap away instead of a trip round the wheel. On the model they are the very
// tools the wheel offers for the pick (the same ToolItems).

import type { Vec3 } from "../doc/types";
import { icons } from "../ui/icons";
import type { ToolItem } from "../ui/ui";
import type { Viewport } from "../view/viewport";
import { clampToFree } from "./annotate";

/** By kind of pick: the tools to offer, best first (the first two there are and can be used now). */
export const QUICK = {
  face: ["thread", "sketch", "shell", "move", "fillet", "editFreeform", "thicken"],
  edge: ["chamfer", "thread", "move", "connect"],
  vertex: ["moveVertex", "delete"],
  body: ["shell", "fillet", "mirror"],
  profile: ["sketch", "revolve"],
  plane: ["sketch", "plane"],
  axis: ["delete"],
  image: ["scale", "delete"],
  // In a sketch: its picked curves and points (the sketch tool's own buttons).
  curve: ["construction", "delete"],
  point: ["delete"],
} satisfies Record<string, string[]>;

export type QuickKind = keyof typeof QUICK;

export interface QuickPlace {
  /** The pick's outward normal (a face's, a shape's): they go the other way from its arrow on the screen. */
  facing?: Vec3;
  /** Turned away (seen from behind): hidden (a body's face; a sketch's shape is seen from both sides). */
  hideBack?: boolean;
  /** How far from the point (px): further for a gimbal round it. */
  gap?: number;
}

/** At most this many: only the important things (more is the wheel's job). A flat face: Sketch, Shell and Move/Rotate. */
const MOST = 2;
const MOST_OF: Partial<Record<QuickKind, number>> = { face: 3 };

export class QuickActions {
  private readonly box = document.createElement("div");
  private readonly hook = () => this.layout();

  /** `items`: what the pick offers (the wheel's own list, its kinds' items too); `at`: the point it is shown beside. */
  static show(view: Viewport, kind: QuickKind, items: ToolItem[], at: Vec3, place: QuickPlace = {}): QuickActions | null {
    const byId = new Map<string, ToolItem>();
    const walk = (its: ToolItem[]) => {
      for (const it of its) {
        if (!byId.has(it.id)) byId.set(it.id, it);
        if (it.children?.length) walk(it.children);
      }
    };
    walk(items);
    const picked = (QUICK[kind] as readonly string[]).map((id) => byId.get(id)).filter((it): it is ToolItem => !!it && !it.disabled && !!it.run && !it.beta).slice(0, MOST_OF[kind] ?? MOST);
    return picked.length ? new QuickActions(view, picked, at, place) : null;
  }

  /** These very buttons (a tool's own choices, the one in use lit), beside `at`. */
  static of(view: Viewport, items: ToolItem[], at: Vec3, place: QuickPlace = {}): QuickActions {
    return new QuickActions(view, items, at, place);
  }

  private readonly facing?: Vec3;

  private constructor(
    private readonly view: Viewport,
    items: ToolItem[],
    private readonly at: Vec3,
    private readonly place: QuickPlace,
  ) {
    this.facing = place.facing;
    this.box.className = "quick-actions";
    for (const it of items) {
      const b = document.createElement("button");
      b.className = it.active ? "quick-action on" : "quick-action";
      b.title = it.shortcut ? `${it.label} (${it.shortcut})` : it.label;
      b.setAttribute("aria-label", it.label);
      const icon = icons[it.icon as keyof typeof icons];
      b.innerHTML = `${icon ?? ""}<span>${shortName(it.label)}</span>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        it.run?.();
      });
      this.box.append(b);
    }
    // A press on them is theirs: never a pick on the model behind, nor the view turning.
    this.box.addEventListener("pointerdown", (e) => e.stopPropagation());
    document.body.append(this.box);
    view.frameHooks.add(this.hook);
    this.layout();
  }

  /** Below the point, clear of the handle on it (moved on with the view: only when the view is drawn again). */
  private layout(): void {
    const s = this.view.toScreen(this.at);
    let shown = !!s;
    if (s && this.facing && this.place.hideBack !== false) {
      const v = this.view.cam.viewDir();
      if (v.x * this.facing[0] + v.y * this.facing[1] + v.z * this.facing[2] > 0.05) shown = false;
    }
    this.box.hidden = !shown;
    if (!s || !shown) return;
    const hw = this.box.offsetWidth / 2;
    const hh = this.box.offsetHeight / 2;
    // Below it; where a wheel is in the way, above it, or to a side (they'd be hidden under the wheel).
    const wheels = wheelsOnScreen();
    // (A face's arrow points out along its normal: they go the other way on the screen, not under it.)
    const first: [number, number][] = [];
    if (this.facing) {
      const k = this.view.cam.worldPerPixel(this.view.height) * 60;
      const tip = this.view.toScreen([this.at[0] + this.facing[0] * k, this.at[1] + this.facing[1] * k, this.at[2] + this.facing[2] * k]);
      const dx = tip ? s[0] - tip[0] : 0;
      const dy = tip ? s[1] - tip[1] : 0;
      const l = Math.hypot(dx, dy);
      if (l > 8) {
        const d = Math.abs((dx / l) * hw) + Math.abs((dy / l) * hh) + (this.place.gap ?? 34);
        first.push([s[0] + (dx / l) * d, s[1] + (dy / l) * d]);
      }
    }
    const g = this.place.gap ?? 46;
    const spots: [number, number][] = [
      ...first,
      [s[0], s[1] + g + hh],
      [s[0], s[1] - g - hh],
      [s[0] - g - hw, s[1]],
      [s[0] + g + hw, s[1]],
    ].map((p) => clampToFree(p as [number, number], hw, hh));
    // (Nor under a value box on the model - an extrude's distance, beside its arrow.)
    const boxes = [...document.querySelectorAll<HTMLElement>(".dim-widget")].map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0);
    const clear = ([x, y]: [number, number]) => !wheels.some((w) => hits(w, x, y, hw + 4, hh + 4)) && !boxes.some((r) => x + hw + 6 > r.left && x - hw - 6 < r.right && y + hh + 6 > r.top && y - hh - 6 < r.bottom);
    const [x, y] = spots.find(clear) ?? spots[0];
    this.box.style.transform = `translate(${Math.round(x - hw)}px, ${Math.round(y - hh)}px)`;
  }

  dispose(): void {
    this.view.frameHooks.delete(this.hook);
    this.box.remove();
  }
}

/** A short name under the icon ("Move/Rotate Edge" → "Move"). */
function shortName(label: string): string {
  const s = label.replace(/…$/, "").split(/[/ –]/)[0];
  return s.length > 12 ? s.slice(0, 11) + "…" : s;
}

/** The wheels up on the screen, as circles (their middle, and how far they reach: folded, just the middle). */
function wheelsOnScreen(): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (const w of document.querySelectorAll<HTMLElement>(".wheel-root:not([hidden])")) {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(w.style.transform);
    if (m) out.push({ x: Number(m[1]), y: Number(m[2]), r: w.classList.contains("folded") ? 34 : 116 });
  }
  return out;
}

/** Does a box (its middle, half its size) overlap a circle? */
function hits(c: { x: number; y: number; r: number }, x: number, y: number, hw: number, hh: number): boolean {
  const dx = Math.max(Math.abs(c.x - x) - hw, 0);
  const dy = Math.max(Math.abs(c.y - y) - hh, 0);
  return dx * dx + dy * dy < c.r * c.r;
}
