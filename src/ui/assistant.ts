// The Claude button, bottom right, on a computer: model by asking. Claude's browser extension works in this tab -
// it reads public/llms.txt and builds with the page's `sg` handle while the person watches.
//
// What a page may and may not do (Chrome's rules, not ours): it cannot open another extension's panel, and it cannot
// tell whether one is installed (the extension answers only to its maker's own site). So the button opens a card that
// says where the extension is and where to get it, and no more. What tells the assistant
// how to work here is in the page itself: the text in index.html's <main>, which is what an assistant reading the
// page gets.

import { isHeadset, isTouchDevice } from "../device";
import { icons } from "./icons";
import { el } from "./ui";

const STORE = "https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn";
// Claude's mark, as its extension's button shows it in the browser's toolbar - so the picture in the card shows what
// to look for. The mark is Anthropic's (a trademark of theirs, used here only to point at their extension); it is not
// part of this app's licence.
const CLAUDE_MARK = `<svg class="ai-mark" viewBox="125 86 480 514" width="16" height="16" aria-hidden="true"><path fill="#D97757" d="M189.531 430.72L288.951 374.971L290.59 370.088L288.951 367.369H284.035L267.374 366.355L210.562 364.835L161.399 362.807L113.6 360.273L101.583 357.739L90.3843 342.788L91.4768 335.439L101.583 328.597L116.059 329.864L148.015 332.145L196.086 335.439L230.774 337.467L282.396 342.788H290.59L291.682 339.494L288.951 337.467L286.766 335.439L237.056 301.736L183.249 266.259L155.117 245.733L140.094 235.344L132.447 225.714L129.169 204.428L142.826 189.223L161.399 190.491L166.042 191.758L184.888 206.202L225.038 237.371L277.48 275.889L285.127 282.224L288.207 280.145L288.678 278.676L285.127 272.848L256.722 221.406L226.404 168.951L212.747 147.158L209.197 134.234C207.821 128.811 207.012 124.324 207.012 118.776L222.58 97.4901L231.32 94.7026L252.351 97.4901L261.092 105.092L274.202 134.994L295.233 181.875L328.009 245.733L337.569 264.739L342.758 282.224L344.67 287.545H347.948V284.505L350.679 248.521L355.595 204.428L360.512 147.665L362.15 131.7L370.071 112.441L385.913 102.051L398.204 107.88L408.31 122.324L406.944 131.7L400.935 170.725L389.19 231.796L381.543 272.848H385.913L391.102 267.526L411.86 240.158L446.548 196.572L461.843 179.341L479.87 160.335L491.342 151.212H513.192L529.034 175.033L521.932 199.613L499.536 227.995L480.963 252.068L454.332 287.747L437.808 316.434L439.29 318.8L443.271 318.461L503.359 305.537L535.862 299.709L574.647 293.12L592.127 301.229L594.039 309.592L587.211 326.57L545.695 336.706L497.077 346.589L424.68 363.632L423.878 364.277L424.824 365.68L457.473 368.636L471.403 369.396H505.545L569.184 374.211L585.845 385.107L595.678 398.538L594.039 408.927L568.365 421.851L533.95 413.742L453.376 394.483L425.79 387.641H421.966V389.922L444.909 412.475L487.245 450.486L539.959 499.647L542.69 511.811L535.862 521.44L528.761 520.427L482.328 485.456L464.302 469.745L423.878 435.535H421.147V439.083L430.433 452.767L479.87 527.015L482.328 549.822L478.778 557.171L465.94 561.732L452.011 559.198L422.786 518.399L393.014 472.786L368.979 431.734L366.076 433.567L351.771 586.312L345.216 594.168L329.921 599.996L317.084 590.367L310.255 574.656L317.084 543.487L325.278 502.941L331.833 470.759L337.842 430.72L341.511 417.345L341.187 416.45L338.255 416.943L308.07 458.342L262.184 520.427L225.858 559.198L217.117 562.746L202.095 554.89L203.461 540.953L211.928 528.536L262.184 464.677L292.502 424.892L312.042 402.055L311.851 398.751L310.773 398.659L177.24 485.71L153.478 488.751L143.099 479.121L144.464 463.41L149.381 458.342L189.531 430.72Z"/></svg>`;
const ICON = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const LOCK = ICON('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
const STAR = ICON('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z"/>');
const PUZZLE = ICON('<path d="M9 5a2 2 0 1 1 4 0v1h4a1 1 0 0 1 1 1v3h1a2 2 0 1 1 0 4h-1v4a1 1 0 0 1-1 1h-3v-1a2 2 0 1 0-4 0v1H6a1 1 0 0 1-1-1v-4H4a2 2 0 1 1 0-4h1V7a1 1 0 0 1 1-1h3z"/>');
const DOTS = ICON('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>');
const UP = ICON('<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>');

/** A computer with a mouse: the only place the extension exists. */
const onComputer = () => !isTouchDevice && !isHeadset && typeof matchMedia !== "undefined" && matchMedia("(pointer: fine) and (min-width: 900px)").matches;

export function initAssistant(): void {
  if (!onComputer() || document.getElementById("ai-btn")) return;
  const btn = el("button", "ai-btn");
  btn.id = "ai-btn";
  btn.type = "button";
  btn.title = "Model with Claude: say what you want and it builds it here";
  btn.innerHTML = `${CLAUDE_MARK}<span>Claude</span>`;
  btn.addEventListener("click", () => showAssistant());
  document.body.append(btn);
  besideHistory(btn);
}

/** History reaches this far down (from the bottom edge) before the button steps aside: its own height and gaps. */
export const AI_BUTTON_ROOM = 54;

/**
 * The button's corner is History's too, when History's list is long enough to come down to it: the button then
 * stands to the left of History, and goes back to the corner when History is shorter or closed. Looked at only when
 * History opens, closes or changes size, or the window does.
 */
function besideHistory(btn: HTMLElement): void {
  const history = document.getElementById("history");
  if (!history) return;
  // (Straight away, not on the next frame: these are told once per change as it is, and a frame may be long in coming.)
  const later = () => {
    const r = history.classList.contains("open") ? history.getBoundingClientRect() : null;
    const over = !!r && r.width > 0 && r.left > innerWidth / 2 && r.bottom > innerHeight - AI_BUTTON_ROOM;
    const to = over ? `${Math.round(innerWidth - r!.left + 10)}px` : "";
    if (btn.style.right !== to) btn.style.right = to;
  };
  new ResizeObserver(later).observe(history);
  // (Its rows as they come and go, too: the size is told only when the page next draws.)
  new MutationObserver(later).observe(history, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
  window.addEventListener("resize", later);
  later();
}

/**
 * Chrome or Edge: the browsers the extension is made for (its maker's pages name those two; other browsers built on
 * Chrome are said not to be supported, and there is none for Firefox or Safari). Told by the browser's own name
 * for itself, where it gives one - Brave, Opera, Vivaldi and Arc each look like Chrome by their user agent alone.
 */
function extensionBrowser(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] }; brave?: unknown };
  if (nav.brave) return false;
  // (Arc names itself only in a style it sets on every page.)
  if (getComputedStyle(document.documentElement).getPropertyValue("--arc-palette-title")) return false;
  const brands = nav.userAgentData?.brands?.map((b) => b.brand);
  if (brands?.length) return brands.includes("Google Chrome") || brands.includes("Microsoft Edge");
  // (No list of names: an older Chrome or Edge, by its user agent - with nothing of the others' in it.)
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/OPR\/|Vivaldi|YaBrowser|SamsungBrowser/.test(ua);
}

function showAssistant(): void {
  if (document.querySelector(".dialog.ai-card")) return;
  const back = el("div", "dialog-back");
  const box = el("div", "dialog ai-card");
  const head = el("div", "library-head");
  head.append(el("div", "panel-title", "Model with Claude"));
  const closeBtn = el("button", "icon-btn library-close");
  closeBtn.type = "button";
  closeBtn.title = "Close";
  closeBtn.innerHTML = icons.close;
  head.append(closeBtn);

  const supported = extensionBrowser();
  const body = el("div", "ai-body");
  body.append(el("p", "", "Open Claude's extension and tell it what you want made. It builds it in this tab while you watch. Then ask for changes, or change it yourself: every step is in History."));
  // Where the extension's button is: a small drawing of the top right of the browser's window, the button ringed.
  // (Drawn, not a screenshot: it is the same in every browser the extension runs in, and in the app's own colours.)
  const where = el("div", "ai-where");
  where.setAttribute("role", "img");
  where.setAttribute("aria-label", "Claude's button is at the top right of the browser, beside the puzzle piece.");
  where.innerHTML = `<div class="ai-bar"><span class="ai-url">${LOCK}<span>supergeometry.app</span></span><span class="ai-dim">${STAR}</span><span class="ai-ring">${CLAUDE_MARK}</span>${PUZZLE}<span class="ai-dim">${DOTS}</span></div><div class="ai-arrow">${UP}</div><div class="ai-here">Claude is here, at the top right of your browser</div>`;
  body.append(where);
  body.append(el("p", "dialog-note", "Not there? Click the puzzle piece next to it and pin Claude."));
  body.append(el("p", "", "New to the app? Ask Claude to teach you: it will guide you through it step by step while you do the tapping."));
  body.append(el("p", "", "The app is built so Claude needs only a few steps for each change, to keep your Claude usage low."));
  if (!supported) body.append(el("p", "ai-warn", "Claude's extension is made for Chrome and Edge. It is not made for this browser: open the app in one of those to use it."));
  const get = el("a", "text-btn primary ai-get", "Get Claude for Chrome");
  get.href = STORE;
  get.target = "_blank";
  get.rel = "noopener";
  const have = el("p", "ai-text", "Don't have it yet?");
  have.append(get);
  // (Only where it can be installed. There the page cannot tell whether it already is, so the way to get it is
  // always offered.)
  if (supported) body.append(have);
  body.append(el("p", "dialog-note", "Claude is made by Anthropic and needs its own account. It is not part of this app, and this app sends it nothing: Claude works in your browser, on what is in this tab."));

  box.append(head, body);
  back.append(box);
  const close = () => {
    back.remove();
    window.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") (e.preventDefault(), close());
    e.stopPropagation();
  };
  closeBtn.addEventListener("click", close);
  back.addEventListener("pointerdown", (ev) => ev.target === back && close());
  window.addEventListener("keydown", onKey, true);
  document.body.append(back);
}
