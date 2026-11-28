// Run: npx tsx tests/facesums.test.ts [fixtures, comma separated]
// A body's exact volume and area are summed face by face, and a face left as it was by a step is not measured
// again (kernel/ocFree.ts faceSumsKept): it is known by its geometry. So a body measured at the end of a project,
// most of its faces found from earlier steps, must measure the same as when every face is measured afresh.
import { readFileSync } from "node:fs";
import type { Feature } from "../src/doc/types";
import { forgetFaceSums, measureArea, measureVolume } from "../src/kernel/ocFree";
import { deepCopy } from "../src/kernel/health";
import { after, bodies, check, done } from "./kit";

const names = (process.argv[2] ?? "lamp-hand,arcreactor,crankshaft-hand,desklamp-hand").split(",");
for (const name of names) {
  const j = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  const features = (Array.isArray(j) ? j : j.features) as Feature[];
  const { errors } = await after(features);
  const all = [...bodies().entries()];
  // As the build left them: faces found again from the steps before.
  const kept = all.map(([id, s]) => ({ id, vol: measureVolume(s), area: measureArea(s) }));
  // Afresh: a copy of each body (nothing known of it), nothing kept of any face.
  let worst = 0;
  let at = "";
  for (const [i, [id, s]] of all.entries()) {
    forgetFaceSums();
    const copy = deepCopy(s);
    const [vol, area] = [measureVolume(copy), measureArea(copy)];
    const off = Math.max(Math.abs(vol - kept[i].vol) / Math.max(1e-9, Math.abs(vol)), Math.abs(area - kept[i].area) / Math.max(1e-9, Math.abs(area)));
    if (off > worst) [worst, at] = [off, `${id}: volume ${kept[i].vol} / ${vol}, area ${kept[i].area} / ${area}`];
  }
  check(`${name}: ${all.length} bodies measure the same with faces found again as measured afresh (to a ten-millionth)`, !errors.length && all.length > 0 && worst < 1e-7, worst ? `worst ${worst.toExponential(2)} - ${at}` : "identical");
}
done();
