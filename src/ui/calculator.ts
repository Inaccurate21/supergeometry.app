// The calculator (the button at the left edge, or Measure's copy buttons): a small window beside the view that
// works out what is typed in it - numbers, + - * / ^ ( ), sqrt, sin, cos, tan, pi and the project's variables - with
// a list of values put into it (a measured length copied from Measure goes there and onto the clipboard). Its result
// can be copied, or put straight into the box of the app last typed in (a size, a distance), as Insert.
// Asked for: "a built-in calculator, with copying of values - a measured one and the calculator's own".

import { evaluate, trim } from "../units";
import { icons } from "./icons";
import { el } from "./ui";

/** A value put in from outside (Measure), kept in the list under the display. */
interface Kept {
  value: number;
  name: string;
}

let win: HTMLElement | null = null;
let display: HTMLInputElement | null = null;
let result: HTMLElement | null = null;
let list: HTMLElement | null = null;
const kept: Kept[] = [];
/** The app's box typed in last (not the calculator's own): where Insert puts the result. */
let lastBox: HTMLInputElement | null = null;
let at: { x: number; y: number } | null = null;
const onChange = new Set<(open: boolean) => void>();
/** How the app says something short (set by the app). */
let say: ((s: string) => void) | undefined;
export function setCalculatorToast(f: (s: string) => void): void {
  say = f;
}

document.addEventListener("focusin", (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && !t.closest(".calc") && (t.type === "text" || t.type === "number" || t.type === "" || t.inputMode === "decimal")) lastBox = t;
});

/** Copy text to the clipboard (and say so). */
export async function copyText(text: string, toast: ((s: string) => void) | undefined = say): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // (No clipboard here - an old browser, or no permission: a hidden box and the old way.)
    const t = document.createElement("textarea");
    t.value = text;
    document.body.append(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
  toast?.(`Copied: ${text}`);
}

/** The first number in a measured value's text ("Ø 35 mm" → 35). */
export function numberIn(text: string): number | null {
  const m = /-?\d+(?:[.,]\d+)?(?:e-?\d+)?/i.exec(text.replace(/\s/g, " "));
  return m ? parseFloat(m[0].replace(",", ".")) : null;
}

/** A window put just right of its button at the left edge (wherever that column is: beside the Browser when it is open). */
export function besideButton(w: HTMLElement, id: string): void {
  const b = document.querySelector(`[data-left="${id}"]`)?.getBoundingClientRect();
  if (!b || !b.width) return;
  const h = w.getBoundingClientRect().height;
  const top = Math.max(8, Math.min(window.innerHeight - h - 8, b.top + b.height / 2 - h / 2));
  const left = Math.min(window.innerWidth - w.getBoundingClientRect().width - 8, b.right + 8);
  Object.assign(w.style, { left: `${Math.max(8, left)}px`, top: `${top}px`, right: "auto", bottom: "auto", transform: "none" });
}

export function calculatorOpen(): boolean {
  return !!win;
}

export function onCalculator(f: (open: boolean) => void): void {
  onChange.add(f);
}

function current(): number | null {
  const t = display?.value.trim() ?? "";
  return t ? evaluate(t, "number") : null;
}

function update(): void {
  if (!result || !display) return;
  const v = current();
  result.textContent = display.value.trim() ? (v === null ? "…" : `= ${trim(v, 6)}`) : "";
  result.classList.toggle("bad", !!display.value.trim() && v === null);
}

function renderList(): void {
  if (!list) return;
  list.replaceChildren();
  for (const k of kept.slice(-6).reverse()) {
    const b = el("button", "calc-kept");
    b.title = "Put it into the calculation";
    b.append(el("span", "calc-kept-v", trim(k.value, 6)), el("span", "calc-kept-n", k.name));
    b.addEventListener("click", () => insertText(trim(k.value, 6)));
    list.append(b);
  }
  list.hidden = !kept.length;
}

function insertText(s: string): void {
  if (!display) return;
  const a = display.selectionStart ?? display.value.length;
  const b = display.selectionEnd ?? display.value.length;
  display.value = display.value.slice(0, a) + s + display.value.slice(b);
  display.setSelectionRange(a + s.length, a + s.length);
  display.focus();
  update();
}

/** Put a value in: into the list (and, with the window open, into the calculation where its cursor is). */
export function sendToCalculator(value: number, name: string): void {
  kept.push({ value, name });
  if (kept.length > 30) kept.shift();
  if (!win) openCalculator();
  renderList();
}

export function toggleCalculator(): void {
  if (win) closeCalculator();
  else openCalculator();
}

export function closeCalculator(): void {
  win?.remove();
  win = display = null;
  result = list = null;
  for (const f of onChange) f(false);
}

export function openCalculator(): void {
  if (win) return display?.focus();
  const toast = say;
  const w = el("div", "calc");
  const head = el("div", "calc-head");
  head.append(el("span", "", "Calculator"));
  const x = el("button", "calc-x");
  x.innerHTML = icons.close;
  x.title = "Close";
  x.addEventListener("click", closeCalculator);
  head.append(x);
  // Dragged by its title.
  head.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".calc-x")) return;
    const r = w.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    const move = (ev: PointerEvent) => {
      at = { x: Math.max(0, ev.clientX - ox), y: Math.max(0, ev.clientY - oy) };
      Object.assign(w.style, { left: `${at.x}px`, top: `${at.y}px`, right: "auto", bottom: "auto" });
    };
    const up = () => (window.removeEventListener("pointermove", move), window.removeEventListener("pointerup", up));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
  const d = document.createElement("input");
  d.className = "calc-display no-tr";
  d.inputMode = "decimal";
  d.placeholder = "e.g. 35/2 + 4";
  d.addEventListener("input", update);
  d.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") equals();
    if (e.key === "Escape") closeCalculator();
  });
  const r = el("div", "calc-result");
  const keys = el("div", "calc-keys");
  const equals = () => {
    const v = current();
    if (v === null) return;
    d.value = trim(v, 6);
    update();
  };
  const press = (k: string) => {
    if (k === "C") (d.value = ""), update();
    else if (k === "⌫") (d.value = d.value.slice(0, -1)), update();
    else if (k === "=") equals();
    else insertText(k === "√" ? "sqrt(" : k === "π" ? "pi" : k === "×" ? "*" : k === "÷" ? "/" : k);
    d.focus();
  };
  for (const k of ["C", "(", ")", "⌫", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "^", "+", "√", "π", "=", ""]) {
    if (!k) continue;
    const b = el("button", `calc-key${k === "=" ? " eq" : /[\d.]/.test(k) ? " num" : ""}`, k);
    b.addEventListener("pointerdown", (e) => e.preventDefault());
    b.addEventListener("click", () => press(k));
    if (k === "=") b.style.gridColumn = "span 2";
    keys.append(b);
  }
  const acts = el("div", "calc-acts");
  const copy = el("button", "calc-act", "Copy");
  copy.title = "Copy the result to the clipboard";
  copy.addEventListener("click", () => {
    const v = current();
    if (v !== null) void copyText(trim(v, 6), toast);
  });
  const ins = el("button", "calc-act", "Insert");
  ins.title = "Put the result into the box typed in last (a size, a distance)";
  ins.addEventListener("click", () => {
    const v = current();
    if (v === null || !lastBox || !lastBox.isConnected) return toast?.("Tap the box the value goes into first, then Insert");
    lastBox.focus();
    lastBox.value = trim(v, 6);
    lastBox.dispatchEvent(new Event("input", { bubbles: true }));
    lastBox.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const paste = el("button", "calc-act", "Paste");
  paste.title = "Paste a value from the clipboard";
  paste.addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      const n = numberIn(t);
      if (n !== null) insertText(trim(n, 6));
    } catch {
      toast?.("The clipboard can't be read here: paste with Ctrl+V in the box");
    }
  });
  acts.append(copy, paste, ins);
  const l = el("div", "calc-list");
  w.append(head, d, r, l, keys, acts);
  document.body.append(w);
  if (at) Object.assign(w.style, { left: `${at.x}px`, top: `${at.y}px`, right: "auto", bottom: "auto" });
  else besideButton(w, "calculator");
  win = w;
  display = d;
  result = r;
  list = l;
  renderList();
  update();
  for (const f of onChange) f(true);
  if (matchMedia("(pointer: fine)").matches) d.focus();
}
