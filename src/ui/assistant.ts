// The Claude button, bottom right, on a computer: model by asking. Claude's browser extension works in this tab -
// it reads public/llms.txt and builds with the page's `sg` handle while the person watches.
//
// What a page may and may not do (Chrome's rules, not ours): it cannot open another extension's panel, and it cannot
// tell whether one is installed (the extension answers only to its maker's own site). So the button opens a card that
// says how: get the extension, open it (its own shortcut), and paste a request that this card writes - the request
// is what tells the assistant where its instructions are.

import { isHeadset, isTouchDevice } from "../device";
import { icons } from "./icons";
import { el } from "./ui";

const STORE = "https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn";
const SPARK = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2l2.2 6.6a2 2 0 0 0 1.2 1.2L22 12l-6.6 2.2a2 2 0 0 0-1.2 1.2L12 22l-2.2-6.6a2 2 0 0 0-1.2-1.2L2 12l6.6-2.2a2 2 0 0 0 1.2-1.2z"/></svg>`;

/** What is pasted to the assistant: where its instructions are, how to work here, and what to make. */
export function assistantRequest(what: string): string {
  const make = what.trim() || "(say here what you want made)";
  return [
    "You are working in superGeometry.app, the 3D CAD app open in this tab.",
    "First read its instructions for AI assistants: run `await (await fetch('/llms.txt')).text()` in this page (or open https://supergeometry.app/llms.txt).",
    "Then build the model here, in this tab, with the page's `sg` handle as its \"Driving the app\" part says: load the steps with `sg.load`, wait with `sg.idle`, and check `sg.state().errors` and `sg.health()` after every change. Do not write me a file to open.",
    "",
    `Make this: ${make}`,
  ].join("\n");
}

/** A computer with a mouse: the only place the extension exists. */
const onComputer = () => !isTouchDevice && !isHeadset && typeof matchMedia !== "undefined" && matchMedia("(pointer: fine) and (min-width: 900px)").matches;

export function initAssistant(toast: (text: string) => void): void {
  if (!onComputer() || document.getElementById("ai-btn")) return;
  const btn = el("button", "ai-btn");
  btn.id = "ai-btn";
  btn.type = "button";
  btn.title = "Model with Claude: say what you want and it builds it here";
  btn.innerHTML = `${SPARK}<span>Claude</span>`;
  btn.addEventListener("click", () => showAssistant(toast));
  document.body.append(btn);
}

function showAssistant(toast: (text: string) => void): void {
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

  const mac = /Mac/i.test(navigator.platform);
  const chromium = /Chrome\//.test(navigator.userAgent);
  const body = el("div", "ai-body");
  body.append(el("p", "", "Say what you want and Claude builds it in this tab while you watch. Then ask for changes, or change it yourself: every step is in History."));
  if (!chromium) body.append(el("p", "ai-warn", "This needs the Chrome browser: Claude's extension is made for Chrome."));

  const step = (n: number, title: string, ...more: (HTMLElement | string)[]) => {
    const row = el("div", "ai-step");
    row.append(el("div", "ai-n", String(n)));
    const text = el("div", "ai-text");
    text.append(el("b", "", title), ...more);
    row.append(text);
    return row;
  };
  const get = el("a", "text-btn primary ai-get", "Get Claude for Chrome");
  get.href = STORE;
  get.target = "_blank";
  get.rel = "noopener";
  const keys = el("span", "");
  keys.innerHTML = ` Press <kbd>${mac ? "⌘" : "Ctrl"}</kbd> + <kbd>E</kbd>, or click the Claude icon in Chrome's toolbar.`;
  const what = el("textarea", "ai-what");
  what.rows = 3;
  what.placeholder = "A bracket 60 x 40 x 6 with rounded corners and four M4 holes";
  what.spellcheck = false;
  const copy = el("button", "text-btn primary", "Copy the request");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const text = assistantRequest(what.value);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // (No clipboard permission: the old way.)
      const t = el("textarea", "");
      t.value = text;
      document.body.append(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    toast("Copied. Paste it into Claude's panel.");
    copy.textContent = "Copied";
    setTimeout(() => (copy.textContent = "Copy the request"), 1600);
  });
  const ask = el("div", "ai-ask");
  ask.append(what, copy);
  body.append(
    step(1, "Get the extension", " Skip this if you have it. ", get),
    step(2, "Open Claude", keys),
    step(3, "Say what to make", " Write it here, copy, and paste it into Claude's panel. The request tells Claude how this app works.", ask),
  );
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
  what.focus();
}
