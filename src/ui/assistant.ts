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
const SPARK = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2l2.2 6.6a2 2 0 0 0 1.2 1.2L22 12l-6.6 2.2a2 2 0 0 0-1.2 1.2L12 22l-2.2-6.6a2 2 0 0 0-1.2-1.2L2 12l6.6-2.2a2 2 0 0 0 1.2-1.2z"/></svg>`;

/** A computer with a mouse: the only place the extension exists. */
const onComputer = () => !isTouchDevice && !isHeadset && typeof matchMedia !== "undefined" && matchMedia("(pointer: fine) and (min-width: 900px)").matches;

export function initAssistant(): void {
  if (!onComputer() || document.getElementById("ai-btn")) return;
  const btn = el("button", "ai-btn");
  btn.id = "ai-btn";
  btn.type = "button";
  btn.title = "Model with Claude: say what you want and it builds it here";
  btn.innerHTML = `${SPARK}<span>Claude</span>`;
  btn.addEventListener("click", () => showAssistant());
  document.body.append(btn);
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

  const chromium = /Chrome\//.test(navigator.userAgent);
  const body = el("div", "ai-body");
  body.append(el("p", "", "Open Claude's extension (the Claude icon in Chrome's toolbar, or under the puzzle piece there) and tell it what you want made. It builds it in this tab while you watch. Then ask for changes, or change it yourself: every step is in History."));
  body.append(el("p", "", "The app is built so Claude needs only a few steps for each change, to keep your Claude usage low."));
  if (!chromium) body.append(el("p", "ai-warn", "This needs the Chrome browser: Claude's extension is made for Chrome."));
  const get = el("a", "text-btn primary ai-get", "Get Claude for Chrome");
  get.href = STORE;
  get.target = "_blank";
  get.rel = "noopener";
  const have = el("p", "ai-text", "Don't have it yet?");
  have.append(get);
  body.append(have);
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
