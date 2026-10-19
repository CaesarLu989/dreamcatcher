#!/usr/bin/env node
// DreamCatcher scraper — runs every few hours on GitHub Actions (or locally: `node scraper/index.mjs`).
// 1. fetch postings from every enabled company adapter (4 companies at a time)
// 2. company-level location filter (e.g. Toronto-only sources) + rule-based fit scoring (no AI)
// 3. hard-requirement check: descriptions are fetched lazily for promising postings (cached in data/details.json)
//    and postings asking for more experience / credentials than the profile allows are dropped
// 4. diff against the previous data/jobs.json to find NEW postings
// 5. (optional) Claude scores only the new, rule-approved postings — needs ANTHROPIC_API_KEY
// 6. write data/jobs.json (+ data/scores.json memory) for the radar page
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMatcher, buildSignals } from "./match.mjs";
import { scoreJobs } from "./score.mjs";
import { job as normalizeJob, guessType, parseRequirements, matchesCity, sleep } from "./lib.mjs";
import * as goldman from "./adapters/goldman.mjs";
import * as jpmorgan from "./adapters/jpmorgan.mjs";
import * as morganstanley from "./adapters/morganstanley.mjs";
import * as mckinsey from "./adapters/mckinsey.mjs";
import * as barclays from "./adapters/barclays.mjs";
import * as bnp from "./adapters/bnp.mjs";
import * as beisen from "./adapters/beisen.mjs";
import * as generic from "./adapters/generic.mjs";
import * as more from "./adapters/more.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const JOBS_FILE = path.join(DATA, "jobs.json");
const SCORES_FILE = path.join(DATA, "scores.json");
const DETAILS_FILE = path.join(DATA, "details.json");

const ADAPTERS = {
  goldman: goldman.fetchJobs,
  jpmorgan: jpmorgan.fetchJobs,
  morganstanley: morganstanley.fetchJobs,
  mckinsey: mckinsey.fetchJobs,
  barclays: barclays.fetchJobs,
  bnp: bnp.fetchJobs,
  beisen: beisen.fetchJobs,
  greenhouse: more.greenhouseFull,
  lever: more.leverFull,
  ashby: more.ashbyFull,
  workday: generic.workday,
  phenom: more.phenom,
  successfactors: more.successfactors,
  jibe: more.jibe,
  radancy: more.radancy,
  eightfold: more.eightfold,
  amazon: more.amazon,
  avature: more.avature,
};

const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.startsWith("--") ? a.slice(2).split("=") : [a, true])).map(([k, v]) => [k, v ?? true]));
const only = args.only ? String(args.only).split(",") : null;
const noScore = !!args["no-score"];
const noDetails = !!args["no-details"];
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

const readJson = (f, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return fallback;
  }
};

// --fixtures: raw rows captured from the live sites → same normalization the adapters apply
function loadFixture(file) {
  const rows = readJson(file, null);
  if (!rows) throw new Error("no fixture");
  return rows.map((r) =>
    normalizeJob({
      companyKey: r.companyKey, company: r.company, id: String(r.id).includes(":") ? String(r.id).split(":").slice(1).join(":") : r.id,
      title: r.title, url: r.url, locations: r.locations || [], postedAt: r.postedAt, closesAt: r.closesAt,
      type: r.type || r._type || guessType(r.title, r.hint || ""), snippet: r.snippet,
      extra: { level: r.level || null, division: r.division || null, contract: r.contract, hint: r.hint, requirements: r.requirements, description: r.description, locationsUnknown: r.locationsUnknown },
    })
  );
}

/** Run async tasks with limited concurrency, preserving order of results. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    })
  );
  return out;
}

async function main() {
  const config = readJson(path.join(ROOT, "config.json"), null);
  if (!config) throw new Error("config.json missing or invalid");
  fs.mkdirSync(DATA, { recursive: true });
  const prev = readJson(JOBS_FILE, { jobs: [], sources: {} });
  const prevById = new Map((prev.jobs || []).map((j) => [j.id, j]));
  const scores = readJson(SCORES_FILE, {});
  const details = readJson(DETAILS_FILE, {});
  const match = buildMatcher(config.profile, config.companies);
  const signals = buildSignals(config.profile); // dimension / résumé-keyword scan of description text
  const today = new Date().toISOString();
  const aliases = config.profile.cityAliases || {};

  const companies = (config.companies || []).filter((c) => c.enabled !== false && c.adapter && !String(c.key).startsWith("_") && (!only || only.includes(c.key)));
  const byKey = new Map(companies.map((c) => [c.key, c]));
  const sources = { ...(prev.sources || {}) };
  const fetched = [];
  let okCount = 0;

  // ---- 1. fetch (4 companies in parallel; each adapter paces its own requests)
  await pool(companies, Number(config.concurrency || 4), async (c) => {
    const fn = ADAPTERS[c.adapter];
    if (!fn) {
      log(`skip ${c.key}: unknown adapter ${c.adapter}`);
      return;
    }
    const t0 = Date.now();
    try {
      // --fixtures=<dir> replaces live fetching with <dir>/<key>.json (arrays of raw postings) — for tests/page dev
      let jobs;
      if (args.fixtures) {
        const f = path.join(String(args.fixtures), c.key + ".json");
        if (!fs.existsSync(f)) { log(`${c.key}: no fixture, skipped`); return; }
        jobs = loadFixture(f);
      } else jobs = await fn(c);
      // company-level location filter (rows with unknown locations are resolved later through fetchDetail)
      const before = jobs.length;
      const warnings = jobs.warnings || undefined; // adapters attach notes to the array; filter() below would drop them
      if (c.cities && c.cities.length) jobs = jobs.filter((j) => j.locationsUnknown || matchesCity(j.locations, c.cities, aliases));
      okCount++;
      sources[c.key] = { name: c.name, group: c.group || null, ok: true, count: jobs.length, fetchedAt: today, ms: Date.now() - t0, warnings, filteredFrom: before !== jobs.length ? before : undefined };
      log(`${c.key}: ${jobs.length} postings${before !== jobs.length ? ` (of ${before} fetched)` : ""} (${Date.now() - t0} ms)${warnings ? " warnings: " + warnings.join(" | ") : ""}`);
      fetched.push(...jobs);
    } catch (e) {
      // keep last good data for this company so the page never goes blank
      const keep = (prev.jobs || []).filter((j) => j.companyKey === c.key).map((j) => ({ ...j, stale: true }));
      sources[c.key] = { ...(sources[c.key] || {}), name: c.name, group: c.group || null, ok: false, error: String(e.message || e).slice(0, 300), failedAt: today, count: keep.length, lastOkAt: sources[c.key]?.fetchedAt };
      log(`${c.key}: FAILED — ${e.message} (keeping ${keep.length} previous postings)`);
      fetched.push(...keep);
    }
  });
  if (companies.length && okCount === 0) throw new Error("every source failed — check network / endpoints");
  for (const k of Object.keys(sources)) if (!byKey.has(k) && !(prev.jobs || []).some((j) => j.companyKey === k)) delete sources[k];

  // If we ran with --only, keep the other companies' previous postings untouched.
  if (only) {
    const keys = new Set(companies.map((c) => c.key));
    fetched.push(...(prev.jobs || []).filter((j) => !keys.has(j.companyKey)));
  }

  // ---- 2. first pass: rules only (cheap). Attach requirements already visible in the listing.
  const reqOf = (j) => parseRequirements([j.title, j.snippet, j.requirements, j.description].filter(Boolean).join("\n"));
  for (const j of fetched) {
    if (j.stale && j.match) continue;
    j.req = j.description || j.requirements ? reqOf(j) : parseRequirements(j.title + "\n" + (j.snippet || ""));
    if (j.description || j.requirements) { const sig = signals([j.requirements, j.description].filter(Boolean).join("\n")); j.textDims = sig.dims; j.textHits = sig.hits; j.textEntry = sig.entry; }
    j.match = match(j);
  }

  // ---- 3. description enrichment for promising postings whose adapter can fetch details
  const dc = { minScore: 52, maxPerRun: 300, concurrency: 4, ...(config.details || {}) };
  const wantDetail = (j) => {
    if (j.stale || noDetails || args.fixtures) return false;
    const c = byKey.get(j.companyKey);
    const fn = c && ADAPTERS[c.adapter];
    if (!fn || !fn.fetchDetail) return false;
    if (j.description) return false; // listing already carried the text
    if (j.locationsUnknown) return true; // need the cities to apply the company filter
    return j.match.tier !== "dropped" && j.match.score >= dc.minScore;
  };
  const retryAfter = 3 * 86400000;
  // (re)fetch when: never fetched · failed more than 3 days ago · fetched by an older version without the signal scan
  const candidates = fetched.filter((j) => wantDetail(j) && (!details[j.id] || (details[j.id].ok && !details[j.id].sig) || (!details[j.id].ok && Date.now() - new Date(details[j.id].at || 0).getTime() > retryAfter)));
  const toFetch = candidates.sort((a, b) => (b.locationsUnknown ? 1 : 0) - (a.locationsUnknown ? 1 : 0) || b.match.score - a.match.score).slice(0, dc.maxPerRun);
  if (toFetch.length) log(`fetching ${toFetch.length} job descriptions (${candidates.length} candidates, cache has ${Object.keys(details).length})…`);
  let fetchedDetails = 0;
  await pool(toFetch, dc.concurrency, async (j) => {
    const c = byKey.get(j.companyKey);
    try {
      const d = await ADAPTERS[c.adapter].fetchDetail(c, j);
      const sig = d && d.description ? signals(d.description) : null;
      details[j.id] = { req: d && d.description ? parseRequirements(d.description) : null, sig: sig ? { dims: sig.dims, hits: sig.hits, entry: sig.entry || undefined } : { dims: {}, hits: [] }, locations: d && d.locations && d.locations.length ? d.locations : undefined, postedAt: d && d.postedAt ? d.postedAt : undefined, at: today, ok: !!d };
      fetchedDetails++;
      await sleep(150);
    } catch (e) {
      details[j.id] = { req: null, at: today, ok: false, error: String(e.message || e).slice(0, 120) };
    }
  });
  if (fetchedDetails) log(`fetched ${fetchedDetails} descriptions`);

  // apply cached/new details: resolved locations → company city filter; parsed requirements → final match
  const jobsAfter = [];
  for (const j of fetched) {
    const d = details[j.id];
    if (d && !j.stale) {
      if (d.locations && (!j.locations.length || j.locationsUnknown)) {
        j.locations = [...new Set(d.locations)];
        j.location = j.locations.length > 6 ? j.locations.slice(0, 5).join(" · ") + ` · +${j.locations.length - 5} more` : j.locations.join(" · ");
        delete j.locationsUnknown;
      }
      if (d.postedAt && !j.postedAt) j.postedAt = d.postedAt;
      if (d.sig) { j.textDims = { ...(j.textDims || {}), ...(d.sig.dims || {}) }; j.textHits = [...new Set([...(j.textHits || []), ...(d.sig.hits || [])])]; if (d.sig.entry) j.textEntry = true; }
      if (d.req) {
        // merge: listing-level requirements first, description-level wins when it says more
        const lr = j.req || {};
        j.req = { ...lr, ...d.req, creds: [...new Set([...(lr.creds || []), ...(d.req.creds || [])])], credsSoft: [...new Set([...(lr.credsSoft || []), ...(d.req.credsSoft || [])])] };
        if (lr.minYears != null && (d.req.minYears == null || (lr.minYears > d.req.minYears && !lr.yearsSoft))) { j.req.minYears = lr.minYears; j.req.yearsSoft = lr.yearsSoft; }
      }
      j.match = match(j);
    }
    const c = byKey.get(j.companyKey);
    if (c && c.cities && c.cities.length && !j.stale) {
      if (j.locationsUnknown) continue; // cities still unresolved (detail cap reached) — it shows up once a later run resolves them
      if (!j.locationsUnknown && !matchesCity(j.locations, c.cities, aliases)) continue;
    }
    jobsAfter.push(j);
  }
  // prune the details cache: forget postings not seen for 45 days
  const seenIds = new Set(fetched.map((j) => j.id));
  for (const id of Object.keys(details)) if (!seenIds.has(id) && Date.now() - new Date(details[id].at || 0).getTime() > 45 * 86400000) delete details[id];
  fs.writeFileSync(DETAILS_FILE, JSON.stringify(details));

  // ---- 4. keep / drop + diff
  const counts = { fetched: fetched.length, kept: 0, dropped: 0, droppedHard: 0, new: 0, byTier: {} };
  const jobs = [];
  for (const raw of jobsAfter) {
    const m = raw.stale && raw.match ? raw.match : raw.match;
    if (m.tier === "dropped") {
      counts.dropped++;
      if ((m.reasons || []).some((r) => /^(years|cred):/.test(r))) counts.droppedHard++;
      continue;
    }
    const before = prevById.get(raw.id);
    const isNew = !before;
    if (isNew) counts.new++;
    const j = {
      ...raw,
      match: m,
      firstSeen: before?.firstSeen || today,
      lastSeen: today,
      ai: scores[raw.id] || before?.ai || null,
    };
    delete j.stale;
    if (raw.stale) j.stale = true;
    jobs.push(j);
    counts.kept++;
    counts.byTier[m.tier] = (counts.byTier[m.tier] || 0) + 1;
  }

  // ---- 5. optional Claude scoring for new, rule-approved postings
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sc = config.scoring || {};
  const scoringOn = sc.enabled !== false && apiKey && !noScore;
  const tiers = new Set(sc.tiers || ["strong", "possible"]);
  const toScore = jobs
    .filter((j) => !j.ai && tiers.has(j.match.tier))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, sc.maxPerRun || 40);
  if (scoringOn && toScore.length) {
    log(`scoring ${toScore.length} new postings with ${sc.model}…`);
    const res = await scoreJobs(toScore, { profile: config.profile.summary, model: sc.model || "claude-haiku-4-5", batchSize: sc.batchSize || 10, apiKey, log });
    for (const j of jobs) if (res[j.id]) j.ai = res[j.id];
    Object.assign(scores, res);
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 1));
  } else if (toScore.length) {
    log(`${toScore.length} postings await scoring (${apiKey ? "scoring disabled" : "no ANTHROPIC_API_KEY — rule-based only"})`);
  }

  // ---- 6. output
  const d = (x) => x.postedAt || x.firstSeen.slice(0, 10);
  jobs.sort((a, b) => (b.ai?.fit || 0) - (a.ai?.fit || 0) || b.match.score - a.match.score || (d(b) > d(a) ? 1 : d(b) < d(a) ? -1 : 0) || (b.firstSeen > a.firstSeen ? 1 : -1));
  const groups = config.groups || {};
  const companyGroup = {};
  for (const c of config.companies || []) if (c.name && c.group) companyGroup[c.name] = c.group;
  const resumeTags = {};
  for (const it of ((config.profile.resumeKeywords || {}).items || [])) if (it.tag) resumeTags[it.tag] = it.en || it.tag;
  const out = {
    generatedAt: today,
    version: 4,
    profileCities: config.profile.cities,
    groups,
    companyGroup,
    resumeTags, // 命中 tag → English label (the page shows the English one in EN mode)
    sources,
    counts,
    jobs: jobs.map((j) => ({
      id: j.id, companyKey: j.companyKey, company: j.company, title: j.title, url: j.url, location: j.location, locations: j.locations,
      postedAt: j.postedAt, closesAt: j.closesAt, type: j.type, snippet: j.snippet, division: j.division || null, level: j.level || null,
      match: j.match, ai: j.ai, firstSeen: j.firstSeen, lastSeen: j.lastSeen, stale: j.stale || undefined,
    })),
  };
  fs.writeFileSync(JOBS_FILE, JSON.stringify(out, null, 1));
  log(`wrote ${JOBS_FILE}: ${counts.kept} kept / ${counts.dropped} dropped (${counts.droppedHard} on hard requirements) / ${counts.new} new — tiers ${JSON.stringify(counts.byTier)}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
