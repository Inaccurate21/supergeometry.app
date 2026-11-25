// The app's look (Settings → Theme): dark (as it was made), light (white), or
// black (AMOLED: true black, the screen's pixels off). Kept on this device;
// the app reloads in it. Light turns the panels and buttons over with a
// filter (src/style.css) and gives the 3D view its own light colours here.

export type Theme = "dark" | "light" | "amoled";
export const THEMES: [Theme, string][] = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["amoled", "Black (AMOLED)"],
];

const KEY = "supergeometry.theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark" || v === "light" || v === "amoled") return v;
  } catch {
    // none kept
  }
  return "dark";
}

export const theme: Theme = read();

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // not kept
  }
}

/** The 3D view's colours in this theme. */
export const SCENE = {
  background: theme === "light" ? 0xeef0f3 : theme === "amoled" ? 0x000000 : 0x2b2d31,
  /** The grid's lines (0..1 grey). */
  grid: theme === "light" ? 0.32 : 0.78,
  sketch: theme === "light" ? 0x2a2d33 : 0xe8e8e8,
  sketchStrong: theme === "light" ? 0x000000 : 0xffffff,
};

if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f4f5f7" : theme === "amoled" ? "#000000" : "#1f2125");
}
