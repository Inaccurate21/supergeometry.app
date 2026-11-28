// Run: npx tsx tests/pagewhole.test.ts
// An iPhone's home-screen app laid out shorter than its screen (ui/steady.ts): when it is taken to be so, and by
// how much. The sizes are the ones iPhones give; the short ones are the ones reported (WebKit bug 301994).
import { shortBy, type PageSizes } from "../src/ui/steady";

let failed = 0;
const check = (name: string, ok: boolean, info: unknown = "") => {
  if (!ok) failed++;
  console.log(ok ? "ok  " : "FAIL", name, info);
};
const sizes = (screenW: number, screenH: number, pageW: number, pageH: number, top: number, bottom = 34): PageSizes => ({ screenW, screenH, pageW, pageH, top, bottom });
const is = (name: string, s: PageSizes, want: number) => check(name, shortBy(s) === want, `${shortBy(s)} for ${want}`);

// The fault: drawn under the status bar (a top inset is told), and shorter than the screen by that much.
is("a 393 x 852 iPhone, the page 793 tall under a 59 inset: short by 59", sizes(393, 852, 393, 793, 59), 59);
is("a 402 x 874 iPhone, the page 812 tall under a 62 inset: short by 62", sizes(402, 874, 402, 812, 62), 62);
is("an iPhone with a notch (47)", sizes(390, 844, 390, 797, 47), 47);
is("an iPhone with no notch (a 20 status bar)", sizes(375, 667, 375, 647, 20, 0), 20);
is("the status bar a little lower than the inset told (54 for 59)", sizes(393, 852, 393, 798, 59), 54);

// Not the fault.
is("the page as tall as the screen: nothing", sizes(393, 852, 393, 852, 59), 0);
is("the system's own strip above the page (no top inset told): the page reaches the bottom", sizes(402, 874, 402, 812, 0), 0);
is("held on its side: no status bar, no inset", sizes(852, 393, 852, 393, 0, 21), 0);
is("on its side and short for another reason", sizes(852, 393, 852, 340, 0, 21), 0);
is("far shorter than the status bar explains (a keyboard up)", sizes(393, 852, 393, 500, 59), 0);
is("short by less than a status bar", sizes(393, 852, 393, 820, 59), 0);
is("taller than the screen (never, but): nothing", sizes(393, 852, 393, 900, 59), 0);
is("narrower than the screen (a window): nothing", sizes(393, 852, 320, 793, 59), 0);
is("a small inset that is no status bar (under 16)", sizes(393, 852, 393, 842, 10), 0);

if (failed) {
  console.log(`${failed} FAILED`);
  process.exit(1);
}
console.log("all passed");
