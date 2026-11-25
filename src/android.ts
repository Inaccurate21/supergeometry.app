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

  // Where the phone's camera cutout is, in full screen: the buttons keep clear of it (CSS --native-safe-*).
  (window as unknown as { sgNativeInsets: (t: number, l: number, r: number, b: number, w: number) => void }).sgNativeInsets = (t, l, r, b, w) => {
    const k = (window.visualViewport?.width ?? innerWidth) / (w || innerWidth);
    const root = document.documentElement.style;
    root.setProperty("--native-safe-t", `${Math.round(t * k)}px`);
    root.setProperty("--native-safe-l", `${Math.round(l * k)}px`);
    root.setProperty("--native-safe-r", `${Math.round(r * k)}px`);
    root.setProperty("--native-safe-b", `${Math.round(b * k)}px`);
    window.dispatchEvent(new Event("resize"));
  };

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
