// In the Android app (android/): what the app's window adds to the page.
// - A pen hovering over the screen, passed on by the app (sgNativeHover):
//   given to the page as the pen's pointer moving, so snap marks show.
// - Files the page saves (a link with a download name to data made in the
//   page): handed to the app, which puts them in Downloads.

interface Native {
  saveFile(name: string, mime: string, base64: string): void;
}

const native = (window as unknown as { SGAndroid?: Native }).SGAndroid;

async function save(href: string, name: string): Promise<void> {
  const blob = await (await fetch(href)).blob();
  const b64 = await new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });
  native!.saveFile(name || "file", blob.type || "application/octet-stream", b64);
}

const isMade = (a: HTMLAnchorElement) => a.hasAttribute("download") && /^(blob:|data:)/.test(a.href);

if (native) {
  document.documentElement.classList.add("android-app");
  // Made in the page and clicked from the code (exports, Save, the report)…
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (!isMade(this)) return click.call(this);
    void save(this.href, this.download).catch((e) => console.error("Saving failed", e));
  };
  // …or tapped.
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !isMade(a)) return;
      e.preventDefault();
      void save(a.href, a.download).catch((err) => console.error("Saving failed", err));
    },
    true,
  );

  // Where the phone's edges and its camera's hole are, in full screen (in the app's pixels, with its width).
  // The top bar stays at the very top, with a gap where the camera is: the button that would run into the hole,
  // and those after it, move along to clear it. In the page's own pixels, so the interface size counts.
  let insets: number[] | null = null;
  const bar = () => document.getElementById("topbar");
  const PAD = 10;
  const clearHole = () => {
    const b = bar();
    if (!b) return;
    b.querySelector(":scope > .hole-gap")?.remove();
    b.style.removeProperty("--hole-shift");
    const nm = b.querySelector<HTMLElement>(".project-name");
    if (nm) nm.style.maxWidth = nm.style.minWidth = "";
    const br = b.querySelector<HTMLElement>(".brand");
    if (br) br.style.display = "";
    if (!insets) return;
    const [, , , , w, hl, , hr, hb] = insets;
    if (!(hr > hl)) return;
    const k = (window.visualViewport?.width ?? innerWidth) / (w || innerWidth);
    const left = hl * k;
    const right = hr * k;
    const centre = (left + right) / 2;
    if (b.getBoundingClientRect().top >= hb * k) return;
    // Between which two buttons the gap goes: the pair nearest the hole (File | Items with the camera in the
    // middle) whose bar still fits on the screen, else the one that sticks out least.
    const kids = ([...b.children] as HTMLElement[]).filter((c) => c.getBoundingClientRect().width > 0);
    const order: number[] = [];
    for (let i = 1; i < kids.length; i++) order.push(i);
    const mid = (i: number) => (kids[i - 1].getBoundingClientRect().right + kids[i].getBoundingClientRect().left) / 2;
    order.sort((x, y) => Math.abs(mid(x) - centre) - Math.abs(mid(y) - centre));
    const name = b.querySelector<HTMLElement>(".project-name");
    const brand = b.querySelector<HTMLElement>(".brand");
    const vw = window.visualViewport?.width ?? innerWidth;
    const gap = document.createElement("span");
    gap.className = "hole-gap";
    gap.style.cssText = `flex:none;width:${Math.round(right - left + 2 * PAD)}px;height:1px`;
    /** The gap before kids[at], the bar moved under the hole, the name narrowed (the icon hidden) to fit: how far it still sticks out. */
    const fit = (at: number) => {
      if (name) name.style.maxWidth = name.style.minWidth = "";
      if (brand) brand.style.display = "";
      kids[at].before(gap);
      let over = 0;
      // (The name stops getting narrower at its padding: then the icon goes.)
      let lastName = Infinity;
      for (let i = 0; i < 8; i++) {
        b.style.setProperty("--hole-shift", "0px");
        const g = gap.getBoundingClientRect();
        b.style.setProperty("--hole-shift", `${Math.round(centre - (g.left + g.right) / 2)}px`);
        const r = b.getBoundingClientRect();
        over = Math.max(0, 6 - r.left, r.right - (vw - 6));
        if (!over) break;
        const nw = name?.getBoundingClientRect().width ?? 0;
        if (name && nw > 26 && nw < lastName - 1) {
          lastName = nw;
          name.style.minWidth = "0";
          name.style.maxWidth = `${Math.max(24, nw - 2 * over)}px`;
        } else if (brand && brand.style.display !== "none") brand.style.display = "none";
        else break;
      }
      return over;
    };
    let best = -1;
    let bestOver = Infinity;
    for (const at of order) {
      const o = fit(at);
      if (o < bestOver) (bestOver = o), (best = at);
      if (!o) return;
    }
    if (best >= 0) fit(best);
  };
  const apply = () => {
    if (!insets) return;
    const [t, l, r, b, w, hl, , hr] = insets;
    const k = (window.visualViewport?.width ?? innerWidth) / (w || innerWidth);
    const root = document.documentElement.style;
    // A hole at the top: the bar goes up beside it (no room left above the bar); else below the cutout.
    root.setProperty("--native-safe-t", `${hr > hl ? 0 : Math.round(t * k)}px`);
    root.setProperty("--native-safe-l", `${Math.round(l * k)}px`);
    root.setProperty("--native-safe-r", `${Math.round(r * k)}px`);
    root.setProperty("--native-safe-b", `${Math.round(b * k)}px`);
    requestAnimationFrame(clearHole);
  };
  (window as unknown as { sgNativeInsets: (...v: number[]) => void }).sgNativeInsets = (...v) => {
    insets = v;
    apply();
    window.dispatchEvent(new Event("resize"));
  };
  // The interface's size or the bar's buttons changed (a longer project name): cleared again.
  window.addEventListener("resize", () => requestAnimationFrame(apply));
  window.visualViewport?.addEventListener("resize", () => requestAnimationFrame(apply));
  const watch = () => {
    const b = bar();
    if (!b) return void setTimeout(watch, 500);
    // (Its width changes with the gap itself: only a change of the screen's width re-does it.)
    let width = innerWidth;
    new ResizeObserver(() => {
      if (innerWidth === width) return;
      width = innerWidth;
      requestAnimationFrame(clearHole);
    }).observe(b);
    new MutationObserver((list) => {
      if (list.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => (n as Element).classList?.contains("hole-gap")) && m.type === "childList")) return;
      requestAnimationFrame(clearHole);
    }).observe(b, { childList: true, subtree: true, characterData: true });
  };
  watch();

  let over: Element | null = null;
  (window as unknown as { sgNativeHover: (x: number | null, y?: number, w?: number) => void }).sgNativeHover = (x, y, w) => {
    const vv = window.visualViewport;
    if (x === null || y === undefined || !w) {
      over?.dispatchEvent(new PointerEvent("pointerleave", { pointerId: 77, pointerType: "pen", bubbles: false }));
      over = null;
      return;
    }
    // The app's pixels to the page's: its width is the visible part of the page.
    const k = (vv?.width ?? innerWidth) / w;
    const cx = x * k + (vv?.offsetLeft ?? 0);
    const cy = y * k + (vv?.offsetTop ?? 0);
    const target = document.elementFromPoint(cx, cy);
    if (!target) return;
    over = target;
    target.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, pointerType: "pen", isPrimary: true, clientX: cx, clientY: cy, buttons: 0, button: -1, bubbles: true, cancelable: true }));
  };
}
