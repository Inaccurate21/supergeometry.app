// The right column: what is used while modelling - Fit, Display - and one
// Settings button for what is set now and then (units & grid, snapping, the
// number pad, appearance), each row there showing how it is set now. Views
// are on the view cube; Screenshot is in Print / Share; History has its own
// button at the top. (Their lists are still kept by id: other parts of the
// app open them.)

import type { SavedView, Units, Vec3 } from "../doc/types";
import type { DocStore } from "../doc/store";
import { settings, type Settings } from "../settings";
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
import { loadPackage, packageInUse, packagesSupported, removePackage, type PackageInfo } from "./package";

export function setupRightColumn(ui: UI, view: Viewport, store: DocStore, onUnits: (u: Units) => void, isolatedNames: () => string[] = () => []): void {
  ui.addRight("fit", "fit", "Zoom to fit (F)", () => view.fitAll(), () => "Fit");
  // (Kept by id, with no button in the column: opened from Settings.)
  const stash = { host: el("div", ""), className: "right-btn" };
  const lists: Record<string, (host: HTMLElement) => void> = {};
  const kept = (id: string, open: (host: HTMLElement) => void) => (lists[id] = open);
  ui.addRight("snap", "magnet", "Snapping", kept("snap", (host) => {
    const s = settings.value;
    host.append(heading("Snap to"));
    const snapRow = (key: keyof Settings["snap"], label: string) =>
      toggleRow(label, s.snap[key], (v) => settings.set("snap", { ...settings.value.snap, [key]: v }));
    host.append(snapRow("grid", "Grid"), snapRow("guideLines", "Sketch guide lines"), snapRow("guidePoints", "Sketch guide points"), snapRow("points3d", "3D guide points"), snapRow("distantEdges", "Distant edges"));
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
      for (const [u, label] of list) host.append(choiceRow(label, units() === u, () => (onUnits(u), ui.refreshPopover())));
      host.append(heading("Grid"));
      const s = settings.value;
      // Switched on, it keeps the squares as they are right now, at this zoom (asked for: "I want the lock grid size
      // toggle to adjust to whatever the zoom level is so I can just click toggle on").
      const lockRow = toggleRow(s.gridLocked ? `Lock grid size (${fmtStep(s.gridStep)})` : `Lock grid size (now ${fmtStep(view.grid.step)})`, s.gridLocked, (v) => {
        if (v) settings.set("gridStep", +view.grid.step.toPrecision(6));
        settings.set("gridLocked", v);
        ui.refreshPopover();
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
      // size as it is now (asked for: "the lock grid size should change on the fly when I zoom so I can see what
      // size grid it is in that moment"). They said the size it was when the window opened.
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
      host.append(choiceRow("Decimal (27.15°)", s.degrees === "decimal", () => (settings.set("degrees", "decimal"), ui.refreshPopover())), choiceRow("Fractional (27° 15′)", s.degrees === "fractional", () => (settings.set("degrees", "fractional"), ui.refreshPopover())));
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
      host.append(choiceRow(label, s.shader === id, () => (settings.set("shader", id), ui.refreshPopover())));
    }
    host.append(heading("Options"));
    host.append(toggleRow("Show edges", s.showEdges, (v) => settings.set("showEdges", v)), toggleRow("Show hidden edges", s.showHiddenEdges, (v) => settings.set("showHiddenEdges", v)));
    // Surface analysis: how smoothly faces meet (zebra), how much they bend (curvature).
    host.append(heading("Analysis"));
    for (const [id, label] of [["none", "Off"], ["zebra", "Zebra stripes"], ["curvature", "Curvature map"]] as const) {
      host.append(choiceRow(label, s.analysis === id, () => (settings.set("analysis", id), ui.refreshPopover())));
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
        ui.refreshPopover();
        try {
          await loadPackage(file, (t) => ((pkgBusy = t), ui.refreshPopover()));
          ui.toast("Update package loaded: the app restarts in it.");
          await store.flush();
          setTimeout(() => location.reload(), 600);
        } catch (e) {
          pkgBusy = "";
          ui.refreshPopover();
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
      ui.refreshPopover();
      try {
        diagCode = await sendReport(await buildReport(diagNote));
        ui.toast(`Report sent - its code is ${diagCode}`);
      } catch (e) {
        ui.toast(`The report couldn't be sent (${e instanceof Error ? e.message : String(e)}): copy or save it instead`, "error");
      }
      diagBusy = false;
      ui.refreshPopover();
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
      ui.refreshPopover();
    });
  });

  // S Pen: what its side button does (in the Android app, which passes the button on).
  kept("pen", (host) => {
    const p = penButtonSettings();
    host.append(heading("S Pen side button"));
    if (!("SGAndroid" in window)) host.append(el("div", "pop-note", "The side button works in the Android app (Settings → Updates → Android app): a browser doesn't pass it on."));
    host.append(heading("Touch with the button held"));
    for (const [id, label] of PEN_TAPS) host.append(choiceRow(label, p.tap === id, () => (setPenButton({ tap: id }), ui.refreshPopover())));
    host.append(heading("Drag with the button held"));
    for (const [id, label] of PEN_DRAGS) host.append(choiceRow(label, p.drag === id, () => (setPenButton({ drag: id }), ui.refreshPopover())));
    host.append(heading("Press the button over the screen"));
    for (const [id, label] of PEN_TAPS) host.append(choiceRow(label, p.hover === id, () => (setPenButton({ hover: id }), ui.refreshPopover())));
    host.append(el("div", "pop-note", "If pressing the button over the screen opens Samsung's Air command instead, switch that off in the phone's settings (S Pen → Air command), or leave this on Nothing."));
    host.append(heading("From afar (the pen off the screen)"));
    host.append(el("div", "pop-note", "Over Bluetooth, with the pen away from the screen (an S Pen with Air actions, while the app is open). Hold the button and wave the pen to turn the view."));
    const afar = (title: string, key: "click1" | "click2" | "click3" | "hold") => {
      host.append(heading(title));
      for (const [id, label] of PEN_TAPS) host.append(choiceRow(label, p[key] === id, () => (setPenButton({ [key]: id }), ui.refreshPopover())));
    };
    afar("One press", "click1");
    afar("Two presses", "click2");
    afar("Three presses", "click3");
    afar("Hold", "hold");
    host.append(heading("Hold and wave the pen"));
    for (const [id, label] of PEN_DRAGS) host.append(choiceRow(label, p.wave === id, () => (setPenButton({ wave: id }), ui.refreshPopover())));
    host.append(sliderRow("Speed", 0.3, 3, 0.1, p.waveSpeed, (v) => setPenButton({ waveSpeed: v }), (v) => `${v.toFixed(1)}×`));
  });

  // Settings: one row for each thing set now and then, saying how it is set; a tap opens its list (and back).
  let page: "units" | "snap" | "appearance" | "lang" | "update" | "diag" | "pen" | null = null;
  const gear = ui.addRight(
    "settings",
    "settings",
    "Settings",
    (host) => {
      const s = settings.value;
      if (page) {
        const back = el("button", "pop-row pop-back", "‹  Settings");
        back.addEventListener("click", () => ((page = null), ui.refreshPopover()));
        host.append(back);
        lists[page](host);
        return;
      }
      const nav = (label: string, now: string, to: NonNullable<typeof page>) => {
        const row = el("button", "pop-row pop-nav");
        row.append(el("span", "", label), el("span", "pop-value", now), el("span", "pop-chev", "›"));
        row.addEventListener("click", () => ((page = to), ui.refreshPopover()));
        return row;
      };
      const snaps = Object.values(s.snap).filter(Boolean).length;
      host.append(
        heading("Settings"),
        nav("Units & grid", `${UNIT_LABEL[units()]}${s.gridLocked ? ` · grid ${s.gridStep} mm` : ""}`, "units"),
        nav("Snapping", snaps ? `${snaps} of ${Object.keys(s.snap).length} on` : "Off", "snap"),
        toggleRow("Number pad on screen", s.numpad, (v) => settings.set("numpad", v)),
        nav("Appearance", `${s.ortho ? "Orthographic" : "Perspective"}${s.showGrid ? "" : " · no grid"}`, "appearance"),
        scaleRow(() => ui.refreshPopover()),
        nav("Language", LANGS.find(([l]) => l === lang)![1], "lang"),
        nav("Updates", pkg ? "Own package" : `v${__APP_VERSION__}`, "update"),
        nav("S Pen", PEN_TAPS.find(([id]) => id === penButtonSettings().tap)![1], "pen"),
        nav("Diagnostics", `${logLines().filter((l) => l.level === "error").length} errors`, "diag"),
      );
    },
    () => UNIT_LABEL[units()],
  );
  // (Opened afresh: its first page.)
  gear.addEventListener("pointerdown", () => (page = null));
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
