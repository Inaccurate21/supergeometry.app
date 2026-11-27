// Run: npx tsx tests/startsize.test.ts
// The size a tool starts with is a share of what it is used on, as a round number, and the sizes it falls back
// through when that one does not fit are round too. And a fillet of that start size is one the kernel makes, on a
// small block and on one a metre across.
import { smallerSize, startSize } from "../src/geom";
import { after, block, check, done, near, volume } from "./kit";
import type { Feature } from "../src/doc/types";

for (const [extent, share, want] of [[20, 0.1, 2], [10, 0.1, 1], [1000, 0.1, 100], [37, 0.1, 4], [5, 0.1, 0.5], [0.4, 0.1, 0.04], [2500, 0.1, 300], [20, 0.05, 1], [1414.2, 0.25, 400], [3, 0.1, 0.3]] as number[][])
  check(`${share} of ${extent}: ${want}`, startSize(extent, share, 1) === want, startSize(extent, share, 1));
check("nothing to go by: the fallback", startSize(0, 0.1, 1) === 1 && startSize(NaN, 0.1, 7) === 7 && startSize(-5, 0.1, 2) === 2);
{
  const run: number[] = [300];
  while (run.length < 9) run.push(smallerSize(run[run.length - 1]));
  check("from 300 down: 200, 100, 50, 20, 10, 5, 2, 1", JSON.stringify(run) === JSON.stringify([300, 200, 100, 50, 20, 10, 5, 2, 1]), run);
  const small: number[] = [0.3];
  while (small.length < 5) small.push(smallerSize(small[small.length - 1]));
  check("from 0.3 down: 0.2, 0.1, 0.05, 0.02", JSON.stringify(small) === JSON.stringify([0.3, 0.2, 0.1, 0.05, 0.02]), small);
  check("always smaller, never nothing", [1, 2, 5, 7, 10, 0.5, 40, 99, 1e-3, 1e4].every((v) => smallerSize(v) < v && smallerSize(v) > 0));
}
// A block and a fillet of the start size on one of its upright edges: made, and the right amount taken off.
for (const s of [20, 1000]) {
  const fs = block("b", s, s, s);
  const r = startSize(s, 0.1, 1);
  const fillet = { id: "f", name: "f", type: "fillet", edges: [{ body: "b", mid: [0, 0, s / 2], dir: [0, 0, 1], length: s }], radius: r } as unknown as Feature;
  const { body, err } = await after([...fs, fillet]);
  const want = s * s * s - (r * r - (Math.PI * r * r) / 4) * s;
  check(`a block ${s} across, one edge rounded by ${r}: made, the corner's worth gone`, !err && near(volume(body), want, want * 1e-6), `${volume(body)} against ${want} ${err ?? ""}`);
}
done();
