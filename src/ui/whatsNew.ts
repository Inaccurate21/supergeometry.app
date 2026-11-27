// More → Version: what is new. A short list per update, newest first, written for whoever uses the app.
//
// EVERY PUSH adds to this list: a new entry at the top for a new day, or more lines in today's. Plain words, what
// it does for the person, where it is. No other programs' names.

import { icons } from "./icons";
import { el } from "./ui";

interface Update {
  /** The day it went out, YYYY-MM-DD. */
  date: string;
  /** New things. */
  added?: string[];
  /** Things put right. */
  fixed?: string[];
}

export const UPDATES: Update[] = [
  {
    date: "2026-11-27",
    added: [
      "Offset Edge takes several edges: with Edge chosen, tap one edge and then any others (tap one again to let it go). They are offset together at one distance, and the ones that join keep their corners. Chain still takes the whole outline.",
      "Fill Pattern sizes are a share of the shape (Spacing %, Size %): 5 gives about twenty rows on a small shape and on a big one, so a big shape no longer fills with thousands of lines. One tap inside a shape fills it, and a pattern or size changed after that follows at once. With a mouse, the shape under the pointer lights up before you click.",
    ],
    fixed: [
      "In a sketch, a tool that is on has the bottom line to itself: its own buttons, Sketch view and the blue tick. Draw, Modify, Transform, Delete and Exit come back when the tick puts the tool down. A shape being drawn (Line, Rectangle, Circle, Arc, Spline, Polygon, Ellipse) keeps Draw, to switch to another shape.",
      "The blue tick finishes what the tool has set up and puts the tool down: a spline keeps the points placed, a line being drawn ends there, a pattern or an offset is applied, a text is set down. The cross beside it drops what is under way.",
      "Text: its X and Y are in its window only, no longer on the bottom line too.",
      "Polygon: Across flats is gone. Radius sets its size.",
      "Constraints list: the links a mirror, an offset or a pattern keeps between a copy and its original are no longer buttons named follow or pattern that one tap removed. They are in List all, by name.",
      "The bottom line no longer stays stretched after the Constraints list has been open.",
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
    fixed: [
      "Right-clicking a face or a body on a computer opens only the app's list of tools, not the browser's own menu on top of it.",
      "Sketch constraints in one place: pick a line or a shape and Constraints on the bottom line opens two rows, the ones in use (tap one to take it off, or List all to see every size and join) and the ones you can add (Parallel, Tangent, Equal...). The hint says so too.",
      "Construction (dashed lines) is in the Draw list now, at its end, not only under More.",
      "Drawing on a phone: a shape's values are just its sizes - a line's Length and Angle, a rectangle's Width and Height, a circle's Diameter (the first point's X and Y are gone, and a line's Across and Up).",
      "On a phone, a sketch's bottom bar is even: every button the same width, in one or two rows right across it (they were two blocks, the names cut short).",
      "The round buttons beside a pick are all one size, and a long name (Perpendicular, Coincident) is made smaller to fit instead of running over the edge.",
      "Transform lists Move/Rotate, Translate and Rotate Around Axis itself, not under Move.",
      "On a phone, a shape's first tap (a centre rectangle's centre) shows its yellow dot right away, and every point placed so far stays marked.",
      "In a sketch, More is gone: it held only Normal to Sketch, now a button of its own at the end of the bar called Sketch view. Other plane is gone too: a new empty sketch on the wrong plane is left with Exit (it leaves nothing behind).",
      "Constraints beside picked curves: a Constraints button between Construction and Delete opens the ones that fit (Parallel, Tangent, Equal...).",
      "Tangent between a line and an arc that meet end to end now joins them too: moving a line no longer pulls the arc's end off the other line. And a line ending on the origin: an arc drawn from there is joined to the line, not just held to the origin.",
      "Stop now stops. It ends the work before the next step and keeps everything already built, instead of throwing it all away and building the whole project again. A change is taken back; while a project is opening, the steps it had not reached are rolled back in History, so you can look at the part and remove the breakpoint when you are ready.",
      "Deleting a face of a big body (hundreds of faces) is about four times faster and takes far less memory: a 128-step part with one now opens in about half the time.",
      "A big project no longer gets built over again in the background after every change, which could keep a slower computer or a Chromebook busy for minutes.",
    ],
  },
  {
    date: "2026-11-25",
    added: [
      "Hole catches on more: tap near the point where an axis passes through the face, or near a sketch drawn on the face (the end of a line, where lines meet or cross, the centre of a circle), and the hole sits exactly there.",
      "A mesh you can edit: an STL, OBJ or 3MF mesh now comes in with real faces where it can. Flat sides are one face each, and plain holes, bosses, pins and rounded upright corners are truly round, so Hole, Thread, Fillet and push/pull work on them. It helps simple parts most: chamfered holes, rounded edges and sculpted shapes come in as before. A mesh already in a project: tap its body, then Make Faces.",
      "A mesh file that holds several separate parts comes in as one body for each part.",
      "Dimensions in a sketch are drawn as dimensions: lines out from what is measured, a line with arrows and the size on it. Click a size and type a new one right there.",
      "Pick a line, click Length and press Enter: that length is now a dimension, without retyping it.",
      "Constraints show what they tie together: a mark on every line involved, and pointing at a mark (or tapping it) lights up everything it ties. Pick a line and the lines it is tied to show faintly.",
      "Extrude, Revolve and Sweep say when only one part of a cut-up shape is picked, and that tapping its other parts adds them.",
      "In a sketch, Constraints (n) on a picked line or shape opens the list of its constraints: delete one, type a new size, or delete them all.",
      "More → About: the app's name at the top opens the project's page on GitHub.",
      "Model with Claude, on a computer: open Claude's extension for Chrome beside the app and say what you want. It builds it in your tab, every step in History for you to change. The Claude button at the bottom right says where to get it.",
      "For any AI assistant: the app has a page written for assistants (supergeometry.app/llms.txt) that says how to build models here.",
      "Claude builds with far fewer steps, so a part costs much less of your Claude usage and appears sooner. Its changes go into your open project one at a time: Ctrl + Z steps back through them, and your project list is not filled with copies.",
    ],
    fixed: [
      "Every change to a body with very many faces is quicker.",
      "In a sketch, constraint marks and dimension boxes no longer sit on top of each other.",
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
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
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
