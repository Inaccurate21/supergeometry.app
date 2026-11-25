// An update package of this build: dist/ zipped into supergeometry-update-<version>.zip,
// to load in the app with Settings → Updates → Load your own update package
// (src/ui/package.ts). `npm run package` builds first, then runs this.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync, type Zippable } from "fflate";

const dist = "dist";
const files: Zippable = {};
const walk = (dir: string) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(dist, p).replace(/\\/g, "/")] = [readFileSync(p), { level: /\.(png|jpg|woff2?)$/.test(n) ? 0 : 6 }];
  }
};
walk(dist);
if (!files["index.html"]) throw new Error("No dist/index.html: run npm run build first.");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string; appVersion?: string };
const version = pkg.appVersion ?? pkg.version;
const out = `supergeometry-update-${version}.zip`;
const zip = zipSync(files);
writeFileSync(out, zip);
console.log(`${out}: ${Object.keys(files).length} files, ${(zip.length / 1e6).toFixed(1)} MB`);
