// More → Version: what is new. A short list per update, newest first, written for whoever uses the app (asked for:
// "when we click on More>Version, it pops up a window that shows whats new in the latest push").
//
// EVERY PUSH adds to this list (with the version it came in): a new entry at the top for a new day, or more lines in today's. Plain words, what
// it does for the person, where it is. No other programs' names.

import { lang } from "../i18n";
import { icons } from "./icons";
import { el } from "./ui";

interface Update {
  /** The day it went out, YYYY-MM-DD. */
  date: string;
  /** The app's version it came in (package.json's appVersion). */
  version?: string;
  /** New things. */
  added?: string[];
  /** Things put right. */
  fixed?: string[];
}

export const UPDATES: Update[] = [
  {
    date: "2026-11-25",
    version: "0.8.7.1",
    added: ["More \u2192 Version lists the changes of every version, with its number."],
  },
  {
    date: "2026-11-25",
    version: "0.8.7.0",
    added: [
      "Measure works inside a sketch: the sketch stays open and its dimensions stay shown. Tap lines, circles and points (and faces or edges of bodies) for their length, diameter, radius, area, angle and the distance between two of them. Measure again, or Esc, goes back to drawing.",
      "Sketch → View: Show dimensions and Show constraints are two separate switches (also in the constraints column).",
      "The Items panel is the one open at the start, on every screen. History opens with its button.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.8.6.0",
    added: [
      "Move / Copy: Set pivot stays on till Done. Tap a point to put the pivot there, slide it along X or Y by the gimbal's arrows (the curves stay put), or type its X and Y.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.8.5.0",
    added: [
      "Picked sketch curves have a Move button beside them: it opens the Move / Copy window (on a phone too).",
      "Sketch → View → Pick closed shapes: switched off, a tap inside a closed shape no longer picks its area with the extrude arrow.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.8.4.0",
    added: [
      "Move / Copy window in a sketch: free move or point to point, the pivot, X and Y distances, angle, Create copy, OK and Cancel. It can be dragged by its title.",
      "The gimbal's centre dot can be dragged anywhere: that is the point the curves are held by and turned about.",
      "Sketch → View: bodies as they are, see-through or hidden; picking and snapping to the model on or off; grid.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.8.3.0",
    added: [
      "Move in a sketch point to point: pick the point to move by (an end, a middle, a centre, a point on a circle's edge), then where it goes.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.8.2.0",
    added: [
      "Sketch dimensions: click one to type a new size right where it is. Tab moves to the next size while drawing.",
      "OSNAP on the sketch's bottom bar: end, middle, centre, on a curve, quadrant, perpendicular, tangent - each on or off.",
      "Curves being moved snap to the other curves' points, with guide lines.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.8.0.0",
    added: [
      "Sketch dimensions are drawn with extension lines and arrows, and can be dragged where they read best. Pinned measurements can be dragged too.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.7.4.0",
    added: [
      "Changes from the original app merged in: Hole, a mesh you can edit, mouse styles of other CAD programs, a constraints list.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.7.3.0",
    added: [
      "Themes: dark, light and AMOLED black (Settings).",
      "Android app: the top bar sits under the camera cutout, and the S Pen settings are in groups.",
    ],
    fixed: ["The Android app closed at start after an update."],
  },
  {
    date: "2026-11-25",
    version: "0.7.1.0",
    added: [
      "Android app: the S Pen's side button and Air actions (the pen from afar), and full screen.",
    ],
    fixed: ["The Android app opened the browser at start."],
  },
  {
    date: "2026-11-25",
    version: "0.7.0.0",
    added: [
      "Android app (download from the site), with updates.",
      "Diagnostics: a log that can be sent for analysis. Interface size in Settings.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.6.0.1",
    added: [
      "The app in Polish (Settings → Language), and Settings → Update: load your own update package.",
      "A version number on the app: big.key.small.fix.",
    ],
    fixed: ["A tablet pen's hover shows snap marks; a pen test shows what the pen sends."],
  },
  {
    date: "2026-11-25",
    added: [
      "A mesh you can edit: an STL, OBJ or 3MF mesh now comes in with real faces where it can. Flat sides are one face each, and plain holes, bosses, pins and rounded upright corners are truly round, so Hole, Thread, Fillet and push/pull work on them. It helps simple parts most: chamfered holes, rounded edges and sculpted shapes come in as before. A mesh already in a project: tap its body, then Make Faces.",
      "A mesh file that holds several separate parts comes in as one body for each part.",
      "In a sketch, Constraints (n) on a picked line or shape opens the list of its constraints: delete one, type a new size, or delete them all.",
      "More → About: the app's name at the top opens the project's page on GitHub.",
    ],
    fixed: [
      "Every change to a body with very many faces is quicker.",
      "In a sketch, a line that ends on a circle closes the shape it should: the area between them fills and can be extruded.",
    ],
  },
  {
    date: "2026-11-24",
    added: [
      "Hole (Create → Hole): tap a flat face where a screw goes and choose the screw, M2 to M12, and its head: none, counterbore or countersink. The hole gets the right sizes, and each can be typed over. Drag its dot to move it, or type its distances from the edges.",
      "This window: More → Version shows what is new.",
      "Settings → Mouse: turn, move and zoom the view the way other CAD programs do it. The app's own way stays the default. The wheel can be turned round too.",
      "While drawing a shape with a mouse, its sizes show by the pointer: type a number, Tab to the next size, Enter to place it.",
      "A box dragged round the shapes of a sketch picks them all, and Ctrl + A picks everything. Useful for an imported drawing with hundreds of shapes.",
      "The guide text at the top has an × that puts it away (More → Guide text brings it back).",
    ],
    fixed: [
      "A rounding was lost on one edge when its extrude was edited to go the other way.",
      "The edge of a thickened freeform surface could not be rounded.",
      "On an iPad, STL and other files were greyed out in the file picker.",
      "On an iPhone with the app installed, the number pad's keys did not line up with where they were drawn.",
    ],
  },
  {
    date: "2026-11-23",
    added: [
      "Tutorial (More → Tutorial): build a real M10 bolt and its nut, one tap at a time.",
      "Assemblies, a first version (More → BIM → Assemblies): joints between bodies, parts dragged by them, and Stop on contact.",
      "A pattern of a hole repeats the hole itself. Threads can have several starts, like a jar's lid.",
      "A variable can be renamed everywhere at once. Sketch patterns and fill patterns can follow variables.",
      "Offsets, mirrored copies and projected curves follow the sketch curves they were made from.",
    ],
    fixed: [
      "The tutorial could stop taking taps at step 3 on some phones.",
      "A narrow shape in a sketch can be picked without zooming in on it.",
    ],
  },
  {
    date: "2026-11-22",
    added: [
      "Linked copies and patterns: change one, and the others follow.",
      "Fill Pattern in sketches.",
      "Freeform solids take every body tool.",
    ],
    fixed: ["A section's cut face looks the same whatever the body's colour."],
  },
];

const day = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang === "pl" ? "pl-PL" : undefined, { day: "numeric", month: "long", year: "numeric" });
};

/** The window: the newest update on top, the ones before it under it. */
export function showWhatsNew(version: string): void {
  const back = el("div", "dialog-back");
  const box = el("div", "dialog about whats-new");
  const head = el("div", "library-head");
  head.append(el("div", "panel-title", `What's new · Version ${version}`));
  const closeBtn = el("button", "icon-btn library-close");
  closeBtn.type = "button";
  closeBtn.title = "Close";
  closeBtn.innerHTML = icons.close;
  head.append(closeBtn);
  const body = el("div", "about-body");
  UPDATES.forEach((u, i) => {
    const h = el("h3", "", day(u.date));
    if (u.version) h.append(el("span", "whats-new-ver", `Version ${u.version}`));
    if (i === 0) h.append(el("span", "whats-new-tag", "Latest"));
    body.append(h);
    for (const [title, lines] of [["New", u.added], ["Fixed", u.fixed]] as const) {
      if (!lines?.length) continue;
      body.append(el("div", "whats-new-kind", title));
      const ul = el("ul", "");
      for (const line of lines) ul.append(el("li", "", line));
      body.append(ul);
    }
  });
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
