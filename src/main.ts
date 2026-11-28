// First: the language (the page's texts are translated as they appear).
import { backupPrefs, restoreFromCache } from "./prefsBackup";
import "./diagnostics";
import "./i18n";
import "./theme";
import "./uiScale";
import "./android";
import "./penButton";
import "./style.css";
import { App } from "./app";
import { outerScrollbars } from "./ui/scrollbars";
import { setupTooltips } from "./ui/tooltips";
import { installDebug } from "./debug";
import { addReportSection } from "./diagnostics";
import { lang } from "./i18n";
import { settings } from "./settings";
import { uiScale } from "./uiScale";
import { keepPageSteady, keepPageWhole } from "./ui/steady";

// Update reloads with ?v=<time> so no stored copy is used; once loaded, the
// address is plain again (it's what people copy to share the app).
{
  const url = new URL(location.href);
  if (url.searchParams.has("v")) {
    url.searchParams.delete("v");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
}

// The page itself never scrolls (a phone pushing it along for a keyboard that does not come).
keepPageSteady();
// An iPhone's home-screen app laid out shorter than its screen: the picture still goes to the bottom.
keepPageWhole();

// Scroll bars outside the windows, only while scrolling.
outerScrollbars();

const app = new App(document.getElementById("view") as HTMLCanvasElement);
// Handy for debugging from the console.
(window as unknown as { supergeometry: App }).supergeometry = app;
// And sg: read and work the app from the console (sg.help()).
installDebug(app);

// The diagnostic report (Settings → Diagnostics): what the project is made of (no content), and how the app is set.
addReportSection(() => {
  const steps: Record<string, number> = {};
  for (const f of app.store.features) steps[f.type] = (steps[f.type] ?? 0) + 1;
  const failed = app.store.features.filter((f) => (f as { error?: unknown }).error).length;
  return { steps, failedSteps: failed || undefined, tool: ((app as unknown as { tool: { id?: string } }).tool).id ?? "?", language: lang, uiScale: uiScale(), settings: settings.value };
});

// Settings kept in their copies too (see prefsBackup.ts): now, whenever the app goes to the background, and back from the cache if they were lost.
void restoreFromCache();
backupPrefs();
document.addEventListener("visibilitychange", () => document.hidden && backupPrefs());

// Tool tips with a picture, as Fusion's (a mouse or a pen held over a tool).
setupTooltips();
