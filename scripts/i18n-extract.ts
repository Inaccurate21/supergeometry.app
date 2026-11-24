// Lists the app's English texts (string and template literals in src/) that
// have no Polish yet in src/i18n/pl.ts: `npx tsx scripts/i18n-extract.ts`.
// Writes i18n-missing.json (key → "") for translating (texts with no Polish
// on purpose - names, codes - are listed too: leave those out).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAst } from "rolldown/parseAst";

const files: string[] = [];
const walk = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.ts$/.test(n) && !/\.d\.ts$/.test(n)) files.push(p);
  }
};
walk("src");

/** Calls whose string arguments are never shown. */
const QUIET_CALLS = /^(querySelector(All)?|getElementById|closest|matches|addEventListener|removeEventListener|createElement|createElementNS|setAttribute|getAttribute|hasAttribute|removeAttribute|add|remove|toggle|contains|postMessage|getItem|setItem|removeItem|fetch|import|require|matchMedia|setProperty|getPropertyValue|startsWith|endsWith|includes|indexOf|split|replace|replaceAll|join|test|match|log|warn|error|debug|info|Error|RegExp|Symbol|define|dispatchEvent|Event|CustomEvent|has|get|set|delete)$/;

const keys = new Map<string, string>();
const looksShown = (s: string) => /[A-Za-z]{2}/.test(s) && (/[A-Za-z] [A-Za-z]/.test(s) || /^[A-Z][a-z]/.test(s) || /^\d+ [A-Z][a-z]/.test(s) || /^[A-Z]{2,}(-[A-Z][a-z]+)?$/.test(s) || /^[A-Z]-[A-Z][a-z]+$/.test(s) || /[.…:?!]$/.test(s.trim())) && !/^[\w.-]+\.(ts|js|json|css|svg|png|wasm)$/.test(s) && !/^(https?:|data:|blob:|#|\.|\/)/.test(s) && !/^[a-z]+(-[a-z0-9]+)+$/.test(s) && !/[{};]\s*$/.test(s) && !/^\s*</.test(s) && !/^[a-z][\w-]*( [a-z][\w-]*)+(\{\d\})*$/.test(s) && !/^[a-z-]+:\{\d\}$/.test(s);

function visit(node: any, parent: any, key: string, file: string): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) visit(n, parent, key, file);
    return;
  }
  if (typeof node.type !== "string") return;
  const t = node.type;
  if (t === "ImportDeclaration" || t === "ExportAllDeclaration" || t === "ExportNamedDeclaration" && node.source) {
    if (t !== "ExportNamedDeclaration") return;
  }
  if (t === "TSLiteralType" || t === "TSTypeAnnotation" || t === "TSTypeAliasDeclaration" || t === "TSInterfaceDeclaration" || t === "TSEnumDeclaration" || t === "TSModuleDeclaration" || t === "TSTypeReference" || t === "TSTypeParameterInstantiation") return;
  if (t === "CallExpression" || t === "NewExpression") {
    const c = node.callee;
    const name = c?.type === "Identifier" ? c.name : c?.type === "MemberExpression" && c.property?.type === "Identifier" ? c.property.name : "";
    if (QUIET_CALLS.test(name)) {
      // Only the callee and arguments that aren't plain strings.
      visit(c, node, "callee", file);
      for (const a of node.arguments) if (a.type !== "Literal" && a.type !== "TemplateLiteral") visit(a, node, "arguments", file);
      return;
    }
  }
  if (t === "BinaryExpression" && /^(===|!==|==|!=|in)$/.test(node.operator)) {
    if (node.left.type !== "Literal") visit(node.left, node, "left", file);
    if (node.right.type !== "Literal") visit(node.right, node, "right", file);
    return;
  }
  if (t === "SwitchCase") {
    visit(node.consequent, node, "consequent", file);
    return;
  }
  if (t === "Property" && !node.computed) {
    // A capitalised key is a heading (Items: { Bodies: [...], "Planes & axes": [...] }).
    const k = node.key?.type === "Identifier" ? node.key.name : node.key?.type === "Literal" ? String(node.key.value) : "";
    if (/^[A-Z][a-z]+( |$)/.test(k) && looksShown(k)) keys.set(k, file);
    visit(node.value, node, "value", file);
    return;
  }
  if (t === "MemberExpression" && node.computed && node.property.type === "Literal") {
    visit(node.object, node, "object", file);
    return;
  }
  if (t === "Literal" && typeof node.value === "string") {
    const s = node.value;
    if (looksShown(s)) keys.set(s, file);
    return;
  }
  if (t === "TemplateLiteral") {
    if (parent?.type === "TaggedTemplateExpression") return;
    const parts = node.quasis.map((q: any) => q.value.cooked ?? q.value.raw);
    const s = parts.map((p: string) => p.replace(/\{(\d+)\}/g, "{{$1}}")).join("\u0000");
    let n = 0;
    const k = s.replace(/\u0000/g, () => `{${n++}}`);
    if (looksShown(parts.join(" ")) && parts.join("").replace(/\s/g, "").length > 1) keys.set(k, file);
    for (const e of node.expressions) visit(e, node, "expressions", file);
    return;
  }
  for (const k of Object.keys(node)) {
    if (k === "type" || k === "start" || k === "end") continue;
    const v = node[k];
    if (v && typeof v === "object") visit(v, node, k, file);
  }
}

for (const f of files) {
  if (/src[\\/](i18n|debug\.ts|kernel[\\/](worker|protocol)\.ts)/.test(f)) continue;
  const ast = parseAst(readFileSync(f, "utf8"), { lang: "ts" }, f);
  visit(ast.body, null, "body", f);
}
// index.html: the visible text and titles.
const html = readFileSync("index.html", "utf8").replace(/<head>[\s\S]*<\/head>/, "").replace(/<main[\s\S]*?<\/main>/, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "");
for (const m of html.matchAll(/>([^<>]*[A-Za-z][^<>]*)</g)) keys.set(m[1].trim(), "index.html");
for (const m of html.matchAll(/(?:title|aria-label)="([^"]+)"/g)) keys.set(m[1], "index.html");

let have: Record<string, string> = {};
try {
  have = JSON.parse(readFileSync("src/i18n/pl.json", "utf8"));
} catch {
  // none yet
}
const out: Record<string, string> = {};
const all: Record<string, string> = {};
for (const [k, f] of keys) {
  all[k] = f;
  if (!(k in have)) out[k] = "";
}
writeFileSync(process.argv[2] ?? "i18n-missing.json", JSON.stringify(out, null, 1));
writeFileSync((process.argv[2] ?? "i18n-missing.json").replace(/\.json$/, ".files.json"), JSON.stringify(all, null, 1));
console.log(`${keys.size} texts, ${Object.keys(out).length} without Polish`);
