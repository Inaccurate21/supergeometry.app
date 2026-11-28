// Run: npx tsx tests/courselamp.test.ts
// The lamp the course builds (public/llms-teach.txt, lessons 1 to 9), as it came out built by hand in the app
// with the lessons' own taps and numbers (tests/fixtures/courselamp-hand.json): a base on three feet with its
// pole, a flared hollow shade, a freeform bulb, the head tilted - and its three variables changed, as lesson 8
// has the learner do. If a lesson's numbers stop fitting the app, this says so.
import { readFileSync } from "node:fs";
import type { Feature, ProjectDoc } from "../src/doc/types";
import { resolveDoc } from "../src/doc/params";
import { after, bodies, check, done, health, near, volume } from "./kit";

const read = (): ProjectDoc => JSON.parse(readFileSync(new URL("./fixtures/courselamp-hand.json", import.meta.url), "utf8")) as ProjectDoc;
const build = async (vars: Record<string, string> = {}) => {
  const doc = read();
  doc.variables = (doc.variables ?? []).map((v) => ({ ...v, expr: vars[v.name] ?? v.expr }));
  const problems = resolveDoc(doc);
  const { errors } = await after(doc.features as Feature[]);
  const all = [...bodies().entries()];
  const by = (type: string, n = 0) => {
    const ids = (doc.features as Feature[]).filter((f) => f.type === type).map((f) => f.id);
    return all.find(([id]) => id === ids[n])?.[1];
  };
  return { doc, problems, errors, all, base: by("extrude", 0), shade: by("extrude", 2), bulb: by("freeform", 0) };
};
type Box = { boundingBox: { bounds: [number[], number[]] } };
const box = (s: unknown) => (s as Box).boundingBox.bounds;
const size = (s: unknown) => [0, 1, 2].map((k) => box(s)[1][k] - box(s)[0][k]);

// The base and its pole: a disc 120 across and 12 tall, its rim rounded by 4 (what a ring of that corner holds,
// by Pappus), a pole 12 across and 200 tall, three recesses 12 across and 1.5 deep.
const RIM = 16 * (1 - Math.PI / 4) * 2 * Math.PI * (60 - (4 * (10 - 3 * Math.PI)) / (3 * (4 - Math.PI)));
const FOOT = Math.PI * 36 * 1.5;
const BASE = Math.PI * 3600 * 12 - RIM + Math.PI * 36 * 200;

{
  const { doc, problems, errors, all, base, shade, bulb } = await build();
  check("the lamp as the lessons build it: every step is made", !problems.length && !errors.length, [...problems, ...errors]);
  check("twelve steps, in the lessons' order", (doc.features as Feature[]).map((f) => f.type).join(" ") === "sketch extrude fillet sketch extrude sketch extrude shell freeform transform hole transform");
  check("three bodies: the base with its pole, the shade, the bulb", all.length === 3 && !!base && !!shade && !!bulb, all.map(([id]) => id));
  check("each a sound solid", [base, shade, bulb].every((s) => !!s && health(s!).healthy));
  check("lesson 3: the base and pole are 120 x 120 x 212", !!base && size(base).every((x, i) => near(x, [120, 120, 212][i], 1e-3)), base && size(base));
  check("lessons 1, 2, 3 and 6: its volume is the disc less its rounded rim, the pole, less three recesses", near(volume(base), BASE - 3 * FOOT, BASE * 2e-4), `${volume(base)} against ${BASE - 3 * FOOT}`);
  // The shade: 32 across at the pole, 70 long, leaning out 20 degrees: 32 + 2 * 70 * tan 20 = 82.96 across its mouth.
  const mouth = 32 + 140 * Math.tan((20 * Math.PI) / 180);
  check("lesson 4: the shade's mouth is 82.96 across (seen along Y, which the tilt leaves alone)", !!shade && near(size(shade)[1], mouth, 0.01), shade && size(shade));
  // Hollow: far less than the solid cone it was (a frustum 16 to 41.48 in radius, 70 long).
  const cone = (Math.PI * 70 * (16 * 16 + 16 * (mouth / 2) + (mouth / 2) ** 2)) / 3;
  check("lesson 4: it is hollow, walls 2", volume(shade) < cone * 0.25 && volume(shade) > cone * 0.1, `${volume(shade)} of ${cone}`);
  check("lesson 7: the head is tilted 30 degrees towards X about the pole's top", !!shade && box(shade)[1][0] > 60 && box(shade)[0][0] > -20 && near(box(shade)[0][1], -mouth / 2, 0.01), shade && box(shade));
  check("lesson 5: the bulb is about 40 across and 51 long, inside the shade", !!bulb && size(bulb)[1] > 39 && size(bulb)[1] < 41 && box(bulb)[0][2] > 205 && box(bulb)[1][2] < box(shade)[1][2], bulb && box(bulb));
}
{
  // Lesson 8: tilt, wall and feet given other values.
  const up = await build({ tilt: "0" });
  check("tilt 0: the shade stands straight on the pole, 212 to 282", !up.errors.length && !!up.shade && near(box(up.shade)[0][2], 212, 1e-3) && near(box(up.shade)[1][2], 282, 1e-3) && near(box(up.shade)[0][0], -box(up.shade)[1][0], 1e-3), up.shade && box(up.shade));
  check("tilt 0: the bulb's neck sits at the pole's top, inside the shade's floor", !!up.bulb && box(up.bulb)[0][2] > 212 && box(up.bulb)[0][2] < 216 && Math.abs(box(up.bulb)[0][0] + box(up.bulb)[1][0]) < 0.5, up.bulb && box(up.bulb));
  const far = await build({ tilt: "50" });
  check("tilt 50: made, and the head leans further", !far.errors.length && !!far.shade && box(far.shade)[1][0] > 75, far.shade && box(far.shade));
  const five = await build({ feet: "5" });
  check("feet 5: five recesses under the base", !five.errors.length && near(volume(five.base), BASE - 5 * FOOT, BASE * 2e-4), `${volume(five.base)} against ${BASE - 5 * FOOT}`);
  const thin = await build();
  const thick = await build({ wall: "3" });
  check("wall 3: a thicker shade, still sound", !thick.errors.length && !!thick.shade && health(thick.shade).healthy && volume(thick.shade) > volume(thin.shade) * 1.3, `${volume(thick.shade)} from ${volume(thin.shade)}`);
  const all3 = await build({ tilt: "50", feet: "5", wall: "3" });
  check("all three at once: three sound bodies", !all3.errors.length && all3.all.length === 3 && [all3.base, all3.shade, all3.bulb].every((s) => !!s && health(s!).healthy), all3.errors);
}
done();
