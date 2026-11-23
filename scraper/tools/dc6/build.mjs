// build.mjs — puts the page together. No dependencies: the parts are plain scripts that share one function scope.
//
//   node scraper/tools/dc6/build.mjs                         → index.html at the repository root (reads data/radar.json at run time)
//   node scraper/tools/dc6/build.mjs --embed --out FILE      → one self-contained file with the current data/radar.json inside
//                                                              (the desktop app uses this; it still fetches fresh data when online)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../../.."), read = (f) => fs.readFileSync(path.join(here, f), "utf8");
const args = process.argv.slice(2), flag = (k) => args.includes(k), opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const PARTS = ["core.js", "theme.js", "dial.js", "i18n.js", "views.js", "app.js"];
const js = PARTS.map((p) => `/* ===== ${p} ===== */\n${read(p)}`).join("\n");
const css = read("base.css") + "\n" + read("app.css");
const embed = flag("--embed"), out = opt("--out") || path.join(root, "index.html");
const data = embed ? fs.readFileSync(path.join(root, "data/radar.json"), "utf8").replace(/</g, "\\u003c") : "";
const icon64 = path.join(root, "assets/icon-64.png");
const icons = embed
  ? (fs.existsSync(icon64) ? `<link rel="icon" href="data:image/png;base64,${fs.readFileSync(icon64).toString("base64")}">` : "")
  : `<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="assets/icon-64.png">\n<link rel="apple-touch-icon" href="assets/icon-192.png">`;
// function replacements: the parts contain "$&"-like sequences that String.replace would otherwise expand
const html = read("page.html").replace("<!--ICONS-->", () => icons).replace("/*FONTS*/", () => read("fonts.css")).replace("/*CSS*/", () => css).replace("/*DATA*/", () => data).replace("/*JS*/", () => js);
fs.writeFileSync(out, html);
console.log(`${path.relative(root, out) || out}: ${(html.length / 1024).toFixed(0)} KB (${embed ? "data embedded" : "reads data/radar.json"})`);
