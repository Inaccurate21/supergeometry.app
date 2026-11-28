// The Browser (as Fusion's, at the left): the project's settings (its units), its saved views, the origin (the
// world axes and the XY / XZ / YZ planes, each shown or hidden), then every body, sketch, construction plane and
// axis, image and joint, with visibility toggles - plus folders (at the bottom) to group any of them. It took the
// place of the Items panel (asked for: "the Browser tree ... Items goes, so the same thing isn't there twice").

import type { DocStore } from "../doc/store";
import type { Feature, ItemFolder, SavedView, Units } from "../doc/types";
import { settings } from "../settings";
import type { RegenResult } from "../kernel/protocol";
import { icons, type IconName } from "./icons";
import { el, twoTap } from "./ui";
import { tr } from "../i18n";

export interface ItemsHandlers {
  selectBody(id: string): void;
  editSketch(id: string): void;
  selectPlane(id: string): void;
  selectImage(id: string): void;
  deleteBody(id: string): void;
  deleteFeature(id: string): void;
  /** Rename a body (custom name) or a feature (its history name). */
  rename(id: string, current: string, isBody: boolean): void;
  /** Ask for a name (folders). */
  askName(title: string, current: string): Promise<string | null>;
  isolated(): string[] | null;
  /** The project's units, and changing them. */
  setUnits(u: Units): void;
  /** A saved view: look from it; the view as it is now: kept under a name. */
  restoreView(v: SavedView): void;
  saveView(): void;
  /** Assemblies (a joint tapped). */
  openJoints(): void;
  /** Nothing selected any more (the selected items went into a folder). */
  deselect(): void;
}

interface Row {
  id: string;
  name: string;
  icon: IconName;
  open(): void;
  remove(): void;
  extra?: string;
  isBody?: boolean;
}

export class ItemsPanel {
  private el = document.getElementById("items")!;
  private list = document.getElementById("items-list")!;
  /** Rows ticked for grouping (Ctrl/Shift+click, or the checkboxes in Select mode). */
  private checked = new Set<string>();
  private picking = false;
  /** Move pressed: the folders get ticks - the one ticked takes the ticked items. */
  private moving = false;
  /** (The project's own branches start folded, as Fusion's do: the bodies and sketches are what is looked for.) */
  private collapsed = new Set<string>(["cat:Document settings", "cat:Named views", "cat:Origin"]);
  private last: RegenResult | null = null;

  constructor(
    private store: DocStore,
    private h: ItemsHandlers,
  ) {
    document.getElementById("items-btn")!.addEventListener("click", () => this.toggle());
    // (The origin's eyes follow the settings they switch.)
    settings.onChange(() => this.render(this.last));
    document.getElementById("items-close")!.innerHTML = icons.close;
    document.getElementById("items-close")!.addEventListener("click", () => this.toggle(false));
    const pick = document.getElementById("items-pick")!;
    pick.addEventListener("click", () => {
      // Ticks made with Ctrl/Shift+click (Select off): Select clears them.
      if (!this.picking && this.checked.size) {
        this.checked.clear();
        this.render(this.last);
        return;
      }
      this.picking = !this.picking;
      if (!this.picking) this.checked.clear();
      // What is selected (its rows lit) starts ticked: a lit row and a ticked one look the same.
      else for (const id of this.selectedIds) if (this.list.querySelector(`li[data-id="${CSS.escape(id)}"]`)) this.checked.add(id);
      pick.classList.toggle("on", this.picking);
      this.render(this.last);
    });
  }

  toggle(open?: boolean): void {
    const on = this.el.classList.toggle("open", open);
    // Phones and narrow tablets (an iPad mini upright): one panel at a time (Items or History).
    if (on && window.innerWidth < 760) {
      document.getElementById("history")?.classList.remove("open");
      document.body.classList.remove("history-open");
    }
    // The tool column steps aside while Items is open.
    document.body.classList.toggle("items-open", on);
    // The value panel and tool column re-fit around it.
    window.dispatchEvent(new Event("resize"));
  }

  private get folders(): ItemFolder[] {
    return this.store.doc.folders ?? [];
  }

  private shown = "";

  render(result: RegenResult | null): void {
    this.last = result;
    // Nothing that the list shows changed: keep the rows (rebuilding them under a
    // click that's in progress would swallow that click).
    const d = this.store.doc;
    const sig = JSON.stringify([
      d.hidden, d.names, d.folders, this.h.isolated(), d.units, d.views, d.joints?.map((j) => [j.id, j.name]), settings.value.showAxes, settings.value.showOriginPlanes, settings.value.originPlanes, [...this.checked], this.picking, this.moving, [...this.collapsed], [...this.selectedIds], this.used,
      result?.bodies.map((b) => [b.id, b.name]),
      d.features.filter((f) => ["sketch", "plane", "axis", "image"].includes(f.type)).map((f) => [f.id, f.name, f.type]),
    ]);
    if (sig === this.shown) return;
    this.shown = sig;
    this.list.innerHTML = "";
    const hidden = new Set(this.store.doc.hidden);
    const iso = this.h.isolated();
    const inFolder = new Set(this.folders.flatMap((f) => f.items));
    const section = (title: string) => this.list.append(el("li", "items-heading", title));

    // Everything there is, by kind.
    const bodies = result?.bodies ?? [];
    const names = this.store.doc.names ?? {};
    const feats = this.store.doc.features;
    const of = <T extends Feature["type"]>(t: T) => feats.filter((f) => f.type === t);
    const rows: Record<string, Row[]> = {
      Bodies: bodies.map((b) => ({ id: b.id, name: names[b.id] ?? b.name, icon: "body" as IconName, open: () => this.h.selectBody(b.id), remove: () => this.h.deleteBody(b.id), extra: iso && !iso.includes(b.id) ? " isolated-out" : "", isBody: true })),
      // Greyed while something else is isolated (they're hidden until Isolate is off).
      Sketches: of("sketch").map((s) => ({ id: s.id, name: s.name, icon: "sketch" as IconName, open: () => this.h.editSketch(s.id), remove: () => this.h.deleteFeature(s.id), extra: iso && !iso.includes(s.id) ? " isolated-out" : "" })),
      "Construction geometry": [...of("plane"), ...of("axis")].map((c) => ({ id: c.id, name: c.name, icon: (c.type === "plane" ? PLANE_ICON[(c as { kind?: string }).kind ?? "offset"] ?? "plane" : AXIS_ICON[(c as { kind?: string }).kind ?? ""] ?? "axis") as IconName, open: () => this.h.selectPlane(c.id), remove: () => this.h.deleteFeature(c.id), extra: iso && !iso.includes(c.id) ? " isolated-out" : "" })),
      Images: of("image").map((i) => ({ id: i.id, name: i.name, icon: "image" as IconName, open: () => this.h.selectImage(i.id), remove: () => this.h.deleteFeature(i.id) })),
      Joints: (d.joints ?? []).map((j) => ({ id: j.id, name: j.name, icon: "assembly" as IconName, open: () => this.h.openJoints(), remove: () => this.store.commit((x) => (x.joints = (x.joints ?? []).filter((y) => y.id !== j.id))) })),
    };
    const byId = new Map(Object.values(rows).flat().map((r) => [r.id, r]));

    // Each kind folds away under its heading (a long list of sketches and
    // planes buried the bodies).
    const category = (title: string, count: number) => {
      const key = `cat:${title}`;
      const li = el("li", "items-heading items-category");
      const b = el("button", "items-category-btn", `${this.collapsed.has(key) ? "▸" : "▾"} ${tr(title)}${count >= 0 ? ` (${count})` : ""}`);
      b.title = this.collapsed.has(key) ? "Show" : "Fold away";
      b.addEventListener("click", () => {
        if (this.collapsed.has(key)) this.collapsed.delete(key);
        else this.collapsed.add(key);
        this.render(this.last);
      });
      li.append(b);
      this.list.append(li);
      return !this.collapsed.has(key);
    };
    // The project's own branches first: its settings, its views, the origin.
    if (category("Document settings", -1)) {
      const u = d.units;
      const li = this.simpleRow("settings", `Units: ${u}`);
      const pick = document.createElement("select");
      pick.className = "browser-units no-tr";
      for (const x of ["mm", "cm", "m", "in", "ft"] as Units[]) pick.append(new Option(x, x, x === u, x === u));
      pick.addEventListener("change", () => this.h.setUnits(pick.value as Units));
      li.append(pick);
    }
    if (category("Named views", d.views.length)) {
      for (const v of d.views) {
        const li = this.simpleRow("eye", v.name, () => this.h.restoreView(v));
        const del = el("button", "icon-btn");
        del.title = "Delete view";
        del.innerHTML = icons.trash;
        del.addEventListener("click", () => this.store.commit((x) => (x.views = x.views.filter((y) => y.name !== v.name))));
        li.append(del);
      }
      this.simpleRow("plus", "Save current view", () => this.h.saveView(), "browser-add");
    }
    if (category("Origin", -1)) {
      const st = settings.value;
      const eyeRow = (label: string, icon: IconName, on: boolean, flip: () => void) => {
        const li = this.simpleRow(icon, label, flip, on ? "" : " hidden-item");
        const eye = el("button", "icon-btn");
        eye.title = on ? "Hide" : "Show";
        eye.innerHTML = icons[on ? "eye" : "eyeOff"];
        eye.addEventListener("click", (e) => (e.stopPropagation(), flip()));
        li.prepend(eye);
      };
      eyeRow("Axes (X, Y, Z)", "axis", st.showAxes, () => settings.set("showAxes", !settings.value.showAxes));
      for (const id of ["XY", "XZ", "YZ"]) {
        const on = st.showOriginPlanes && st.originPlanes[id] !== false;
        eyeRow(`${id} plane`, "plane", on, () => {
          const now = settings.value;
          const shown = now.showOriginPlanes && now.originPlanes[id] !== false;
          const next = { ...now.originPlanes, [id]: !shown };
          settings.set("originPlanes", next);
          settings.set("showOriginPlanes", Object.values(next).some((x) => x));
        });
      }
    }

    for (const [title, list] of Object.entries(rows)) {
      const loose = list.filter((r) => !inFolder.has(r.id));
      if (title !== "Bodies" && !loose.length) continue;
      if (!category(title, loose.length)) continue;
      if (!loose.length) this.list.append(el("li", "items-empty", bodies.length ? "All in folders" : "No bodies yet"));
      for (const r of loose) this.row(r, hidden, 0);
    }

    // Folders last, each with its subfolders and then what it holds.
    const ids = new Set(this.folders.map((f) => f.id));
    const top = this.folders.filter((f) => !f.parent || !ids.has(f.parent));
    const subs = (f: ItemFolder) => this.folders.filter((x) => x.parent === f.id && x.id !== f.id);
    const rowsOf = (f: ItemFolder) => f.items.map((id) => byId.get(id)).filter((r): r is Row => !!r);
    const allRows = (f: ItemFolder, seen = new Set<string>()): Row[] => {
      if (seen.has(f.id)) return [];
      seen.add(f.id);
      return [...rowsOf(f), ...subs(f).flatMap((s) => allRows(s, seen))];
    };
    const drawFolder = (f: ItemFolder, depth: number, seen: Set<string>) => {
      if (seen.has(f.id)) return;
      seen.add(f.id);
      this.folderRow(f, allRows(f), hidden, depth);
      if (this.collapsed.has(f.id)) return;
      for (const s of subs(f)) drawFolder(s, depth + 1, seen);
      for (const r of rowsOf(f)) this.row(r, hidden, depth + 1);
    };
    if (top.length) section(`Folders (${top.length})`);
    const drawn = new Set<string>();
    for (const f of top) drawFolder(f, 0, drawn);

    // Grouping bar: for the ticked items - or, nothing ticked, for two or more selected ones (rows lit by plain
    // clicks look the same as ticked ones, and offered nothing). Once used, not again for the same selection.
    const lit = !this.checked.size && !this.picking ? [...this.selectedIds].filter((id) => byId.has(id)) : [];
    this.selKey = lit.join("|");
    const group = this.checked.size ? [...this.checked] : lit.length >= 2 && this.selKey !== this.used ? lit : [];
    this.grouped = group;
    if (!group.length) this.moving = false;
    if (group.length) {
      const bar = el("li", "items-groupbar");
      // All ticked items in the same folder: the new folder goes inside it.
      const homes = new Set(group.map((id) => this.folders.find((f) => f.items.includes(id))?.id ?? ""));
      const parent = homes.size === 1 ? [...homes][0] || undefined : undefined;
      const make = el("button", "text-btn primary", `${parent ? "New subfolder" : "New folder"} (${group.length})`);
      make.addEventListener("click", () => void this.makeFolder(parent));
      // (No Clear: Select at the top again clears the ticks.)
      bar.append(make);
      // Ticked items that are in a folder: Remove takes them out - one level up
      // (into the folder around a subfolder), or back among the loose ones.
      const filed = group.filter((id) => inFolder.has(id));
      if (filed.length) {
        const remove = el("button", "text-btn", `Remove (${filed.length})`);
        remove.title = "Take the ticked items out of their folders";
        remove.addEventListener("click", () => {
          this.spent();
          this.store.commit((d) => {
            const fs = d.folders ?? [];
            const up = new Map<string, string[]>();
            for (const f of fs) {
              const out = f.items.filter((x) => filed.includes(x));
              if (out.length && f.parent && fs.some((p) => p.id === f.parent)) up.set(f.parent, [...(up.get(f.parent) ?? []), ...out]);
            }
            d.folders = fs.map((f) => ({ ...f, items: [...f.items.filter((x) => !filed.includes(x)), ...(up.get(f.id) ?? [])] }));
          });
        });
        bar.append(remove);
      }
      // Move: then tick the folder (or subfolder) they go into.
      if (this.folders.length) {
        const move = el("button", `text-btn${this.moving ? " primary" : ""}`, this.moving ? "Cancel move" : `Move (${group.length})`);
        move.title = "Move the ticked items into another folder";
        move.addEventListener("click", () => ((this.moving = !this.moving), this.render(this.last)));
        bar.append(move);
        if (this.moving) bar.append(el("span", "items-groupbar-hint", "Tick the folder to move them into."));
      }
      this.list.append(bar);
    } else if (this.picking) {
      this.list.append(el("li", "items-empty", "Tick items, then make a folder of them."));
    }
  }

  /** A row of the project's own branches: an icon and a name (a tap does `run`), and room for buttons after. */
  private simpleRow(icon: IconName, name: string, run?: () => void, extra = ""): HTMLElement {
    const li = el("li", `items-row browser-row${extra}`);
    const label = el("button", "items-name");
    label.innerHTML = icons[icon] ?? "";
    label.append(name);
    if (run) label.addEventListener("click", run);
    li.append(label);
    this.list.append(li);
    return li;
  }

  private row(r: Row, hidden: Set<string>, depth: number): void {
    const li = el("li", `items-row${hidden.has(r.id) ? " hidden-item" : ""}${r.extra ?? ""}${this.checked.has(r.id) ? " checked" : ""}${depth ? " in-folder" : ""}`);
    // Deeper in subfolders: a step further in each level.
    if (depth > 1) li.style.paddingLeft = `${18 * depth}px`;
    if (this.picking) {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "items-check";
      box.checked = this.checked.has(r.id);
      box.addEventListener("change", () => this.check(r.id, box.checked));
      li.append(box);
    }
    const eye = el("button", "icon-btn");
    eye.title = hidden.has(r.id) ? "Show" : "Hide";
    eye.innerHTML = icons[hidden.has(r.id) ? "eyeOff" : "eye"];
    eye.addEventListener("click", (e) => {
      e.stopPropagation();
      this.store.commit((d) => (d.hidden = hidden.has(r.id) ? d.hidden.filter((x) => x !== r.id) : [...d.hidden, r.id]));
    });
    const label = el("button", "items-name");
    label.innerHTML = icons[r.icon];
    label.append(r.name);
    // Ctrl/Cmd/Shift+click ticks the row for grouping; a plain click opens it.
    label.addEventListener("click", (e) => (e.ctrlKey || e.metaKey || e.shiftKey || this.picking ? this.check(r.id, !this.checked.has(r.id)) : r.open()));
    const ren = el("button", "icon-btn");
    ren.title = "Rename";
    ren.innerHTML = icons.rename;
    ren.addEventListener("click", (e) => (e.stopPropagation(), this.h.rename(r.id, r.name, !!r.isBody)));
    const del = el("button", "icon-btn");
    del.title = "Delete";
    del.innerHTML = icons.trash;
    twoTap(del, `items:${r.id}`, () => r.remove());
    li.append(eye, label, ren, del);
    li.dataset.id = r.id;
    li.classList.toggle("selected", this.selectedIds.has(r.id));
    li.classList.toggle("flash", this.revealed.has(r.id));
    this.list.append(li);
  }

  /**
   * Reveal in Items: the panel opens, the folders and headings holding the
   * rows unfold, and the first is scrolled to. The rows pulse until the
   * next thing done (a tap anywhere, a key).
   */
  private revealed = new Set<string>();
  private unreveal: (() => void) | null = null;
  reveal(ids: string[]): void {
    this.toggle(true);
    const want = new Set(ids);
    this.unreveal?.();
    this.revealed = want;
    const stop = () => {
      this.unreveal = null;
      this.revealed = new Set();
      removeEventListener("pointerdown", stop, true);
      removeEventListener("keydown", stop, true);
      for (const li of this.list.querySelectorAll<HTMLElement>("li.flash")) li.classList.remove("flash");
    };
    this.unreveal = stop;
    // (After the tap that asked for it has ended.)
    setTimeout(() => {
      if (this.unreveal !== stop) return;
      addEventListener("pointerdown", stop, true);
      addEventListener("keydown", stop, true);
    });
    const byId = new Map(this.folders.map((f) => [f.id, f]));
    for (const f of this.folders)
      if (f.items.some((i) => want.has(i))) for (let g: ItemFolder | undefined = f; g; g = g.parent ? byId.get(g.parent) : undefined) this.collapsed.delete(g.id);
    this.render(this.last);
    const find = () => [...this.list.querySelectorAll<HTMLElement>("li[data-id]")].find((li) => want.has(li.dataset.id!));
    let li = find();
    if (!li) {
      // Under a heading folded away: the headings open.
      for (const k of [...this.collapsed]) if (k.startsWith("cat:")) this.collapsed.delete(k);
      this.render(this.last);
      li = find();
    }
    for (const r of this.list.querySelectorAll<HTMLElement>("li[data-id]")) r.classList.toggle("flash", want.has(r.dataset.id!));
    li?.scrollIntoView({ block: "center" });
  }

  /** The items the grouping bar is for (ticked, or selected), and the selection it was last used on. */
  private grouped: string[] = [];
  private selKey = "";
  private used = "";
  private spent(): void {
    // Made of the selection, not of ticks: those items are let go (each click in the list adds to the selection,
    // and the next folder would have taken these along).
    const lit = !this.checked.size;
    this.checked.clear();
    this.used = this.selKey;
    if (lit) this.h.deselect();
  }

  /** What's selected in the view (a body double-clicked, a plane…): its row lights up. */
  private selectedIds = new Set<string>();
  markSelected(ids: string[]): void {
    const next = new Set(ids);
    if (next.size === this.selectedIds.size && ids.every((id) => this.selectedIds.has(id))) return;
    this.selectedIds = next;
    let first: HTMLElement | null = null;
    for (const li of this.list.querySelectorAll<HTMLElement>("li[data-id]")) {
      const on = next.has(li.dataset.id!);
      li.classList.toggle("selected", on);
      if (on && !first) first = li;
    }
    // Scrolled out of sight in a long list: brought into view.
    if (first && !this.el.hidden) first.scrollIntoView({ block: "nearest" });
    // Two or more selected, or no longer: the grouping bar comes or goes.
    if (!this.checked.size && (next.size >= 2 || this.grouped.length)) this.render(this.last);
  }

  /** A folder's row; `items` is everything in it, its subfolders' too. */
  private folderRow(f: ItemFolder, items: Row[], hidden: Set<string>, depth = 0): void {
    const li = el("li", `items-row folder-row${depth ? " in-folder" : ""}${this.moving ? " move-target" : ""}`);
    if (depth > 1) li.style.paddingLeft = `${18 * depth}px`;
    // Moving: tick this folder to put the ticked items in it.
    if (this.moving) {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "items-check";
      box.title = `Move into ${f.name}`;
      box.addEventListener("change", () => this.moveInto(f.id));
      li.append(box);
    }
    const allHidden = items.length > 0 && items.every((r) => hidden.has(r.id));
    const eye = el("button", "icon-btn");
    eye.title = allHidden ? "Show all in folder" : "Hide all in folder";
    eye.innerHTML = icons[allHidden ? "eyeOff" : "eye"];
    eye.addEventListener("click", () =>
      this.store.commit((d) => {
        const ids = new Set(items.map((r) => r.id));
        d.hidden = allHidden ? d.hidden.filter((x) => !ids.has(x)) : [...new Set([...d.hidden, ...ids])];
      }),
    );
    const label = el("button", "items-name");
    label.innerHTML = icons.folder;
    label.append(f.name, el("span", "items-count", ` ${items.length}`), el("span", "items-caret", this.collapsed.has(f.id) ? " ▸" : " ▾"));
    label.title = "Show / hide its contents";
    label.addEventListener("click", () => {
      if (this.collapsed.has(f.id)) this.collapsed.delete(f.id);
      else this.collapsed.add(f.id);
      this.render(this.last);
    });
    const ren = el("button", "icon-btn");
    ren.title = "Rename folder";
    ren.innerHTML = icons.rename;
    ren.addEventListener("click", async () => {
      const name = await this.h.askName("Rename folder", f.name);
      if (name) this.store.commit((d) => (d.folders = (d.folders ?? []).map((x) => (x.id === f.id ? { ...x, name } : x))));
    });
    const del = el("button", "icon-btn");
    del.title = "Remove folder (keeps what's in it)";
    del.innerHTML = icons.trash;
    // What it held - items and subfolders - moves up to where it was.
    twoTap(del, `folder:${f.id}`, () =>
      this.store.commit((d) => {
        const fs = d.folders ?? [];
        const parent = f.parent && fs.some((p) => p.id === f.parent) ? f.parent : undefined;
        d.folders = fs
          .filter((x) => x.id !== f.id)
          .map((x) => (x.id === parent ? { ...x, items: [...x.items, ...f.items] } : x.parent === f.id ? { ...x, parent } : x));
      }),
    );
    li.append(eye, label, ren, del);
    this.list.append(li);
  }

  /** The ticked items into folder `id` (out of whichever folder they were in). */
  private moveInto(id: string): void {
    const ids = [...this.grouped];
    this.spent();
    this.moving = false;
    this.store.commit((d) => (d.folders = (d.folders ?? []).map((f) => ({ ...f, items: f.id === id ? [...f.items.filter((x) => !ids.includes(x)), ...ids] : f.items.filter((x) => !ids.includes(x)) }))));
  }

  private check(id: string, on: boolean): void {
    if (on) this.checked.add(id);
    else this.checked.delete(id);
    this.render(this.last);
  }

  /** A folder of the ticked items; `parent`: inside that folder (a subfolder). */
  private async makeFolder(parent?: string): Promise<void> {
    const ids = [...this.grouped];
    const name = await this.h.askName(parent ? "New subfolder" : "New folder", `Folder ${this.folders.length + 1}`);
    if (!name) return;
    this.spent();
    this.picking = false;
    document.getElementById("items-pick")!.classList.remove("on");
    // An item lives in one folder at a time.
    this.store.commit((d) => {
      const rest = (d.folders ?? []).map((f) => ({ ...f, items: f.items.filter((x) => !ids.includes(x)) }));
      d.folders = [...rest, { id: `folder-${Date.now().toString(36)}`, name, items: ids, ...(parent ? { parent } : {}) }];
    });
  }
}

/** Each kind of construction plane's icon (its mark big, the plane small). */
/** Each kind of axis's icon (an axis from before they were told apart: the plain one). */
const AXIS_ICON: Record<string, IconName> = { face: "axisFace", edge: "axisEdge", round: "axisRound", "2pt": "axis2pt", planes: "axisPlanes" };

const PLANE_ICON: Record<string, IconName> = { offset: "planeOffset", mid: "planeMid", "3pt": "plane3pt", curve: "planeCurve", perp: "planePerp", angle: "planeAngle", parallel: "planeParallel" };
