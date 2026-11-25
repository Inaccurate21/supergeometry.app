// Interface size (Settings → Interface size): on phones, tablets and in the
// Android app the whole page is drawn bigger or smaller - the page's viewport
// is scaled, so buttons, text and the model's handles all grow together and
// taps still land where they are drawn. A computer's browser has its own zoom
// for this (Ctrl + / Ctrl −), which the app already follows.

const KEY = "supergeometry.uiScale";
export const UI_SCALE_MIN = 0.6;
export const UI_SCALE_MAX = 1.8;

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    if (v >= UI_SCALE_MIN && v <= UI_SCALE_MAX) return v;
  } catch {
    // none kept
  }
  return 1;
}

let scale = read();

export function uiScale(): number {
  return scale;
}

/** A browser that follows the page's viewport (phones, tablets, the Android app): a computer's ignores it. */
export function uiScaleWorks(): boolean {
  return matchMedia("(pointer: coarse)").matches || "SGAndroid" in window || navigator.maxTouchPoints > 0;
}

function apply(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  const s = Math.round(scale * 100) / 100;
  meta.content =
    s === 1
      ? "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      : `width=device-width, initial-scale=${s}, minimum-scale=${s}, maximum-scale=${s}, user-scalable=no, viewport-fit=cover`;
}

export function setUiScale(s: number): void {
  scale = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(s * 100) / 100));
  try {
    localStorage.setItem(KEY, String(scale));
  } catch {
    // not kept
  }
  apply();
  // (Laid out again at the new size.)
  setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
}

if (typeof document !== "undefined") apply();
