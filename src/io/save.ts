// A made file handed to the device: saved through the system's own "Save to" window where there is one to use
// (Android: Drive and the other places the device knows are in it), else downloaded as ever.

/** The browser's window for choosing where a file is saved (File System Access), as far as it is used here. */
export type SavePicker = (o: { suggestedName: string }) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;

/**
 * The file written where the person chose in the system's window. "saved": written. "closed": they shut the window
 * - nothing is saved, and nothing is downloaded behind their back. "no": the window could not be used (the browser
 * refused it: too long since the tap, or no such thing after all) - the caller downloads it the plain way.
 */
export async function saveWhere(blob: Blob, name: string, picker: SavePicker): Promise<"saved" | "closed" | "no"> {
  let handle;
  try {
    handle = await picker({ suggestedName: name });
  } catch (err) {
    return (err as Error)?.name === "AbortError" ? "closed" : "no";
  }
  try {
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
    return "saved";
  } catch {
    // (Chosen, and then it could not be written: the plain way, so the file is not lost.)
    return "no";
  }
}

/** The plain way: the browser's own download, into its downloads folder. */
export function plainDownload(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * Save a made file. On Android, where the share sheet turns 3D files away and a download can only land in the
 * device's own storage, the system's "Save to" window is used when the browser has it: Drive is one of its places
 * (asked for: a part drawn on a tablet, wanted on the computer that prints it). Everywhere else, and where that
 * window cannot be had, a download as before.
 */
export function saveFile(blob: Blob, name: string): void {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (/Android/i.test(navigator.userAgent) && typeof picker === "function") {
    void saveWhere(blob, name, picker.bind(window)).then((how) => how === "no" && plainDownload(blob, name));
    return;
  }
  plainDownload(blob, name);
}
