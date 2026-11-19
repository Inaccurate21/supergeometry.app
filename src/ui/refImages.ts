// Reference images: pictures to look at while modelling (a drawing, a photo
// of the part), each in a window over everything else. A window is dragged by
// its top bar or its picture, resized from its corner, minimized to its bar
// (then dragged by its tabs) and closed. More
// pictures in one window are tabs along its top; a tab dragged out of the bar
// becomes a window of its own, and dropped on another window's bar it joins it.
// They are kept on this device (not in the project) until closed.

import { idbGet, idbSet } from "../doc/store";
import { icons } from "./icons";

interface Ref {
  name: string;
  src: string;
}

interface Win {
  el: HTMLElement;
  bar: HTMLElement;
  tabs: HTMLElement;
  img: HTMLImageElement;
  refs: Ref[];
  active: number;
  x: number;
  y: number;
  w: number;
  h: number;
  min: boolean;
}

interface Saved {
  x: number;
  y: number;
  w: number;
  h: number;
  min: boolean;
  active: number;
  refs: Ref[];
}

const KEY = "sg-ref-images";
/** Big enough to read a drawing, small enough to keep (a phone photo is 4000 px). */
const MAX = 2048;
const BAR = 34;
/** Where a window is among the others (higher: in front). */
const zOf = (w: Win) => +(w.el.style.getPropertyValue("--z") || 0);
const MIN_W = 160;
const MIN_H = 120;

const div = (cls: string) => {
  const d = document.createElement("div");
  d.className = cls;
  return d;
};
const button = (cls: string, icon: string, title: string) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.innerHTML = icon;
  b.title = title;
  b.setAttribute("aria-label", title);
  return b;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class RefImages {
  private wins: Win[] = [];
  /** The last window touched: a new picture goes in there as a tab. */
  private last: Win | null = null;
  private saveTimer = 0;
  private z = 0;

  constructor(private toast: (text: string, kind?: "info" | "error") => void) {
    void this.load();
    window.addEventListener("resize", () => this.wins.forEach((w) => this.fit(w, true)));
  }

  /** Pick one or more pictures; each opens as a tab of the last window used (or a new window). */
  async open(): Promise<void> {
    const files = await pickImages();
    if (!files.length) return;
    let win = this.last && this.wins.includes(this.last) ? this.last : null;
    for (const f of files) {
      const src = await readImage(f);
      if (!src) {
        this.toast(`${f.name} can't be shown here - save it as JPG or PNG first (an iPhone's HEIC photos too)`, "error");
        continue;
      }
      win = this.add(f.name.replace(/\.[^.]+$/, ""), src, win);
    }
  }

  /** A picture as a new tab of `win` (none: a new window); the window it is in. */
  add(name: string, src: string, win: Win | null = this.last && this.wins.includes(this.last) ? this.last : null): Win {
    const ref = { name, src };
    if (!win) win = this.make([ref], this.spot());
    else {
      win.refs.push(ref);
      win.active = win.refs.length - 1;
      win.min = false;
      this.draw(win);
    }
    this.front(win);
    this.save();
    return win;
  }

  // ------------------------------------------------------------- windows

  private spot(): { x: number; y: number; w: number; h: number } {
    const w = Math.min(360, innerWidth - 24);
    const h = Math.min(300, innerHeight - 120);
    const n = this.wins.length;
    return { x: clamp(innerWidth / 2 - w / 2 + n * 24, 8, innerWidth - w - 8), y: clamp(80 + n * 24, 8, innerHeight - h - 8), w, h };
  }

  private make(refs: Ref[], at: { x: number; y: number; w: number; h: number }, active = 0, min = false): Win {
    const el = div("ref-win");
    const bar = div("ref-bar");
    const tabs = div("ref-tabs");
    const add = button("ref-btn", icons.insert, "Add a picture");
    const fold = button("ref-btn", icons.minimize, "Minimize");
    const close = button("ref-btn", icons.close, "Close");
    bar.append(tabs, add, fold, close);
    const body = div("ref-body");
    const img = document.createElement("img");
    img.draggable = false;
    img.alt = "";
    const grip = div("ref-grip");
    body.append(img);
    el.append(bar, body, grip);
    document.body.append(el);
    const win: Win = { el, bar, tabs, img, refs, active, min, ...at };
    this.wins.push(win);

    el.addEventListener("pointerdown", () => this.front(win), true);
    add.addEventListener("click", () => ((this.last = win), void this.open()));
    fold.addEventListener("click", () => {
      win.min = !win.min;
      this.draw(win);
      this.save();
    });
    close.addEventListener("click", () => this.closeTab(win, win.active, true));
    this.dragBy(bar, win, (e) => !(e.target as HTMLElement).closest("button, .ref-tab"));
    // (The picture itself is a handle too: the bar is a small target, a finger's especially.)
    this.dragBy(body, win, () => true);
    this.resizeBy(grip, win);
    // (A double click on the bar minimizes or restores it, as the button does.)
    bar.addEventListener("dblclick", (e) => {
      if ((e.target as HTMLElement).closest("button, .ref-tab")) return;
      fold.click();
    });
    this.draw(win);
    this.front(win);
    return win;
  }

  private draw(win: Win): void {
    win.active = clamp(win.active, 0, win.refs.length - 1);
    win.el.classList.toggle("min", win.min);
    win.el.classList.toggle("single", win.refs.length === 1);
    const fold = win.bar.querySelectorAll(".ref-btn")[1] as HTMLElement;
    fold.innerHTML = win.min ? icons.restore : icons.minimize;
    fold.title = fold.ariaLabel = win.min ? "Restore" : "Minimize";
    const close = win.bar.querySelectorAll(".ref-btn")[2] as HTMLElement;
    close.title = win.refs.length > 1 ? "Close this picture" : "Close";
    win.tabs.replaceChildren(
      ...win.refs.map((r, i) => {
        const t = div(`ref-tab${i === win.active ? " on" : ""}`);
        t.textContent = r.name;
        t.title = r.name;
        this.tabDrag(t, win, i);
        return t;
      }),
    );
    const ref = win.refs[win.active];
    if (ref && win.img.getAttribute("src") !== ref.src) win.img.src = ref.src;
    this.fit(win);
  }

  /**
   * Kept on the screen: dragged, it may hang off an edge as long as some of
   * its bar can be reached; `whole` (the screen changed, or it came back after
   * a reload) brings it all in.
   */
  private fit(win: Win, whole = false): void {
    win.w = clamp(win.w, MIN_W, Math.max(MIN_W, innerWidth - 16));
    win.h = clamp(win.h, MIN_H, Math.max(MIN_H, innerHeight - 16));
    if (whole) {
      win.x = clamp(win.x, 8, Math.max(8, innerWidth - win.w - 8));
      win.y = clamp(win.y, 8, Math.max(8, innerHeight - (win.min ? BAR : win.h) - 8));
    }
    win.x = clamp(win.x, 8 - win.w + 80, innerWidth - 80);
    win.y = clamp(win.y, 0, innerHeight - BAR);
    const s = win.el.style;
    s.left = `${Math.round(win.x)}px`;
    s.top = `${Math.round(win.y)}px`;
    // (Minimized: just as wide as its tabs and the three buttons.)
    s.width = win.min ? "" : `${Math.round(win.w)}px`;
    s.height = win.min ? "" : `${Math.round(win.h)}px`;
  }

  private front(win: Win): void {
    this.last = win;
    win.el.style.setProperty("--z", String(++this.z));
  }

  private closeTab(win: Win, i: number, save: boolean): void {
    win.refs.splice(i, 1);
    if (!win.refs.length) {
      win.el.remove();
      this.wins = this.wins.filter((w) => w !== win);
      if (this.last === win) this.last = this.wins[this.wins.length - 1] ?? null;
    } else {
      if (win.active >= i) win.active = Math.max(0, win.active - 1);
      this.draw(win);
    }
    if (save) this.save();
  }

  // ------------------------------------------------------------- pointer

  /** Moved with the pointer, from a press on `handle` that `ok` accepts. */
  private dragBy(handle: HTMLElement, win: Win, ok: (e: PointerEvent) => boolean): void {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !ok(e)) return;
      e.preventDefault();
      const dx = e.clientX - win.x;
      const dy = e.clientY - win.y;
      handle.setPointerCapture(e.pointerId);
      const move = (m: PointerEvent) => {
        win.x = m.clientX - dx;
        win.y = m.clientY - dy;
        this.fit(win);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        this.save();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }

  private resizeBy(grip: HTMLElement, win: Win): void {
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const from = { x: e.clientX, y: e.clientY, w: win.w, h: win.h };
      grip.setPointerCapture(e.pointerId);
      const move = (m: PointerEvent) => {
        win.w = from.w + m.clientX - from.x;
        win.h = from.h + m.clientY - from.y;
        this.fit(win);
      };
      const up = () => {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
        grip.removeEventListener("pointercancel", up);
        this.save();
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
      grip.addEventListener("pointercancel", up);
    });
  }

  /**
   * A tab: a tap shows its picture; dragged, a ghost of it follows the
   * pointer. Let go on a window's bar, it joins that window (its own: moved
   * along it); let go anywhere else, it is a window of its own there (the only
   * tab of a window: the window goes there).
   */
  private tabDrag(tab: HTMLElement, win: Win, i: number): void {
    tab.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      tab.setPointerCapture(e.pointerId);
      // Minimized, its tabs are all there is of it: dragged, the window goes with them; a tap opens it.
      if (win.min) return this.moveMinimized(tab, win, i, e);
      const start = { x: e.clientX, y: e.clientY };
      const off = tab.getBoundingClientRect();
      let ghost: HTMLElement | null = null;
      const move = (m: PointerEvent) => {
        if (!ghost && Math.hypot(m.clientX - start.x, m.clientY - start.y) < 8) return;
        if (!ghost) {
          ghost = div("ref-tab on ref-ghost");
          ghost.textContent = tab.textContent;
          document.body.append(ghost);
          tab.classList.add("dragged");
        }
        ghost.style.left = `${m.clientX - (start.x - off.left)}px`;
        ghost.style.top = `${m.clientY - (start.y - off.top)}px`;
        const over = this.barAt(m.clientX, m.clientY);
        for (const w of this.wins) w.bar.classList.toggle("drop", w === over);
      };
      const up = (u: PointerEvent) => {
        tab.removeEventListener("pointermove", move);
        tab.removeEventListener("pointerup", up);
        tab.removeEventListener("pointercancel", cancel);
        for (const w of this.wins) w.bar.classList.remove("drop");
        if (!ghost) {
          win.active = i;
          win.min = false;
          this.draw(win);
          this.save();
          return;
        }
        ghost.remove();
        tab.classList.remove("dragged");
        this.dropTab(win, i, u.clientX, u.clientY, u.clientX - (start.x - off.left), u.clientY - (start.y - off.top));
      };
      const cancel = () => {
        tab.removeEventListener("pointermove", move);
        tab.removeEventListener("pointerup", up);
        tab.removeEventListener("pointercancel", cancel);
        ghost?.remove();
        tab.classList.remove("dragged");
        for (const w of this.wins) w.bar.classList.remove("drop");
      };
      tab.addEventListener("pointermove", move);
      tab.addEventListener("pointerup", up);
      tab.addEventListener("pointercancel", cancel);
    });
  }

  private moveMinimized(tab: HTMLElement, win: Win, i: number, e: PointerEvent): void {
    const start = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - win.x;
    const dy = e.clientY - win.y;
    let moved = false;
    const move = (m: PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - start.x, m.clientY - start.y) < 8) return;
      moved = true;
      win.x = m.clientX - dx;
      win.y = m.clientY - dy;
      this.fit(win);
    };
    const up = () => {
      tab.removeEventListener("pointermove", move);
      tab.removeEventListener("pointerup", up);
      tab.removeEventListener("pointercancel", up);
      if (!moved) {
        win.active = i;
        win.min = false;
        this.draw(win);
      }
      this.save();
    };
    tab.addEventListener("pointermove", move);
    tab.addEventListener("pointerup", up);
    tab.addEventListener("pointercancel", up);
  }

  /** The window whose bar is under the point (the one in front). */
  private barAt(x: number, y: number): Win | null {
    let best: Win | null = null;
    for (const w of this.wins) {
      const b = w.bar.getBoundingClientRect();
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom && (!best || zOf(w) > zOf(best))) best = w;
    }
    return best;
  }

  private dropTab(from: Win, i: number, x: number, y: number, gx: number, gy: number): void {
    const ref = from.refs[i];
    const to = this.barAt(x, y);
    if (to) {
      // Along a bar: before the tab it is dropped on (or at the end).
      const tabs = [...to.tabs.children] as HTMLElement[];
      let at = tabs.findIndex((t) => {
        const b = t.getBoundingClientRect();
        return x < b.left + b.width / 2;
      });
      if (at < 0) at = tabs.length;
      if (to === from) {
        if (at > i) at--;
        from.refs.splice(i, 1);
        from.refs.splice(at, 0, ref);
        from.active = at;
        this.draw(from);
      } else {
        this.closeTab(from, i, false);
        to.refs.splice(at, 0, ref);
        to.active = at;
        to.min = false;
        this.draw(to);
        this.front(to);
      }
      return this.save();
    }
    // Out in the open: a window of its own, its bar where the tab was let go.
    if (from.refs.length === 1) {
      from.x = gx - 6;
      from.y = gy - 4;
      this.fit(from);
      return this.save();
    }
    this.closeTab(from, i, false);
    this.make([ref], { x: gx - 6, y: gy - 4, w: from.w, h: from.h });
    this.save();
  }

  // ------------------------------------------------------------- kept

  private save(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      const all: Saved[] = this.wins
        .slice()
        .sort((a, b) => zOf(a) - zOf(b))
        .map((w) => ({ x: w.x / innerWidth, y: w.y / innerHeight, w: w.w, h: w.h, min: w.min, active: w.active, refs: w.refs }));
      void idbSet(KEY, JSON.stringify(all));
    }, 300);
  }

  private async load(): Promise<void> {
    try {
      const raw = await idbGet(KEY);
      const all = raw ? (JSON.parse(raw) as Saved[]) : [];
      for (const s of all) if (s.refs?.length) this.fit(this.make(s.refs, { x: s.x * innerWidth, y: s.y * innerHeight, w: s.w, h: s.h }, s.active, s.min), true);
    } catch {
      // nothing kept, or unreadable: start with none
    }
  }

  /** For checking from the console: the windows and their tabs. */
  describe(): { x: number; y: number; w: number; h: number; min: boolean; active: number; tabs: string[] }[] {
    return this.wins.map((w) => ({ x: Math.round(w.x), y: Math.round(w.y), w: Math.round(w.w), h: Math.round(w.h), min: w.min, active: w.active, tabs: w.refs.map((r) => r.name) }));
  }
}

function pickImages(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.click();
  });
}

/** The picture as a data URL, made smaller when it is huge (null: the browser can't show it). */
async function readImage(file: File): Promise<string | null> {
  let src = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const k = Math.min(1, MAX / Math.max(img.width, img.height));
  if (k < 1 || file.size > 2e6) {
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    src = file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
  }
  return src;
}
