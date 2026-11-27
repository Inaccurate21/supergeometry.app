// The page stays where it is. Nothing in the app scrolls the page itself - every window scrolls inside - but a
// phone's browser can still push the whole page along when a box takes the focus, to keep it clear of a keyboard.
// Our number boxes bring up no keyboard (the numpad is ours), and installed on an iPhone's home screen the page
// was left pushed down by the height of the status bar while touches still landed where things had been: a tap
// on the numpad's 2 typed the 0 under it (reported from an iPhone, the app installed).
//
// So: whenever the page is found scrolled, it is put back; and it is looked at when that can have happened - a
// box taking or losing the focus, the visible part of the page changing.

export function keepPageSteady(): void {
  const root = document.documentElement;
  const settle = () => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    if (root.scrollTop || root.scrollLeft) (root.scrollTop = 0), (root.scrollLeft = 0);
    if (document.body.scrollTop || document.body.scrollLeft) (document.body.scrollTop = 0), (document.body.scrollLeft = 0);
  };
  // (Now, once drawn, and once any sliding the browser does has ended.)
  const soon = () => {
    settle();
    requestAnimationFrame(settle);
    setTimeout(settle, 120);
    setTimeout(settle, 400);
  };
  window.addEventListener("scroll", settle, { passive: true });
  window.visualViewport?.addEventListener("scroll", settle);
  window.visualViewport?.addEventListener("resize", soon);
  document.addEventListener("focusin", soon);
  document.addEventListener("focusout", soon);
}

// ---------------------------------------------------------------- the page as tall as the screen
//
// An iPhone's home-screen app, iOS 26.1 and later, is laid out shorter than the screen by its status bar's height,
// yet drawn from the very top of the screen: a strip with nothing in it is left along the bottom, and whatever is
// pinned to the bottom floats that much too high (reported from an iPhone on iOS 27). It is the phone's own fault
// (WebKit bug 301994, open), and a page has no cure for it: it is not told that it is short - only the screen's
// own height gives it away. What is done here, none of which can make it worse:
//  - it is found, and said (html.page-short, --page-gap): the stylesheet then draws the model's picture on down
//    through the strip, and stops keeping clear of the home bar, which the strip already does;
//  - nothing pinned to the bottom is moved into the strip itself: whether a tap lands there is not known.

/** The screen as it is held and the page laid out in it, in CSS px, and the insets the page is told. */
export interface PageSizes {
  screenW: number;
  screenH: number;
  pageW: number;
  pageH: number;
  top: number;
  bottom: number;
}

/** A safe-area inset as the page is told it, in px. */
function inset(side: "top" | "bottom"): number {
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;left:0;top:0;width:0;height:env(safe-area-inset-${side},0px);visibility:hidden;pointer-events:none`;
  document.body.append(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
}

export function pageSizes(): PageSizes {
  const root = document.documentElement;
  const pageW = root.clientWidth || window.innerWidth;
  const pageH = root.clientHeight || window.innerHeight;
  // (A phone gives its screen's size as held upright, whichever way it is held.)
  const [a, b] = [Math.min(screen.width, screen.height), Math.max(screen.width, screen.height)];
  const upright = pageW <= pageH;
  return { screenW: upright ? a : b, screenH: upright ? b : a, pageW, pageH, top: inset("top"), bottom: inset("bottom") };
}

/**
 * By how much the page is laid out shorter than the screen, when what is missing is the status bar's height and
 * the page is drawn under the status bar. (It is told a top inset: so it starts at the screen's very top, and
 * must end that much above its bottom.) 0 otherwise - also where the strip is the system's own, above the page:
 * no top inset is told then, and the page does reach the bottom.
 */
export function shortBy(s: PageSizes): number {
  const gap = s.screenH - s.pageH;
  // (The status bar itself can be a little lower than the inset told: 54 for 59 on some iPhones.)
  return Math.abs(s.pageW - s.screenW) < 2 && s.top >= 16 && gap >= s.top - 12 && gap <= s.top + 2 ? gap : 0;
}

/** Opened from an iPhone's home screen. (An iPad's app can be a window smaller than its screen: there "shorter than the screen" says nothing.) */
function onIPhoneHomeScreen(): boolean {
  return (navigator as { standalone?: boolean }).standalone === true && /iPhone|iPod/.test(navigator.userAgent);
}

export function keepPageWhole(): void {
  if (!onIPhoneHomeScreen()) return;
  const root = document.documentElement;
  let was = 0;
  const look = () => {
    const gap = shortBy(pageSizes());
    if (gap === was) return;
    was = gap;
    root.classList.toggle("page-short", gap > 0);
    if (gap > 0) root.style.setProperty("--page-gap", `${gap}px`);
    else root.style.removeProperty("--page-gap");
  };
  // (Now, as the phone settles after it, and whenever the page's size can have changed.)
  const soon = () => {
    look();
    setTimeout(look, 160);
    setTimeout(look, 600);
  };
  soon();
  setTimeout(look, 2000);
  window.addEventListener("resize", soon);
  window.addEventListener("orientationchange", soon);
  window.addEventListener("pageshow", soon);
  window.visualViewport?.addEventListener("resize", soon);
  document.addEventListener("visibilitychange", () => !document.hidden && soon());
  document.addEventListener("focusout", soon);
}

/** For the last line of a bug report from an installed app: how tall the page is laid out against the screen, and the insets it is told. */
export function pageFacts(): string {
  const s = pageSizes();
  return `page ${Math.round(s.pageH)} of ${s.screenH}, insets ${Math.round(s.top)}/${Math.round(s.bottom)}`;
}
