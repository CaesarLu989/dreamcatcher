// DreamCatcher browser relay — reads Workday career sites from a real browser and hands the result to GitHub.
//
// Why: Workday answers HTTP 429 to GitHub's servers, so the scheduled scan cannot read the banks, the pension funds,
// Brookfield and most of the newer firms. A browser on a home connection can. This script runs in a tab that is ON the
// tenant's own site (https://<tenant>.<wd>.myworkdayjobs.com/robots.txt is enough), loads the scanner's own modules from
// the published repository, and does for one firm what scraper/index.mjs does: list, keep Toronto / Hong Kong, match,
// read the descriptions worth reading. The result is kept in window.name, which survives going from one tenant to the
// next, and ends up as data/relay.json (see scraper/index.mjs, "browser relay").
//
// In the tab, once per tenant:
//   (0, eval)(await (await fetch("https://caesarlu989.github.io/dreamcatcher/scraper/tools/relay.js", { cache: "no-cache" })).text()); await DC.read("td")
// DC.plan()    → [[key, "https://…/robots.txt"], …] every Workday firm worth reading, in order
// DC.read(key) → reads one firm; returns one status line (never the data). At most 160 descriptions per call:
//                when the line says some are "left for next time", call it again and it carries on from there
// DC.status()  → what has been read so far
// DC.finish()  → builds the file, keeps it in window.name and opens GitHub's upload page for data/
// On that page the caller stages it (see RELAY in the README) and commits. Nothing here needs a password or a token.
(() => {
  const BASE = String(globalThis.DC_BASE || "https://caesarlu989.github.io/dreamcatcher/").replace(/\/?$/, "/");
  const UPLOAD = "https://github.com/CaesarLu989/dreamcatcher/upload/main/data";
  const REGION = /toronto|mississauga|markham|north york|etobicoke|scarborough|vaughan|oakville|hong\s?kong|kowloon|hksar/i;
  const ELSEWHERE = /new york|chicago|shenzhen|shanghai|san francisco|boston|london|singapore/i;
  const ABOUT = "Postings read through a real browser for Workday sources that answer HTTP 429 to GitHub's servers (scraper/tools/relay.js). scraper/index.mjs uses a firm's entry only when its own read of that firm fails. Each firm: readAt; complete = the whole Toronto / Hong Kong listing was read; postings = that listing, shaped like the adapter's rows; details = what the scanner would have parsed from the descriptions it wanted. A reading older than three weeks is ignored.";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = async (p) => { const r = await fetch(BASE + p, { cache: "no-cache" }); if (!r.ok) throw new Error(`cannot load ${p}: HTTP ${r.status}`); return r.text(); };
  // the scanner's modules are ES modules; here they are evaluated as plain functions that return what is needed
  const mod = (src, names, deps = {}) => new Function(...Object.keys(deps), src.replace(/^import\s[^;]*;[ \t]*$/gm, "").replace(/^export\s+/gm, "") + `\nreturn { ${names.join(", ")} };`)(...Object.values(deps));
  const state = () => { try { const s = JSON.parse(window.name || "{}"); if (s && s.dc === 2) return s; } catch {} return { dc: 2, startedAt: new Date().toISOString(), firms: {}, log: [] }; };
  const save = (s) => { window.name = JSON.stringify(s); };
  const pool = async (items, n, fn) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); await sleep(80); } })); };
  const H = { "content-type": "application/json", accept: "application/json", "accept-language": "en-US" };
  const call = async (url, body) => {
    for (let i = 0; ; i++) {
      const r = await fetch(url, body ? { method: "POST", headers: H, body: JSON.stringify(body) } : { headers: H });
      if (r.ok) return r.json();
      if (r.status === 404 || r.status === 410) return null;
      if (i >= 3 || (r.status !== 429 && r.status < 500)) throw new Error(`HTTP ${r.status} ${url}`);
      await sleep(2500 * (i + 1));
    }
  };

  let ready = null;
  const load = () => (ready ||= (async () => {
    const [cfgT, libT, matchT, genT] = await Promise.all(["config.json", "scraper/lib.mjs", "scraper/match.mjs", "scraper/adapters/generic.mjs"].map(text));
    const config = JSON.parse(cfgT);
    const L = mod(libT, ["job", "guessType", "parseRequirements", "htmlToText", "matchesCity", "toDate", "getJson", "postJson", "sleep"]);
    const M = mod(matchT, ["buildMatcher", "buildSignals"]), G = mod(genT, ["workdayRow", "workdayDetail"], L);
    let prev = null; try { prev = JSON.parse(await text("data/relay.json")); } catch {}
    return { config, L, G, match: M.buildMatcher(config.profile, config.companies), signals: M.buildSignals(config.profile), prev: prev && prev.version === 2 ? prev : null };
  })());
  const hostOf = (c) => `${c.tenant}.${c.wd || "wd5"}.myworkdayjobs.com`;
  const inScope = (c) => c.adapter === "workday" && c.enabled !== false && !String(c.key).startsWith("_") && (c.cities || []).some((x) => REGION.test(x));

  /** Every Workday firm worth reading, grouped so that firms on the same host follow each other. */
  async function plan() {
    const { config } = await load(), list = config.companies.filter(inScope), seen = new Set(), out = [];
    for (const c of list) { if (seen.has(c.key)) continue; for (const d of list.filter((x) => hostOf(x) === hostOf(c))) { seen.add(d.key); out.push([d.key, `https://${hostOf(d)}/robots.txt`]); } }
    return out;
  }

  async function read(key) {
    const t0 = Date.now(), { config, L, G, match, signals, prev } = await load(), c = config.companies.find((x) => x.key === key);
    if (!c || c.adapter !== "workday") throw new Error(`${key}: not a Workday source in config.json`);
    if (location.hostname !== hostOf(c)) throw new Error(`${key}: this tab is on ${location.hostname}; open https://${hostOf(c)}/robots.txt first`);
    const sites = c.sites || [c.site], all = c.queries || [""], near = all.filter((q) => !ELSEWHERE.test(q)), queries = near.length ? near : all;
    const where = (j) => [j.location || "", ...(j.locations || [])].join(" · "), tail = (j) => j.id.slice(key.length + 1);
    const rows = new Map(); let listed = 0, short = false;
    for (const site of sites) for (const q of queries) {
      const api = `/wday/cxs/${c.tenant}/${site}/jobs`, body = (o) => ({ appliedFacets: c.facets || {}, limit: 20, offset: o, searchText: q });
      const add = (res) => { const list = (res && res.jobPostings) || []; for (const j of list) { const row = G.workdayRow(c, site, j); if (!rows.has(row.id)) rows.set(row.id, row); } return list.length; };
      const first = await call(api, body(0)), total = (first && first.total) || 0; let got = add(first);
      const pages = []; for (let p = 1; p < Math.min(c.maxPages || 10, Math.ceil(total / 20)); p++) pages.push(p);
      await pool(pages, 4, async (p) => { const n = add(await call(api, body(p * 20))); got += n; }); // (not `got += add(await …)`: the old value would be read before the wait)
      listed += got; if (got < Math.min(total, (c.maxPages || 10) * 20)) short = true;
    }
    // "3 Locations" rows that an earlier reading already found to be somewhere else are not opened again
    const mine = (state().firms[key] || {}), last = (prev && prev.firms[key]) || {}, away = new Set([...(last.elsewhere || []), ...(mine.elsewhere || [])]);
    let jobs = [...rows.values()].filter((j) => (j.locationsUnknown ? !away.has(tail(j)) : REGION.test(where(j))));
    for (const j of jobs) { j.req = L.parseRequirements(j.title + "\n" + (j.snippet || "")); j.match = match(j); }
    // the same rule as the scanner: read a description when the cities are not in the listing, or the posting looks promising
    const dc = { minScore: 52, ...(config.details || {}) }, now = new Date().toISOString(), old = { ...(last.details || {}), ...(mine.details || {}) }, details = {}, need = []; // descriptions already read: last published relay, and earlier in this tab
    for (const j of jobs) { if (!(j.locationsUnknown || (j.match.tier !== "dropped" && j.match.score >= dc.minScore))) continue; const d = old[tail(j)]; if (d && d.ok && d.v === 2) details[tail(j)] = d; else need.push(j); }
    let fresh = 0, failed = 0;
    await pool(need.slice(0, 160), 4, async (j) => {
      try {
        const res = await call(`/wday/cxs/${c.tenant}/${j.wdSite}${j.wdPath}`), d = res ? G.workdayDetail(res) : null, sig = d && d.description ? signals(d.description) : null;
        details[tail(j)] = { req: d && d.description ? L.parseRequirements(d.description) : null, sig: sig ? { dims: sig.dims, hits: sig.hits, entry: sig.entry || undefined } : { dims: {}, hits: [] }, locations: d && d.locations && d.locations.length ? d.locations : undefined, postedAt: (d && d.postedAt) || undefined, at: now, ok: !!d, v: 2 };
        fresh++;
      } catch (e) { failed++; }
    });
    for (const j of jobs) if (j.locationsUnknown) { const d = details[tail(j)]; if (d && d.locations) { j.locations = [...new Set(d.locations)]; j.location = j.locations.join(" · "); delete j.locationsUnknown; } }
    const unresolved = jobs.filter((j) => j.locationsUnknown).length, listedIds = new Set([...rows.values()].map(tail));
    const elsewhere = [...new Set([...away, ...jobs.filter((j) => !j.locationsUnknown && !REGION.test(where(j))).map(tail)])].filter((id) => listedIds.has(id));
    jobs = jobs.filter((j) => !j.locationsUnknown && REGION.test(where(j)));
    const keep = new Set(jobs.map(tail)); for (const id of Object.keys(details)) if (!keep.has(id)) delete details[id];
    const before = ((prev && prev.firms[key] && prev.firms[key].postings) || []).length, suspicious = jobs.length === 0 && before >= 5;
    const rec = { readAt: now, complete: !short && !suspicious, listed, inRegion: jobs.length, unresolved: unresolved || undefined, elsewhere: elsewhere.length ? elsewhere : undefined,
      postings: jobs.map((j) => ({ id: tail(j), title: j.title, path: j.wdPath, site: j.wdSite, locations: j.locations, postedAt: j.postedAt || undefined, snippet: j.snippet || undefined })), details };
    const line = `${key}: ${listed} listed, ${jobs.length} in Toronto / Hong Kong (was ${before}), ${Object.keys(details).length} descriptions (${fresh} read now${failed ? `, ${failed} failed` : ""}${need.length > 160 ? `, ${need.length - 160} left for next time` : ""}${elsewhere.length ? `, ${elsewhere.length} multi-city rows are elsewhere` : ""})${rec.complete ? "" : short ? " — listing cut short, NOT complete" : " — empty where there used to be postings, NOT trusted"}, ${((Date.now() - t0) / 1000).toFixed(1)} s`;
    const s = state(); s.firms[key] = rec; s.log.push(line); save(s);
    return line;
  }

  const status = () => { const s = state(); return `${Object.keys(s.firms).length} firms read since ${s.startedAt}: ${Object.keys(s.firms).join(", ") || "none"}`; };

  /** Builds data/relay.json (firms not read this time keep their last reading), keeps it in window.name and goes to GitHub's upload page. */
  async function finish({ go = true } = {}) {
    const { config, prev } = await load(), s = state(), firms = { ...((prev && prev.firms) || {}) };
    if (!Object.keys(s.firms).length) throw new Error("nothing was read in this tab");
    Object.assign(firms, s.firms);
    for (const k of Object.keys(firms)) if (!config.companies.some((c) => c.key === k && inScope(c))) delete firms[k];
    const keys = Object.keys(firms).sort(), readAt = Object.values(s.firms).map((f) => f.readAt).sort().pop();
    const file = "{\n" + [`"version": 2`, `"readAt": ${JSON.stringify(readAt)}`, `"by": "browser"`, `"about": ${JSON.stringify(ABOUT)}`, `"firms": {\n` + keys.map((k) => JSON.stringify(k) + ": " + JSON.stringify(firms[k])).join(",\n") + "\n}"].join(",\n") + "\n}\n";
    JSON.parse(file);
    const n = (f) => Object.values(f).reduce((q, x) => q + x.postings.length, 0);
    const summary = `relay.json ready: ${keys.length} firms (${Object.keys(s.firms).length} read now, ${Object.values(s.firms).filter((f) => !f.complete).length} of them not complete), ${n(firms)} postings, ${(file.length / 1024).toFixed(0)} KB`;
    window.name = JSON.stringify({ dc: "file", file, summary });
    if (go) {
      // window.name normally survives the trip to github.com; the address carries a compressed copy in case it does not
      let hash = "";
      try { const buf = new Uint8Array(await new Response(new Blob([file]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()); let b = ""; for (let i = 0; i < buf.length; i += 0x8000) b += String.fromCharCode(...buf.subarray(i, i + 0x8000)); hash = "#dc=" + btoa(b); } catch {}
      setTimeout(() => { location.href = UPLOAD + (hash.length < 1500000 ? hash : ""); }, 150);
    }
    return summary;
  }

  globalThis.DC = { plan, read, status, finish, state };
})();
