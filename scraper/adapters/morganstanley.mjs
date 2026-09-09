// Morgan Stanley — two sources:
//  1) morganstanley.eightfold.ai (experienced hires, public search API)
//  2) morganstanley.tal.net campus job board (2027 programs, server-rendered HTML)
import { getJson, getText, job, guessType, sleep, stripTags, matchAll } from "../lib.mjs";

const EF = "https://morganstanley.eightfold.ai";
const TAL = "https://morganstanley.tal.net";

function efJob(p) {
  const locs = p.locations || [];
  return job({
    companyKey: "morganstanley",
    company: "Morgan Stanley",
    id: p.id,
    title: p.name,
    url: `${EF}${p.positionUrl || "/careers/job/" + p.id}`,
    locations: locs,
    postedAt: p.postedTs || p.creationTs || null,
    type: guessType(p.name),
    snippet: [p.department, p.displayJobId].filter(Boolean).join(" · "),
    extra: { division: p.department || null, level: null },
  });
}

async function eightfold(cfg, seen) {
  const searches = cfg.eightfoldSearches || [
    { query: "2027" },
    { query: "analyst", location: "Hong Kong" },
    { query: "analyst", location: "Toronto" },
    { query: "analyst", location: "New York" },
    { query: "analyst", location: "Chicago" },
    { query: "analyst", location: "Beijing" },
    { query: "analyst", location: "Shenzhen" },
  ];
  const maxPages = cfg.maxPages || 8;
  for (const s of searches) {
    for (let p = 0; p < maxPages; p++) {
      const u = `${EF}/api/pcsx/search?domain=morganstanley.com&query=${encodeURIComponent(s.query || "")}&location=${encodeURIComponent(s.location || "")}&start=${p * 10}&num=10`;
      const res = await getJson(u, { headers: { referer: `${EF}/careers` } });
      const list = res?.data?.positions || [];
      for (const pos of list) if (!seen.has(`ef:${pos.id}`)) seen.set(`ef:${pos.id}`, efJob(pos));
      const count = res?.data?.count || 0;
      if (!list.length || (p + 1) * 10 >= count) break;
      await sleep(200);
    }
  }
}

async function campus(cfg, seen) {
  const base = `${TAL}/vx/lang-en-GB/mobile-0/brand-2/candidate/jobboard/vacancy/1/adv/`;
  const maxPages = cfg.campusMaxPages || 6;
  for (let p = 0; p < maxPages; p++) {
    const html = await getText(`${base}?start=${p * 50}`);
    let n = 0;
    for (const m of matchAll(/<tr[^>]*class="[^"]*search_res[^"]*"[^>]*data-oppid="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g, html)) {
      const oppid = m[1];
      const row = m[2];
      const a = row.match(/<a[^>]*class="subject"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!a) continue;
      const title = stripTags(a[2]);
      const cells = [...matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g, row)].map((c) => stripTags(c[1]));
      const city = cells[1] || "";
      // strip the per-session xf-xxxx token so the URL is stable
      const href = a[1].replace(/\/xf-[a-z0-9]+\//i, "/");
      n++;
      const id = `campus-${oppid}`;
      if (seen.has(id)) continue;
      const paren = title.match(/\(([^)]+)\)\s*$/);
      const locs = city ? [city] : paren ? paren[1].split(/\s*(?:\/|,| or )\s*/) : [];
      seen.set(
        id,
        job({
          companyKey: "morganstanley",
          company: "Morgan Stanley",
          id,
          title,
          url: href,
          locations: locs,
          type: guessType(title, "campus"),
          snippet: "Morgan Stanley Campus (tal.net)",
          extra: { division: null, level: null, hint: "campus" },
        })
      );
    }
    if (n < 50) break;
    await sleep(300);
  }
}

export async function fetchJobs(cfg = {}) {
  const seen = new Map();
  const errors = [];
  for (const fn of [campus, eightfold]) {
    try {
      await fn(cfg, seen);
    } catch (e) {
      errors.push(`${fn.name}: ${e.message}`);
    }
  }
  if (errors.length && seen.size === 0) throw new Error(errors.join(" | "));
  const out = [...seen.values()];
  if (errors.length) out.warnings = errors;
  return out;
}

export const key = "morganstanley";
export const name = "Morgan Stanley";
