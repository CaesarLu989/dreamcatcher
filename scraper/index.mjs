#!/usr/bin/env node
// DreamCatcher scraper — runs every few hours on GitHub Actions (or locally: `node scraper/index.mjs`).
// 1. fetch postings from every enabled company adapter
// 2. rule-based fit scoring (no AI)
// 3. diff against the previous data/jobs.json to find NEW postings
// 4. (optional) Claude scores only the new, rule-approved postings — needs ANTHROPIC_API_KEY
// 5. write data/jobs.json (+ data/scores.json memory) for the radar page
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMatcher } from "./match.mjs";
import { scoreJobs } from "./score.mjs";
import { job as normalizeJob, guessType } from "./lib.mjs";
import * as goldman from "./adapters/goldman.mjs";
import * as jpmorgan from "./adapters/jpmorgan.mjs";
import * as morganstanley from "./adapters/morganstanley.mjs";
import * as mckinsey from "./adapters/mckinsey.mjs";
import * as barclays from "./adapters/barclays.mjs";
import * as bnp from "./adapters/bnp.mjs";
import * as beisen from "./adapters/beisen.mjs";
import * as generic from "./adapters/generic.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const JOBS_FILE = path.join(DATA, "jobs.json");
const SCORES_FILE = path.join(DATA, "scores.json");

const ADAPTERS = {
  goldman: goldman.fetchJobs,
  jpmorgan: jpmorgan.fetchJobs,
  morganstanley: morganstanley.fetchJobs,
  mckinsey: mckinsey.fetchJobs,
  barclays: barclays.fetchJobs,
  bnp: bnp.fetchJobs,
  beisen: beisen.fetchJobs,
  greenhouse: generic.greenhouse,
  lever: generic.lever,
  ashby: generic.ashby,
  workday: generic.workday,
};

const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.startsWith("--") ? a.slice(2).split("=") : [a, true])).map(([k, v]) => [k, v ?? true]));
const only = args.only ? String(args.only).split(",") : null;
const noScore = !!args["no-score"];
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
      extra: { level: r.level || null, division: r.division || null, contract: r.contract, hint: r.hint, requirements: r.requirements },
    })
  );
}

async function main() {
  const config = readJson(path.join(ROOT, "config.json"), null);
  if (!config) throw new Error("config.json missing or invalid");
  fs.mkdirSync(DATA, { recursive: true });
  const prev = readJson(JOBS_FILE, { jobs: [], sources: {} });
  const prevById = new Map((prev.jobs || []).map((j) => [j.id, j]));
  const scores = readJson(SCORES_FILE, {});
  const match = buildMatcher(config.profile);
  const today = new Date().toISOString();

  const companies = (config.companies || []).filter((c) => c.enabled !== false && c.adapter && (!only || only.includes(c.key)));
  const sources = { ...(prev.sources || {}) };
  const fetched = [];
  let okCount = 0;

  for (const c of companies) {
    const fn = ADAPTERS[c.adapter];
    if (!fn) {
      log(`skip ${c.key}: unknown adapter ${c.adapter}`);
      continue;
    }
    const t0 = Date.now();
    try {
      // --fixtures=<dir> replaces live fetching with <dir>/<key>.json (arrays of raw postings) — for tests/page dev
      const jobs = args.fixtures ? loadFixture(path.join(String(args.fixtures), c.key + ".json")) : await fn(c);
      okCount++;
      sources[c.key] = { name: c.name, ok: true, count: jobs.length, fetchedAt: today, ms: Date.now() - t0, warnings: jobs.warnings || undefined };
      log(`${c.key}: ${jobs.length} postings (${Date.now() - t0} ms)${jobs.warnings ? " warnings: " + jobs.warnings.join(" | ") : ""}`);
      fetched.push(...jobs);
    } catch (e) {
      // keep last good data for this company so the page never goes blank
      const keep = (prev.jobs || []).filter((j) => j.companyKey === c.key).map((j) => ({ ...j, stale: true }));
      sources[c.key] = { ...(sources[c.key] || {}), name: c.name, ok: false, error: String(e.message || e).slice(0, 300), failedAt: today, count: keep.length, lastOkAt: sources[c.key]?.fetchedAt };
      log(`${c.key}: FAILED — ${e.message} (keeping ${keep.length} previous postings)`);
      fetched.push(...keep);
    }
  }
  if (companies.length && okCount === 0) throw new Error("every source failed — check network / endpoints");

  // If we ran with --only, keep the other companies' previous postings untouched.
  if (only) {
    const keys = new Set(companies.map((c) => c.key));
    fetched.push(...(prev.jobs || []).filter((j) => !keys.has(j.companyKey)));
  }

  // ---- match + diff
  const counts = { fetched: fetched.length, kept: 0, dropped: 0, new: 0, byTier: {} };
  const jobs = [];
  for (const raw of fetched) {
    const m = raw.stale && raw.match ? raw.match : match(raw);
    if (m.tier === "dropped") {
      counts.dropped++;
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

  // ---- optional Claude scoring for new, rule-approved postings
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

  // ---- output
  const d = (x) => x.postedAt || x.firstSeen.slice(0, 10);
  jobs.sort((a, b) => (b.ai?.fit || 0) - (a.ai?.fit || 0) || b.match.score - a.match.score || (d(b) > d(a) ? 1 : d(b) < d(a) ? -1 : 0) || (b.firstSeen > a.firstSeen ? 1 : -1));
  const out = {
    generatedAt: today,
    version: 2,
    profileCities: config.profile.cities,
    sources,
    counts,
    jobs: jobs.map((j) => ({
      id: j.id, companyKey: j.companyKey, company: j.company, title: j.title, url: j.url, location: j.location, locations: j.locations,
      postedAt: j.postedAt, closesAt: j.closesAt, type: j.type, snippet: j.snippet, division: j.division || null, level: j.level || null,
      match: j.match, ai: j.ai, firstSeen: j.firstSeen, lastSeen: j.lastSeen, stale: j.stale || undefined,
    })),
  };
  fs.writeFileSync(JOBS_FILE, JSON.stringify(out, null, 1));
  log(`wrote ${JOBS_FILE}: ${counts.kept} kept / ${counts.dropped} dropped / ${counts.new} new — tiers ${JSON.stringify(counts.byTier)}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
