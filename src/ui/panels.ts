// The right column: what is used while modelling - Fit, Display - and one
// Settings button for what is set now and then (units & grid, snapping, the
// number pad, appearance), each row there showing how it is set now. Views
// are on the view cube; Screenshot is in Print / Share; History has its own
// button at the top. (Their lists are still kept by id: other parts of the
// app open them.)

import type { SavedView, Units, Vec3 } from "../doc/types";
import type { DocStore } from "../doc/store";
import { MOUSE_PRESETS, mousePreset, settings, type Settings } from "../settings";
import { fmtLen as lenText, UNIT_LABEL, units } from "../units";
import type { Viewport } from "../view/viewport";
import type { UI } from "./ui";
import { el } from "./ui";
import { textField } from "./textField";
import { penTestOn, setPenTest } from "./penTest";
import { PEN_DRAGS, PEN_TAPS, penButtonSettings, setPenButton } from "../penButton";
import { androidInfo, buildReport, clearLog, logLines, sendReport } from "../diagnostics";
import { setUiScale, uiScale, uiScaleWorks, UI_SCALE_MAX, UI_SCALE_MIN } from "../uiScale";
import { lang, LANGS, saveLang, type Lang } from "../i18n";
import { saveTheme, theme, THEMES, type Theme } from "../theme";
import { prefsSnapshot, restorePrefs } from "../prefsBackup";
import { loadPackage, packageInUse, packagesSupported, removePackage, type PackageInfo } from "./package";

/** More → App settings (set up with the right column). */
export let openAppSettings: () => void = () => undefined;

export function setupRightColumn(ui: UI, view: Viewport, store: DocStore, onUnits: (u: Units) => void, isolatedNames: () => string[] = () => []): void {
  ui.addRight("fit", "fit", "Zoom to fit (F)", () => view.fitAll(), () => "Fit");
  // (Kept by id, with no button in the column: opened from Settings.)
  const stash = { host: el("div", ""), className: "right-btn" };
  const lists: Record<string, (host: HTMLElement) => void> = {};
  // (A list shown in the app settings window is drawn again there; in the gear's popover, there.)
  let refresh = () => ui.refreshPopover();
  const kept = (id: string, open: (host: HTMLElement) => void) => (lists[id] = open);
  ui.addRight("snap", "magnet", "Snapping", kept("snap", (host) => {
    const s = settings.value;
    host.append(heading("Snap to"));
    const snapRow = (key: keyof Settings["snap"], label: string) =>
      toggleRow(label, s.snap[key], (v) => settings.set("snap", { ...settings.value.snap, [key]: v }));
    host.append(snapRow("grid", "Grid"), snapRow("guideLines", "Sketch guide lines"), snapRow("guidePoints", "Sketch guide points"), snapRow("points3d", "3D guide points"), snapRow("distantEdges", "Distant edges"));
    host.append(el("div", "pop-note", "Object snaps one by one (OSNAP, as in AutoCAD): in a sketch, OSNAP on the line at the bottom."));
    host.append(heading("Show"));
    host.append(toggleRow("Guide points", s.showGuidePoints, (v) => settings.set("showGuidePoints", v)), toggleRow("Snapping hints", s.showSnapHints, (v) => settings.set("showSnapHints", v)));
    host.append(el("div", "pop-note", "Hold Shift while drawing to place a point without snapping."));
    host.append(heading("Pen"), toggleRow("Pen test: show what the screen reports", penTestOn(), (v) => setPenTest(v)));
    host.append(el("div", "pop-note", "Shows, in a box at the top left, which events a pen (or finger, or mouse) sends as it moves over the screen. Turn it on, hover the pen over the drawing, and send a screenshot if snap marks still don't show."));
  }), undefined, stash);

  ui.addRight(
    "units",
    "ruler",
    "Units & grid",
    kept("units", (host) => {
      host.append(heading("Units"));
      const list: [Units, string][] = [
        ["mm", "Millimeter"],
        ["cm", "Centimeter"],
        ["m", "Meter"],
        ["in", "Inch"],
        ["ft", "Foot"],
      ];
      for (const [u, label] of list) host.append(choiceRow(label, units() === u, () => (onUnits(u), refresh())));
      host.append(heading("Grid"));
      const s = settings.value;
      // Switched on, it keeps the squares as they are right now, at this zoom.
      const lockRow = toggleRow(s.gridLocked ? `Lock grid size (${fmtStep(s.gridStep)})` : `Lock grid size (now ${fmtStep(view.grid.step)})`, s.gridLocked, (v) => {
        if (v) settings.set("gridStep", +view.grid.step.toPrecision(6));
        settings.set("gridLocked", v);
        refresh();
      });
      host.append(lockRow);
      const stepRow = el("label", "pop-row");
      stepRow.append(el("span", "", "Locked size (mm)"));
      const input = textField("pop-input");
      input.inputMode = "decimal";
      // (Not locked: the squares' size right now - what locking would keep.)
      input.value = String(s.gridLocked ? s.gridStep : +view.grid.step.toPrecision(6));
      input.addEventListener("change", () => {
        const v = Number(input.value);
        if (v > 0) settings.set("gridStep", v);
      });
      stepRow.append(input);
      host.append(stepRow);
      const gridNote = el("div", "pop-note", s.gridLocked ? "The squares stay this size at any zoom, and a sketch snaps to them. Switch the lock off for a grid that follows the zoom." : `The grid follows the zoom (now ${fmtStep(view.grid.step)} a square), and a sketch snaps to the squares shown. Lock it to keep them as they are now.`);
      host.append(gridNote);
      // Not locked, the size follows the zoom while this is open: the row, the box and the note say the squares'
      // size as it is now. They said the size it was when the window opened.
      if (!s.gridLocked) {
        let shown = view.grid.step;
        const follow = () => {
          // (Closed, or drawn again: this one is done.)
          if (!lockRow.isConnected || lockRow.closest("[hidden]")) return void view.frameHooks.delete(follow);
          const now = view.grid.step;
          if (now === shown) return;
          shown = now;
          (lockRow.firstElementChild as HTMLElement).textContent = `Lock grid size (now ${fmtStep(now)})`;
          if (document.activeElement !== input) input.value = String(+now.toPrecision(6));
          gridNote.textContent = `The grid follows the zoom (now ${fmtStep(now)} a square), and a sketch snaps to the squares shown. Lock it to keep them as they are now.`;
        };
        view.frameHooks.add(follow);
      }
      host.append(heading("Degree format"));
      host.append(choiceRow("Decimal (27.15°)", s.degrees === "decimal", () => (settings.set("degrees", "decimal"), refresh())), choiceRow("Fractional (27° 15′)", s.degrees === "fractional", () => (settings.set("degrees", "fractional"), refresh())));
    }),
    () => UNIT_LABEL[units()],
    stash,
  );

  // Appearance (camera, projection, grid, axes): back in the right-hand column.
  ui.addRight("appearance", "eye", "Appearance", kept("appearance", (host) => {
    const s = settings.value;
    host.append(
      heading("Appearance"),
      toggleRow("Animate camera", s.animateCamera, (v) => settings.set("animateCamera", v)),
      toggleRow("Orthographic", s.ortho, (v) => settings.set("ortho", v)),
      toggleRow("Show grid", s.showGrid, (v) => settings.set("showGrid", v)),
      toggleRow("Show world axes", s.showAxes, (v) => settings.set("showAxes", v)),
    );
  }), undefined, stash);

  // Mouse: which drags turn, move and zoom the view - the app's own way or another CAD program's, for hands used
  // to it. Only where there is a mouse.
  lists.mouse = (host) => {
    const s = settings.value;
    const now = mousePreset(s.mouse);
    host.append(heading("Mouse like in"));
    for (const m of MOUSE_PRESETS) {
      const row = choiceRow(m.apps, now.id === m.id, () => (settings.set("mouse", m.id), refresh()));
      row.title = m.text;
      host.append(row);
    }
    host.append(el("div", "pop-note", now.text));
    host.append(heading("Wheel"));
    host.append(toggleRow("Forward zooms out", s.wheelReverse, (v) => settings.set("wheelReverse", v)));
    host.append(el("div", "pop-note", "Always: the wheel zooms where the pointer is, a plain right drag turns the view, Alt + left drag turns it too (a trackpad), and a left drag on empty space draws a box to select with."));
  };

  // Views (standard and saved): the button at the view cube's bottom right.
  const cube = document.getElementById("viewcube")!;
  ui.addRight("views", "views", "Views (tap to open / close)", (host) => {
    const body = el("div", "");
    host.append(heading("Views"), body);
    const showViews = () => {
      body.innerHTML = "";
      // Picking a view closes the list (it would only cover the view picked).
      const go = (label: string, n: Vec3, x?: Vec3) => choiceRow(label, false, () => (view.cam.flatUntilTurned(), view.cam.lookAlong(n, x), ui.closePopover()));
      body.append(choiceRow("⌂ Default view", false, () => (view.cam.iso(), view.fitAll(), ui.closePopover())));
      body.append(go("Top", [0, 0, 1]), go("Bottom", [0, 0, -1]), go("Front", [0, -1, 0]), go("Back", [0, 1, 0], [-1, 0, 0]), go("Right", [1, 0, 0], [0, 1, 0]), go("Left", [-1, 0, 0], [0, -1, 0]));
      body.append(heading("Saved views"));
      for (const v of store.doc.views) {
        const row = choiceRow(v.name, false, () => (view.cam.restore(v), ui.closePopover()));
        const del = el("button", "icon-btn small", "✕");
        del.title = "Delete view";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          store.commit((d) => (d.views = d.views.filter((x) => x.name !== v.name)));
          showViews();
        });
        row.append(del);
        body.append(row);
      }
      body.append(
        choiceRow("＋ Save current view", false, () => {
          const name = `View ${store.doc.views.length + 1}`;
          const sv: SavedView = view.cam.savedView(name);
          store.commit((d) => d.views.push(sv));
          showViews();
        }),
      );
    };
    showViews();
  }, undefined, { host: cube, className: "vc-roll bottom right vc-views" });

  ui.addRight("display", "display", "Display modes", (host) => {
    const s = settings.value;
    host.append(heading("Shaders"));
    for (const [id, label] of [["wireframe", "Wireframe"], ["xray", "X-Ray"], ["shaded", "Shaded"]] as const) {
      host.append(choiceRow(label, s.shader === id, () => (settings.set("shader", id), refresh())));
    }
    host.append(heading("Options"));
    host.append(toggleRow("Show edges", s.showEdges, (v) => settings.set("showEdges", v)), toggleRow("Show hidden edges", s.showHiddenEdges, (v) => settings.set("showHiddenEdges", v)));
    // Surface analysis: how smoothly faces meet (zebra), how much they bend (curvature).
    host.append(heading("Analysis"));
    for (const [id, label] of [["none", "Off"], ["zebra", "Zebra stripes"], ["curvature", "Curvature map"]] as const) {
      host.append(choiceRow(label, s.analysis === id, () => (settings.set("analysis", id), refresh())));
    }
    if (s.analysis === "zebra") {
      host.append(
        toggleRow("Horizontal stripes", s.zebraDirection === "horizontal", (v) => settings.set("zebraDirection", v ? "horizontal" : "vertical")),
        sliderRow("Stripes", 4, 48, 1, s.zebraStripes, (v) => settings.set("zebraStripes", v), (v) => String(v)),
      );
    }
    if (s.analysis === "curvature") {
      // On a log scale: a 0.5 mm fillet and a 5 m roof both get a useful setting.
      host.append(
        sliderRow("Full colour at radius", Math.log10(0.5), Math.log10(5000), 0.01, Math.log10(s.curvatureRadius), (v) => settings.set("curvatureRadius", +(10 ** v).toPrecision(2)), (v) => fmtLen(10 ** v)),
        el("div", "pop-note", "Red: domed. Green: flat. Blue: hollow."),
      );
    }
  }, () => (settings.value.analysis === "zebra" ? "Zebra" : settings.value.analysis === "curvature" ? "Curv." : ({ shaded: "Shaded", wireframe: "Wire", xray: "X-Ray" })[settings.value.shader]));

  ui.addRight("shot", "camera", "Screenshot", () => {
    void view.screenshot({ project: store.doc.name, isolated: isolatedNames() }).then((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${store.doc.name} ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      ui.toast("Screenshot saved");
    });
  }, undefined, stash);

  // On-screen numpad: one tap on, one tap off (lit while on).
  const pad = ui.addRight("numpad", "numpad", "On-screen numpad for typing values (tap to switch on / off)", () => {
    settings.set("numpad", !settings.value.numpad);
    ui.toast(settings.value.numpad ? "On-screen numpad on" : "On-screen numpad off");
  }, () => "NumPad", stash);
  const markPad = () => pad.classList.toggle("on", settings.value.numpad);
  settings.onChange(() => (markPad(), ui.refreshRight()));
  markPad();
  ui.addRight("history", "history", "History", () => ui.toggleHistory(), undefined, stash);

  // Language: the app reloads in the one picked (the project is saved first).
  kept("lang", (host) => {
    host.append(heading("Language"));
    for (const [l, label] of LANGS) host.append(choiceRow(label, lang === l, () => void switchLang(l)));
  });
  const switchLang = async (l: Lang) => {
    if (l === lang) return;
    saveLang(l);
    await store.flush();
    location.reload();
  };

  // Theme: dark, light or black; the app reloads in it (the project is saved first).
  kept("theme", (host) => {
    host.append(heading("Theme"));
    for (const [t, label] of THEMES) host.append(choiceRow(label, theme === t, () => void switchTheme(t)));
  });
  const switchTheme = async (t: Theme) => {
    if (t === theme) return;
    saveTheme(t);
    await store.flush();
    location.reload();
  };

  // Update: the version running, and an own update package (src/ui/package.ts) to load in its place.
  let pkg: PackageInfo | null = null;
  let apkLatest: { versionCode: number; versionName: string } | null = null;
  void fetch("./apk.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (apkLatest = j))
    .catch(() => undefined);
  let pkgBusy = "";
  void packageInUse().then((p) => ((pkg = p), ui.refreshRight()));
  kept("update", (host) => {
    host.append(heading("Updates"));
    host.append(el("div", "pop-note", pkg ? `Running your own update package: ${pkg.name}, loaded ${new Date(pkg.loaded).toLocaleString()}.` : `Running the site's version ${__APP_VERSION__}.`));
    if (pkg?.version) host.append(el("div", "pop-note", `Version in the package: ${pkg.version}`));
    const pick = el("button", "pop-row", pkgBusy ? `Loading the package… ${pkgBusy}` : "Load your own update package (.zip)…");
    pick.disabled = !!pkgBusy;
    pick.addEventListener("click", () => {
      if (!packagesSupported()) return ui.toast("This browser can't run an update package here (it needs the built app, over https or on localhost).", "error");
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip,application/zip";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        pkgBusy = "0%";
        refresh();
        try {
          await loadPackage(file, (t) => ((pkgBusy = t), refresh()));
          ui.toast("Update package loaded: the app restarts in it.");
          await store.flush();
          setTimeout(() => location.reload(), 600);
        } catch (e) {
          pkgBusy = "";
          refresh();
          ui.toast(e instanceof Error ? e.message : String(e), "error");
        }
      });
      input.click();
    });
    host.append(pick);
    if (pkg) {
      const back = el("button", "pop-row", "Remove the package (back to the site's version)");
      back.addEventListener("click", async () => {
        await removePackage(settings.value.offline);
        await store.flush();
        location.reload();
      });
      host.append(back);
    }
    // The Android app: its download, and in it whether a newer one is out.
    const native = androidInfo();
    const apk = el("a", "pop-row", native ? `Android app ${String(native.versionName ?? "")} - download again` : "Android app (APK) - download") as HTMLAnchorElement;
    apk.href = "./supergeometry.apk";
    apk.setAttribute("download", "supergeometry.apk");
    host.append(apk);
    if (apkLatest) host.append(el("div", "pop-note", native && Number(native.versionCode) < apkLatest.versionCode ? `A newer Android app is out: ${apkLatest.versionName}. Download it above and install it over this one (projects stay).` : `Android app on the site: ${apkLatest.versionName}`));
    host.append(el("div", "pop-note", "A package is the app's built folder (dist) in a .zip - npm run package makes one. It replaces the version from the site on this device, in the installed app too, until it is removed (More → Update also goes back to the site's)."));
  });

  // Diagnostics: the log, and a report of it to copy, save, share or send.
  let diagNote = "";
  let diagCode = "";
  let diagBusy = false;
  kept("diag", (host) => {
    host.append(heading("Diagnostics"));
    const errors = logLines().filter((l) => l.level === "error").length;
    host.append(el("div", "pop-note", `The log keeps the last 400 lines: errors, messages shown and what was opened (now ${logLines().length}, errors ${errors}). A report adds the version, the device, the browser and the settings - nothing of the project's content.`));
    const note = document.createElement("textarea");
    note.className = "pop-input diag-note";
    note.rows = 3;
    note.placeholder = "What happened? (optional)";
    note.value = diagNote;
    note.addEventListener("input", () => (diagNote = note.value));
    note.addEventListener("keydown", (e) => e.stopPropagation());
    host.append(note);
    const button = (label: string, run: () => void | Promise<void>) => {
      const b = el("button", "pop-row", label);
      b.addEventListener("click", () => void run());
      host.append(b);
      return b;
    };
    const send = button(diagBusy ? "Sending…" : "Send the report for analysis", async () => {
      diagBusy = true;
      refresh();
      try {
        diagCode = await sendReport(await buildReport(diagNote));
        ui.toast(`Report sent - its code is ${diagCode}`);
      } catch (e) {
        ui.toast(`The report couldn't be sent (${e instanceof Error ? e.message : String(e)}): copy or save it instead`, "error");
      }
      diagBusy = false;
      refresh();
    });
    send.disabled = diagBusy;
    if (diagCode) host.append(el("div", "pop-note diag-code", `Sent - report code: ${diagCode}. Give this code in the chat.`));
    button("Copy the report", async () => {
      const text = await buildReport(diagNote);
      try {
        await navigator.clipboard.writeText(text);
        ui.toast("Report copied");
      } catch {
        ui.toast("Copying isn't allowed here: save the report instead", "error");
      }
    });
    button("Save the report (.txt)", async () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([await buildReport(diagNote)], { type: "text/plain" }));
      a.download = `supergeometry-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    button("Share the report", async () => {
      const text = await buildReport(diagNote);
      const native = (window as unknown as { SGAndroid?: { shareText?: (t: string) => void } }).SGAndroid;
      if (native?.shareText) return native.shareText(text);
      if (navigator.share) return void navigator.share({ title: "superGeometry.app report", text }).catch(() => undefined);
      ui.toast("Sharing isn't available here: copy or save the report instead", "error");
    });
    button("Clear the log", () => {
      clearLog();
      diagCode = "";
      refresh();
    });
  });

  // S Pen: what its side button does (in the Android app, which passes it on), in two kinds - at the screen and
  // from afar - each gesture a row saying its action; a tap opens the actions to pick from.
  type PenKey = "tap" | "drag" | "hover" | "click1" | "click2" | "click3" | "hold" | "wave";
  let penPage: null | "screen" | "afar" | PenKey = null;
  const GESTURES: Record<PenKey, { label: string; group: "screen" | "afar"; drag?: boolean }> = {
    tap: { label: "Touch with the button held", group: "screen" },
    drag: { label: "Drag with the button held", group: "screen", drag: true },
    hover: { label: "Press the button over the screen", group: "screen" },
    click1: { label: "One press", group: "afar" },
    click2: { label: "Two presses", group: "afar" },
    click3: { label: "Three presses", group: "afar" },
    hold: { label: "Hold", group: "afar" },
    wave: { label: "Hold and wave the pen", group: "afar", drag: true },
  };
  const actionName = (k: PenKey) => {
    const v = penButtonSettings()[k];
    return ((GESTURES[k].drag ? PEN_DRAGS : PEN_TAPS) as [string, string][]).find(([id]) => id === v)?.[1] ?? "";
  };
  const penNav = (label: string, now: string, to: typeof penPage) => {
    const row = el("button", "pop-row pop-nav");
    row.append(el("span", "", label), el("span", "pop-value", now), el("span", "pop-chev", "›"));
    row.addEventListener("click", () => ((penPage = to), refresh()));
    return row;
  };
  const penBack = (label: string, to: typeof penPage) => {
    const b = el("button", "pop-row pop-back", `‹  ${label}`);
    b.addEventListener("click", () => ((penPage = to), refresh()));
    return b;
  };
  kept("pen", (host) => {
    const p = penButtonSettings();
    if (penPage === null) {
      host.append(heading("S Pen"));
      if (!("SGAndroid" in window)) host.append(el("div", "pop-note", "The side button works in the Android app (Settings → Updates → Android app): a browser doesn't pass it on."));
      host.append(
        penNav("At the screen", actionName("tap"), "screen"),
        penNav("From afar (Air actions)", actionName("click1"), "afar"),
      );
      host.append(el("div", "pop-note", "At the screen: the side button while the pen touches or hovers. From afar: over Bluetooth, the pen away from the screen, while the app is open."));
      return;
    }
    if (penPage === "screen" || penPage === "afar") {
      const group = penPage;
      host.append(penBack("S Pen", null), heading(group === "screen" ? "At the screen" : "From afar (Air actions)"));
      for (const k of Object.keys(GESTURES) as PenKey[]) if (GESTURES[k].group === group) host.append(penNav(GESTURES[k].label, actionName(k), k));
      if (group === "afar") host.append(sliderRow("Wave speed", 0.3, 3, 0.1, p.waveSpeed, (v) => setPenButton({ waveSpeed: v }), (v) => `${v.toFixed(1)}×`));
      host.append(
        el(
          "div",
          "pop-note",
          group === "screen"
            ? "If pressing the button over the screen opens Samsung's Air command instead, switch that off in the phone's settings (S Pen → Air command), or set it to Nothing."
            : "Presses count as one, two or three when they come quickly one after another. Hold: the button kept down without moving the pen. Wave: the button kept down while the pen moves through the air.",
        ),
      );
      return;
    }
    const k = penPage;
    const g = GESTURES[k];
    host.append(penBack(g.group === "screen" ? "At the screen" : "From afar (Air actions)", g.group), heading(g.label));
    for (const [id, label] of (g.drag ? PEN_DRAGS : PEN_TAPS) as [string, string][]) host.append(choiceRow(label, p[k] === id, () => (setPenButton({ [k]: id } as Partial<typeof p>), (penPage = g.group), refresh())));
  });

  // Settings: one row for each thing set now and then, saying how it is set; a tap opens its list (and back).
  let page: "units" | "snap" | "appearance" | "lang" | "update" | "diag" | "pen" | "theme" | "mouse" | null = null;
  const gear = ui.addRight(
    "settings",
    "settings",
    "Settings",
    (host) => {
      const s = settings.value;
      if (page) {
        const back = el("button", "pop-row pop-back", "‹  Settings");
        back.addEventListener("click", () => ((page = null), refresh()));
        host.append(back);
        lists[page](host);
        return;
      }
      const nav = (label: string, now: string, to: NonNullable<typeof page>) => {
        const row = el("button", "pop-row pop-nav");
        row.append(el("span", "", label), el("span", "pop-value", now), el("span", "pop-chev", "›"));
        row.addEventListener("click", () => ((page = to), (penPage = null), refresh()));
        return row;
      };
      const snaps = Object.values(s.snap).filter(Boolean).length;
      // The drawing's own settings here; the app's (its look, the mouse and pen, keys, updates...) are in More →
      // App settings (asked for: "the settings at the right only for the drawing: units, grid, snapping, look").
      host.append(
        heading("Drawing settings"),
        nav("Units & grid", `${UNIT_LABEL[units()]}${s.gridLocked ? ` · grid ${s.gridStep} mm` : ""}`, "units"),
        nav("Snapping", snaps ? `${snaps} of ${Object.keys(s.snap).length} on` : "Off", "snap"),
        nav("Appearance", `${s.ortho ? "Orthographic" : "Perspective"}${s.showGrid ? "" : " · no grid"}`, "appearance"),
      );
    },
    () => UNIT_LABEL[units()],
  );
  // (Opened afresh: its first page.)
  gear.addEventListener("pointerdown", () => (page = null));

  // More → App settings: everything set now and then that is not the drawing's, sorted into kinds - the screen,
  // the controls, the project, the app itself. A list in it is the same as the gear's was.
  type Sect = { id: string; label: string; rows: () => HTMLElement[] };
  let shown = "screen";
  let sub: string | null = null;
  const appSettings = (): void => {
    const back = el("div", "dialog-back");
    const box = el("div", "dialog app-settings");
    const head = el("div", "library-head");
    head.append(el("div", "panel-title", "App settings"));
    const x = el("button", "icon-btn library-close", "×");
    x.title = "Close";
    head.append(x);
    const nav = el("div", "aps-nav");
    const body = el("div", "aps-body");
    const wrap = el("div", "aps-wrap");
    wrap.append(nav, body);
    box.append(head, wrap);
    back.append(box);
    const go = (label: string, now: string, to: string) => {
      const row = el("button", "pop-row pop-nav");
      row.append(el("span", "", label), el("span", "pop-value", now), el("span", "pop-chev", "›"));
      row.addEventListener("click", () => ((sub = to), (penPage = null), draw()));
      return row;
    };
    const sects: Sect[] = [
      {
        id: "screen",
        label: "Screen",
        rows: () => [
          scaleRow(() => draw()),
          go("Theme", THEMES.find(([t]) => t === theme)![1], "theme"),
          go("Language", LANGS.find(([l]) => l === lang)![1], "lang"),
          toggleRow("Number pad on screen", settings.value.numpad, (v) => settings.set("numpad", v)),
          // The round buttons beside what is picked (off: everything from the line at the bottom).
          toggleRow("Quick buttons", settings.value.quickButtons, (v) => settings.set("quickButtons", v)),
        ],
      },
      {
        id: "controls",
        label: "Controls",
        rows: () => {
          const keys = el("button", "pop-row pop-nav");
          keys.append(el("span", "", "Keyboard shortcuts"), el("span", "pop-value", "?"), el("span", "pop-chev", "›"));
          keys.addEventListener("click", () => void import("./commands").then((m) => m.showShortcuts()));
          return [
            ...(matchMedia("(any-pointer: fine)").matches ? [go("Mouse", mousePreset(settings.value.mouse).apps.split(",")[0], "mouse")] : []),
            go("S Pen", "", "pen"),
            keys,
          ];
        },
      },
      {
        id: "project",
        label: "Project",
        rows: () => {
          const m = settings.value.autosaveMinutes;
          const out: HTMLElement[] = [heading("Autosave"), el("div", "pop-note", "Every change is saved on this device at once (the ✓ by the project's name). A copy also goes into File → Open's project list:")];
          for (const [v, label] of [[0, "When the app is left"], [1, "Every minute"], [2, "Every 2 minutes"], [5, "Every 5 minutes"], [10, "Every 10 minutes"]] as [number, string][]) out.push(choiceRow(label, m === v, () => (settings.set("autosaveMinutes", v), draw())));
          out.push(heading("Settings backup"), el("div", "pop-note", "All these settings (shortcuts, favourites, the pen...) in a file: for another device, or to keep them safe."));
          const exp = el("button", "pop-row", "Save settings to a file");
          exp.addEventListener("click", () => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([prefsSnapshot()], { type: "application/json" }));
            a.download = "supergeometry-settings.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          });
          const imp = el("button", "pop-row", "Load settings from a file…");
          imp.addEventListener("click", () => {
            const f = document.createElement("input");
            f.type = "file";
            f.accept = ".json,application/json";
            f.addEventListener("change", async () => {
              const file = f.files?.[0];
              if (!file) return;
              const n = restorePrefs(await file.text());
              if (!n) return ui.toast("That file holds no settings of this app", "error");
              ui.toast("Settings loaded - the app starts again with them");
              setTimeout(() => location.reload(), 900);
            });
            f.click();
          });
          out.push(exp, imp);
          return out;
        },
      },
      {
        id: "app",
        label: "App",
        rows: () => [go("Updates", `v${__APP_VERSION__}`, "update"), go("Diagnostics", `${logLines().filter((l) => l.level === "error").length} errors`, "diag")],
      },
    ];
    const draw = () => {
      nav.replaceChildren();
      for (const sct of sects) {
        const b = el("button", `aps-tab${sct.id === shown ? " on" : ""}`, sct.label);
        b.addEventListener("click", () => ((shown = sct.id), (sub = null), draw()));
        nav.append(b);
      }
      body.replaceChildren();
      if (sub && lists[sub]) {
        const bk = el("button", "pop-row pop-back", `‹  ${sects.find((x) => x.id === shown)!.label}`);
        bk.addEventListener("click", () => ((sub = null), draw()));
        body.append(bk);
        lists[sub](body);
      } else body.append(heading(sects.find((x) => x.id === shown)!.label), ...sects.find((x) => x.id === shown)!.rows());
    };
    refresh = draw;
    const close = () => {
      back.remove();
      refresh = () => ui.refreshPopover();
      window.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) (e.preventDefault(), close());
    };
    x.addEventListener("click", close);
    back.addEventListener("pointerdown", (ev) => ev.target === back && close());
    window.addEventListener("keydown", onKey, true);
    document.body.append(back);
    draw();
  };
  openAppSettings = appSettings;
  // Sketch mode only (CSS shows it under body.sketching): show/hide the constraint column.
  const cons = ui.addRight("constraints", "constraints", "Constraints (sketch)", () => settings.set("showConstraints", !settings.value.showConstraints));
  cons.classList.add("sketch-only");
  const mark = () => cons.classList.toggle("on", settings.value.showConstraints);
  settings.onChange(mark);
  mark();
  settings.onChange(() => ui.refreshRight());
}

/** Interface size: − 100% +, a tenth at a time (a computer's browser zooms with Ctrl + / Ctrl −). */
function scaleRow(refresh: () => void): HTMLElement {
  const row = el("div", "pop-row scale-row");
  row.append(el("span", "", "Interface size"));
  if (!uiScaleWorks()) {
    row.append(el("span", "pop-value", "Ctrl + / Ctrl −"));
    row.title = "On a computer the browser's own zoom sizes the app: Ctrl + and Ctrl −";
    return row;
  }
  const step = (d: number) => {
    setUiScale(uiScale() + d);
    refresh();
  };
  const minus = el("button", "scale-btn", "−");
  minus.title = "Smaller";
  minus.disabled = uiScale() <= UI_SCALE_MIN + 1e-6;
  minus.addEventListener("click", () => step(-0.1));
  const plus = el("button", "scale-btn", "+");
  plus.title = "Bigger";
  plus.disabled = uiScale() >= UI_SCALE_MAX - 1e-6;
  plus.addEventListener("click", () => step(0.1));
  const value = el("button", "scale-value", `${Math.round(uiScale() * 100)}%`);
  value.title = "Back to 100%";
  value.addEventListener("click", () => ((setUiScale(1)), refresh()));
  const box = el("span", "scale-box");
  box.append(minus, value, plus);
  row.append(box);
  return row;
}

function heading(text: string): HTMLElement {
  return el("div", "pop-heading", text);
}

function toggleRow(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = el("button", `pop-row toggle-row${value ? " on" : ""}`);
  row.append(el("span", "", label), el("span", "switch"));
  row.addEventListener("click", () => {
    const next = !row.classList.contains("on");
    row.classList.toggle("on", next);
    onChange(next);
  });
  return row;
}

/** A slider with its value beside it (set while dragging). */
function sliderRow(label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void, show: (v: number) => string): HTMLElement {
  const row = el("label", "pop-row slider-row");
  const out = el("span", "slider-value", show(value));
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => {
    out.textContent = show(Number(input.value));
    onChange(Number(input.value));
  });
  row.append(el("span", "slider-label", label), input, out);
  return row;
}

function fmtLen(mm: number): string {
  const v = +mm.toPrecision(2);
  return v >= 1000 ? `${v / 1000} m` : `${v} mm`;
}

function choiceRow(label: string, active: boolean, run: () => void): HTMLElement {
  const row = el("button", `pop-row choice-row${active ? " active" : ""}`, label);
  row.addEventListener("click", run);
  return row;
}

function fmtStep(mm: number): string {
  // (In the unit in use: 10 mm was said as "1 cm" in a project of millimetres.)
  return lenText(mm, 4);
}
