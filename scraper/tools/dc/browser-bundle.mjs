#!/usr/bin/env node
// Dev helper: bundle lib + match + one adapter into a single snippet that can be pasted into a
// browser console ON THE TARGET SITE (same-origin fetch). Useful when the dev box cannot reach
// the career sites directly. Usage: node scraper/tools/browser-bundle.mjs goldman '{"key":"goldman"}'
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const [adapter, cfgJson = "{}", fnName = "fetchJobs"] = process.argv.slice(2);
if (!adapter) {
  console.error("usage: browser-bundle.mjs <adapter> [cfgJson] [fnName]");
  process.exit(1);
}
const strip = (src) =>
  src
    .replace(/^import[^\n]*\n/gm, "")
    .replace(/^export\s+(async\s+)?function/gm, "$1function")
    .replace(/^export\s+const\s+(key|name)\s*=[^\n]*\n/gm, "")
    .replace(/^export\s+/gm, "");

const lib = strip(fs.readFileSync(path.join(ROOT, "scraper/lib.mjs"), "utf8"));
const match = strip(fs.readFileSync(path.join(ROOT, "scraper/match.mjs"), "utf8"));
const ad = strip(fs.readFileSync(path.join(ROOT, "scraper/adapters", adapter + ".mjs"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));

const code = `(async () => {
${lib}
${match}
${ad}
const cfg = ${cfgJson};
const t0 = Date.now();
const jobs = await ${fnName}(cfg);
const profile = ${JSON.stringify(config.profile)};
const m = buildMatcher(profile);
const tiers = {}; const strong = [];
for (const j of jobs) { const r = m(j); tiers[r.tier] = (tiers[r.tier]||0)+1; if (r.tier==='strong') strong.push(r.score+' | '+j.title+' | '+j.location+' | '+j.postedAt+' | '+r.reasons.join(',')); }
return { count: jobs.length, ms: Date.now()-t0, tiers, warnings: jobs.warnings, sample: jobs.slice(0,3), strong: strong.sort().reverse().slice(0,40) };
})()`;
process.stdout.write(code);
