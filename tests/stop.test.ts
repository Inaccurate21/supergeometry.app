// Run: npx tsx tests/stop.test.ts
// Stop: a rebuild asked to stop ends before its next step and keeps what it built; asked again it carries on from
// there and comes out as one from nothing does. A Stop is for one rebuild: not for other work on the same steps,
// not for the rebuild after it, and it holds till the one it is for has begun. Each step built is named as it
// begins (the page then knows where a rebuild was), the first one too; a step rolled back is never where it stops.
import { askStop, rebuildBegins, rebuildEnds, regenerate, resetKernel, setOnStep, Stopped } from "../src/kernel/engine";
import type { Feature } from "../src/doc/types";
import { block, bodies, check, done, near, volume } from "./kit";

// Five blocks side by side, each its own sketch and extrude: ten steps.
const steps: Feature[] = [0, 1, 2, 3, 4].flatMap((i) => block(`b${i}`, 10, 10, 5 + i, [i * 20, 0, 0]));
const ids = steps.map((f) => f.id);
const total = () => [...bodies().values()].reduce((s, b) => s + volume(b), 0);
const whole = [0, 1, 2, 3, 4].reduce((s, i) => s + 100 * (5 + i), 0);

/** One rebuild as the page's worker runs it: the steps named as they are built, and where it stopped (null: it did not). */
async function rebuild(id: number | null, fs: Feature[], onStep?: (step: string) => void): Promise<{ seen: string[]; stopped: string | null }> {
  const seen: string[] = [];
  setOnStep((step) => (seen.push(step), onStep?.(step)));
  if (id !== null) rebuildBegins(id);
  try {
    await regenerate(fs);
    return { seen, stopped: null };
  } catch (err) {
    if (!(err instanceof Stopped)) throw err;
    return { seen, stopped: err.featureId };
  } finally {
    if (id !== null) rebuildEnds(id);
    setOnStep(null);
  }
}

{
  resetKernel();
  const r = await rebuild(1, steps);
  check("every step built is named as it begins, the first one too", r.stopped === null && r.seen.join() === ids.join(), r.seen);
  check("  and the five blocks are there", bodies().size === 5 && near(total(), whole, 1e-6), total());
}
{
  // Asked to stop as the seventh step is about to be built: it ends there, the six before it built.
  resetKernel();
  const r = await rebuild(2, steps, (step) => step === ids[6] && askStop(2));
  check("a Stop ends the rebuild before its next step, and says which", r.stopped === ids[6] && r.seen.join() === ids.slice(0, 7).join(), r);
  // Asked again: it carries on from there - the six are not built again - and comes out whole.
  const again = await rebuild(3, steps);
  check("asked again, it carries on from where it stopped", again.stopped === null && again.seen.join() === ids.slice(6).join(), again.seen);
  check("  and comes out as a rebuild from nothing does", bodies().size === 5 && near(total(), whole, 1e-6), total());
}
{
  // A Stop for another rebuild does not stop this one...
  resetKernel();
  askStop(99);
  const r = await rebuild(4, steps);
  check("a Stop meant for another rebuild leaves this one alone", r.stopped === null && r.seen.length === ids.length, r);
  // ...nor other work on the same steps (an export, a drawing: no rebuild of the page's is on)...
  resetKernel();
  const other = await rebuild(null, steps);
  check("  and other work on the same steps", other.stopped === null && other.seen.length === ids.length, other);
  // ...and it is still there when its own rebuild begins: that one ends before its first step.
  resetKernel();
  const own = await rebuild(99, steps);
  check("  it holds till its own rebuild begins: that one stops before its first step", own.stopped === ids[0] && own.seen.join() === ids[0], own);
  // Ended, it is forgotten: the next rebuild with nothing asked runs through.
  const next = await rebuild(100, steps);
  check("  and is forgotten once that rebuild has ended", next.stopped === null, next);
}
{
  // The last two blocks rolled back (History's breakpoint), and a Stop that arrives while the last step before
  // them is being built: there is nothing left to stop - the rebuild ends whole, with what it built to show.
  resetKernel();
  const rolled = steps.map((f, i) => (i >= 6 ? ({ ...f, rolledBack: true } as Feature) : f));
  // (Asked in the middle of that step: once the engine is inside it, as a Stop pressed during a long step is.)
  const r = await rebuild(5, rolled, (step) => step === ids[5] && void Promise.resolve().then(() => askStop(5)));
  check("a Stop during the last step before a breakpoint: the rebuild ends whole, not at a rolled-back step", r.stopped === null && r.seen.join() === ids.slice(0, 6).join(), r);
  check("  with the three blocks it built", bodies().size === 3 && near(total(), 100 * (5 + 6 + 7), 1e-6), `${bodies().size} bodies, ${total()}`);
  // The same Stop with a real step still to come ends before that step.
  resetKernel();
  const mid = await rebuild(6, steps, (step) => step === ids[5] && void Promise.resolve().then(() => askStop(6)));
  check("  with a step still to build after it, it ends before that one", mid.stopped === ids[6], mid);
}

done();
