// More → Version: what is new. A short list per update, newest first, written for whoever uses the app.
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
    date: "2026-11-27",
    version: "0.10.3.0",
    added: [
      "OSNAP in the other body tools too: wherever a point is picked on the model (a plane through 3 points, an axis through 2, Move or Scale from a point to a point, a joint's place), corners, the ends and middles of edges, the centres of round edges and flat faces, and a sketch's points are caught - a square by the pointer shows which before the tap. Its mode (Smart, As in the sketch, Off) is in the tool's window.",
      "Changes from the original app: More → GitHub, Color and Fade in the round buttons by a picked body, and a course for an AI assistant to teach the app.",
    ],
  },
  {
    date: "2026-11-26",
    added: [
      "More → GitHub opens the project's page: the code, the open issues and where to report one.",
      "Color and Fade beside a picked body: tap the body, then More in the round buttons next to it. The choices open in the same card, so you can try one colour after another. Teal is gone from the colours, so they fit in two rows; bodies already teal stay teal (shown as Custom).",
      "Transparency is now called Fade, and an image's Opacity too: one word for how see-through something is, 0% solid, 75% very faint. Your bodies and images look the same as before.",
      "Learn the app with Claude: ask it to teach you. It has a course of eight lessons, from a first block to holes, round parts, parts that fit and variables. You do the tapping; it tells you what to tap and why, and checks each step.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.10.2.0",
    added: [
      "A tap on the arrows, the ring or the dot of picked sketch curves opens Move / Copy with its window (it picked the shape under them, its outline lit). The selection filter now holds in a sketch too: its curves, points, centres and shapes.",
      "OSNAP for a Hole's dot: Smart (the middle of the face, the middles of its edges, round centres, the face's middle lines - symmetric - and in line with other holes), All (corners too), As in the sketch, or Off.",
      "Tool tips as in Fusion: hold the mouse or the pen over a tool for its name, key, a picture and what it does.",
      "Selection filter: profiles (ready ones and your own, saved with Save as…) and the order of its list (▲ ▼).",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.10.1.0",
    added: [
      "A sketch's dimension is typed into by a tap on it again on phones and with a pen: the box comes up over it, with the number pad, and a slight wobble of the finger no longer drags it away.",
      "Dimension in a sketch (Draw → Dimension, as Fusion's Sketch Dimension): a line's length, a circle's diameter, an arc's radius, a rectangle's side, the distance between points or lines, the angle between two lines - then type the size.",
      "Taking the arrows or the ring of picked sketch curves opens Move / Copy with its window at once (no M needed); OK puts the move in.",
      "App settings only in More (the gear at the right keeps just the drawing's).",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.10.0.0",
    added: [
      "Create has the solid tools in one place, as in Fusion: Extrude, Revolve, Sweep, Loft, Hole, Thread, Primitives, Press Pull, Combine, Split Body, Split Face, Shell, Fillet and Chamfer.",
      "Primitives: Box, Cylinder, Cone, Sphere, Torus and Coil (a spring) on a plane or the face picked - each a sketch and its step, so the sizes can be changed later in History.",
      "Combine: one tool for Join, Cut and Intersect, with Keep tools and New body.",
      "Press Pull: a face is offset, an edge is rounded. Split Face: a face cut by a sketch's shape on it or by edges.",
      "Hole: a chamfer round the mouth, and a drill point (118°) at a blind hole's bottom.",
      "Keyboard: S opens your favourite tools with a search (★ adds one), D is Measure, Ctrl+F full screen (F11 stays). Every key can be changed: More → App settings → Controls → Keyboard shortcuts.",
      "Pinned measurements can be picked (a click, Ctrl+click, or a box round them) and deleted with Delete.",
      "Settings are sorted: the gear at the right holds the drawing's (units, grid, snapping, appearance); the rest is in More → App settings (screen, controls, project, app).",
      "Autosave: every change is saved at once; a copy also goes into the project list every few minutes (App settings → Project).",
      "Settings are kept through updates: backed up in the Android app and the browser, and can be saved to a file and loaded back.",
      "Wider buttons: Polish names fit on the line at the bottom, the side columns and the top bar.",
      "Changes from the original app: Model with Claude (the button at the bottom right), fills and extrudes of touching areas, Hole catching on axes and sketches, fillets on shells.",
    ],
  },
  {
    date: "2026-11-25",
    version: "0.9.0.0",
    added: [
      "The Browser (top bar, at the left) took the place of Items: Document settings (units), Named views (save the view, tap one to look from it), Origin (the axes and the XY, XZ and YZ planes, each shown or hidden), then Bodies, Sketches, Construction geometry, Images and Joints.",
      "Calculator (left edge): numbers, + - × ÷ ^, brackets, √, π and the project's variables. Copy the result, paste a value, or Insert it into the box typed in last.",
      "Measure as in Fusion: Results, Selection 1 and Selection 2, with each pick's sizes, its X, Y, Z and how far it is from each axis. Show snap points picks ends, middles, centres and quadrants. Each value can be copied (to the clipboard and the calculator) or pinned.",
      "Selection filter (the funnel at the left edge): pick only bodies, faces of a kind (flat, cylinders, cones, spheres), edges, vertices, centre points, sketch curves, points or shapes, or planes.",
      "Select Other: press and hold still where several things lie (a line drawn over another, an edge behind a face) and choose the one you mean from the list.",
      "Sketch: Point, Slot (centre to centre, overall, or from its centre), Ellipse by its centre, by the ends of its axis or in a box, and Break (a curve cut where another crosses it, every piece kept).",
      "Rectangle draws from its centre by default.",
    ],
  },
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
      "Hole catches on more: tap near the point where an axis passes through the face, or near a sketch drawn on the face (the end of a line, where lines meet or cross, the centre of a circle), and the hole sits exactly there.",
      "A mesh you can edit: an STL, OBJ or 3MF mesh now comes in with real faces where it can. Flat sides are one face each, and plain holes, bosses, pins and rounded upright corners are truly round, so Hole, Thread, Fillet and push/pull work on them. It helps simple parts most: chamfered holes, rounded edges and sculpted shapes come in as before. A mesh already in a project: tap its body, then Make Faces.",
      "A mesh file that holds several separate parts comes in as one body for each part.",
      "Pick a line, click Length and press Enter: that length is now a dimension, without retyping it.",
      "Extrude, Revolve and Sweep say when only one part of a cut-up shape is picked, and that tapping its other parts adds them.",
      "In a sketch, Constraints (n) on a picked line or shape opens the list of its constraints: delete one, type a new size, or delete them all.",
      "More → About: the app's name at the top opens the project's page on GitHub.",
      "Model with Claude, on a computer: open Claude's extension for Chrome beside the app and say what you want. It builds it in your tab, every step in History for you to change. The Claude button at the bottom right says where to get it.",
      "For any AI assistant: the app has a page written for assistants (supergeometry.app/llms.txt) that says how to build models here.",
      "Claude builds with far fewer steps, so a part costs much less of your Claude usage and appears sooner. Its changes go into your open project one at a time: Ctrl + Z steps back through them, and your project list is not filled with copies.",
    ],
    fixed: [
      "Every change to a body with very many faces is quicker.",
      "A shell's rim can be rounded on both edges by half the wall (two 0.5 mm fillets on a 1 mm wall), for a fully round rim.",
      "Two edges in one line with different walls beside them, rounded together, come out as two clean rounds.",
      "In a sketch, a line that ends on a circle closes the shape it should: the area between them fills and can be extruded.",
      "Several touching areas of a sketch extruded together always come out whole. A ring could go missing from the body when one of its circles ran a hair from another line.",
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
