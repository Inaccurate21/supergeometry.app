// Run: npx tsx tests/savewhere.test.ts
// A made file saved through the system's "Save to" window (Android: Drive is one of its places): written where it
// was chosen; nothing saved or downloaded when the window is shut; and the plain download asked for when the
// window cannot be used or the writing fails - so a file is never lost on the way.
import { saveWhere, type SavePicker } from "../src/io/save";
import { check, done } from "./kit";

const blob = new Blob(["solid part"], { type: "model/stl" });
{
  const got: { name?: string; wrote?: Blob; closed?: boolean } = {};
  const picker: SavePicker = async (o) => ((got.name = o.suggestedName), { createWritable: async () => ({ write: async (b) => void (got.wrote = b), close: async () => void (got.closed = true) }) });
  const how = await saveWhere(blob, "Lamp.stl", picker);
  check("a place chosen: the file is written there, under its own name, and closed", how === "saved" && got.name === "Lamp.stl" && got.wrote === blob && got.closed === true, { how, ...got, wrote: !!got.wrote });
}
{
  const shut: SavePicker = async () => {
    throw Object.assign(new Error("The user aborted a request."), { name: "AbortError" });
  };
  check("the window shut: nothing saved, and no download asked for", (await saveWhere(blob, "Lamp.stl", shut)) === "closed");
}
{
  const refused: SavePicker = async () => {
    throw Object.assign(new Error("Must be handling a user gesture to show a file picker."), { name: "SecurityError" });
  };
  check("the window refused (too long since the tap): the plain download is asked for", (await saveWhere(blob, "Lamp.stl", refused)) === "no");
  const broken: SavePicker = async () => {
    throw new TypeError("not a function after all");
  };
  check("no such window after all: the plain download", (await saveWhere(blob, "Lamp.stl", broken)) === "no");
}
{
  const fails: SavePicker = async () => ({
    createWritable: async () => ({
      write: async () => {
        throw new Error("no room left");
      },
      close: async () => {},
    }),
  });
  check("chosen, but it could not be written: the plain download, so the file is not lost", (await saveWhere(blob, "Lamp.stl", fails)) === "no");
}
done();
