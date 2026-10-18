// Adapters added in the Oct-2026 "Toronto / big-name" expansion. Every adapter exports
//   fetchJobs(cfg)            -> normalized postings (lib.job)
//   fetchDetail(cfg, j)?      -> { description, locations? }  (optional; index.mjs calls it lazily, cached)
// The ATS behind each site was verified in a browser on 2026-10-18; endpoints are the same ones the
// public careers pages call, no login, no bot bypass.
import { getJson, getText, postJson, job, guessType, sleep, stripTags, matchAll, toDate, htmlToText, decodeEntities, UA } from "../lib.mjs";

// ───────────────────────── Phenom People (BCG, …) ─────────────────────────
// cfg: { base: "https://careers.bcg.com", lang: "en_global", country: "global", pageId: "page35-ds",
//        cities: ["Toronto"], keywords: ["", "analyst"] }
export async function phenom(cfg) {
  const base = cfg.base.replace(/\/$/, "");
  const widgets = async (body) => postJson(`${base}/widgets`, body, { headers: { accept: "application/json", referer: `${base}/${cfg.path || "global/en"}/search-results` } });
  const common = { lang: cfg.lang || "en_global", deviceType: "desktop", country: cfg.country || "global", pageName: "search-results", ddoKey: "refineSearch", sortBy: "", subsearch: "", jobs: true, counts: true, all_fields: ["category", "country", "state", "city", "type"], clearAll: false, jdsource: "facets", isSliderEnable: false, siteType: "external", global: true, locationData: {}, pageId: cfg.pageId || "page35-ds" };
  const size = 100;
  const seen = new Map();
  const searches = [];
  for (const city of cfg.cities || [""]) for (const kw of cfg.keywords || [""]) searches.push({ city, kw });
  for (const s of searches) {
    for (let from = 0; from < size * (cfg.maxPages || 5); from += size) {
      const res = await widgets({ ...common, from, size, keywords: s.kw, selected_fields: s.city ? { city: [s.city] } : {} });
      const rs = res.refineSearch || {};
      const list = (rs.data || {}).jobs || [];
      for (const j of list) {
        if (seen.has(j.jobSeqNo)) continue;
        const locs = (j.multi_location_array || []).map((l) => l.location).filter(Boolean);
        seen.set(
          j.jobSeqNo,
          job({
            companyKey: cfg.key,
            company: cfg.name,
            id: j.jobSeqNo,
            title: j.title,
            url: `${base}/${cfg.path || "global/en"}/job/${j.jobSeqNo}/${encodeURIComponent(String(j.title || "").replace(/[^\w]+/g, "-"))}`,
            locations: locs.length ? locs : [j.cityStateCountry || [j.city, j.state, j.country].filter(Boolean).join(", ")],
            postedAt: j.postedDate || null,
            type: guessType(j.title, j.category || ""),
            snippet: (j.descriptionTeaser || "").slice(0, 200),
            extra: { division: j.category || null, applyUrl: j.applyUrl || null },
          })
        );
      }
      const total = rs.totalHits || 0;
      if (!list.length || from + size >= total) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}
phenom.fetchDetail = async function (cfg, j) {
  const html = await getText(j.url);
  // the page carries phApp.ddo.jobDetail.data.job.description as a JS string (HTML-escaped)
  const m = html.match(/"description"\s*:\s*"((?:[^"\\]|\\.){300,})"/);
  if (!m) return null;
  let raw = m[1].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, '"').replace(/\\\//g, "/").replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  raw = decodeEntities(raw);
  return { description: htmlToText(raw) };
};

// ───────────────────────── SAP SuccessFactors career sites ─────────────────────────
// Classic HTML search (Scotiabank, EY):  cfg { base: "https://jobs.scotiabank.com", path: "" | "/ey", cities: ["Toronto"], keywords: ["analyst", "associate", "graduate", …] }
// New React sites (Deloitte Canada):     cfg { base: "https://careers.deloitte.ca", api: true, locale: "en_US", cities: [...], keywords: [...] }
export async function successfactors(cfg) {
  const base = cfg.base.replace(/\/$/, "");
  const path = cfg.path || "";
  const seen = new Map();
  if (cfg.api) {
    for (const city of cfg.cities || [""]) for (const kw of cfg.keywords || [""]) {
      for (let page = 0; page < (cfg.maxPages || 40); page++) {
        const res = await postJson(`${base}/services/recruiting/v1/jobs`, { locale: cfg.locale || "en_US", keywords: kw, location: city, page, pageSize: 10 }, { headers: { accept: "application/json", referer: `${base}/search/` } });
        const list = res.jobSearchResult || [];
        for (const row of list) {
          const r = row.response || row;
          if (!r.id || seen.has(r.id)) continue;
          const cities = (r.mfield1 || []).length ? r.mfield1 : (r.jobLocationShort || []).map((s) => stripTags(s));
          seen.set(
            r.id,
            job({ companyKey: cfg.key, company: cfg.name, id: r.id, title: r.unifiedStandardTitle || r.title, url: `${base}/job/${r.urlTitle || r.unifiedUrlTitle}/${r.id}-${cfg.locale || "en_US"}`, locations: cities, postedAt: usDate(r.unifiedStandardStart), type: guessType(r.unifiedStandardTitle || r.title, (r.employeeType || []).join(" ")), snippet: (r.employeeType || []).concat(r.workModel || []).join(" · ") })
          );
        }
        if (list.length < 10 || (page + 1) * 10 >= (res.totalJobs || 0)) break;
        await sleep(300);
      }
    }
    return [...seen.values()];
  }
  for (const city of cfg.cities || [""]) for (const kw of cfg.keywords || [""]) {
    for (let start = 0; start < 25 * (cfg.maxPages || 12); start += 25) {
      const u = `${base}${path}/search/?q=${encodeURIComponent(kw)}&locationsearch=${encodeURIComponent(city)}&startrow=${start}`;
      const html = await getText(u);
      let n = 0;
      for (const m of matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/g, html)) {
        const row = m[1];
        const a = row.match(/<a href="([^"]+)"\s+class="jobTitle-link">([\s\S]*?)<\/a>/) || row.match(/<a class="jobTitle-link" href="([^"]+)">([\s\S]*?)<\/a>/);
        if (!a) continue;
        const id = (a[1].match(/\/(\d+)\/?$/) || [])[1] || a[1];
        if (seen.has(id)) { n++; continue; }
        const loc = stripTags((row.match(/class="jobLocation[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "");
        const date = stripTags((row.match(/class="jobDate[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "");
        const dept = stripTags((row.match(/class="jobDepartment[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "");
        seen.set(id, job({ companyKey: cfg.key, company: cfg.name, id, title: stripTags(a[2]), url: a[1].startsWith("http") ? a[1] : base + a[1], locations: [loc.replace(/,\s*[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, "")], postedAt: toDate(date), type: guessType(stripTags(a[2]), dept), snippet: dept, extra: { division: dept || null } }));
        n++;
      }
      const total = Number((html.match(/of\s+(\d+)\s*<\/span>/) || html.match(/of\s+(\d+)/) || [])[1] || 0);
      if (!n || start + 25 >= total) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}
successfactors.fetchDetail = async function (cfg, j) {
  const html = await getText(j.url);
  const m = html.match(/<span[^>]*class="jobdescription"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/) || html.match(/itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/) || html.match(/class="job"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  return m ? { description: htmlToText(m[1]) } : null;
};
function usDate(s) {
  // "9/16/26" → 2026-09-16
  const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return toDate(s);
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

// ───────────────────────── Jibe / iCIMS career sites (KPMG Canada) ─────────────────────────
// cfg: { base: "https://careers.kpmg.ca", cities: ["Toronto"] } — list rows already carry the full description.
export async function jibe(cfg) {
  const base = cfg.base.replace(/\/$/, "");
  const seen = new Map();
  for (const city of cfg.cities || [""]) {
    for (let page = 1; page <= (cfg.maxPages || 40); page++) {
      const res = await getJson(`${base}/api/jobs?location=${encodeURIComponent(city)}&page=${page}&sortBy=relevance&descending=false&internal=false`, { headers: { accept: "application/json", referer: `${base}/jobs` } });
      const list = res.jobs || [];
      for (const row of list) {
        const d = row.data || row;
        if (!d.req_id || seen.has(d.req_id)) continue;
        const text = [d.description, d.responsibilities, d.qualifications].filter(Boolean).map((h) => htmlToText(h)).join("\n");
        seen.set(d.req_id, job({ companyKey: cfg.key, company: cfg.name, id: d.req_id, title: d.title, url: `${base}/jobs/${d.slug}?lang=${d.language || "en-us"}`, locations: [d.full_location || d.location_name || [d.city, d.state].filter(Boolean).join(", ")], postedAt: d.posted_date || null, type: guessType(d.title, (d.categories || []).map((c) => c.name).join(" ")), snippet: (d.categories || []).map((c) => c.name).join(" · "), extra: { division: (d.categories || [])[0]?.name || null, description: text } }));
      }
      if (!list.length || page * 10 >= (res.totalCount || 0)) break;
      await sleep(250);
    }
  }
  return [...seen.values()];
}

// ───────────────────────── Radancy (Disney, same engine as Barclays) ─────────────────────────
// cfg: { base: "https://www.disneycareers.com", path: "/en", keywords: [""], regions: [regex strings matched against the location] }
export async function radancy(cfg) {
  const base = cfg.base.replace(/\/$/, "");
  const path = cfg.path || "";
  const seen = new Map();
  const regionRe = cfg.regions ? new RegExp(cfg.regions.join("|"), "i") : null;
  for (const kw of cfg.keywords || [""]) {
    for (let page = 1; page <= (cfg.maxPages || 12); page++) {
      const q = new URLSearchParams({ ActiveFacetID: "0", CurrentPage: String(page), RecordsPerPage: "100", Distance: "50", RadiusUnitType: "0", Keywords: kw, Location: "", ShowRadius: "False", IsPagination: page > 1 ? "True" : "False", CustomFacetName: "", FacetTerm: "", FacetType: "0", SearchResultsModuleName: "Search Results", SearchFiltersModuleName: "Search Filters", SortCriteria: "0", SortDirection: "0", SearchType: "5", PostalCode: "", ResultsType: "0", fc: "", fl: "", fcf: "", afc: "", afl: "", afcf: "" });
      const res = await getJson(`${base}${path}/search-jobs/results?${q}`, { headers: { "x-requested-with": "XMLHttpRequest", referer: `${base}${path}/search-jobs` } });
      const html = res.results || "";
      let n = 0;
      for (const m of matchAll(/<a[^>]*href="([^"]*\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g, html)) {
        const href = m[1];
        const inner = m[2];
        const title = stripTags((inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || "");
        if (!title) continue;
        const loc = stripTags((inner.match(/class="[^"]*job-location[^"]*"[^>]*>([\s\S]*?)<\//) || [])[1] || "");
        const id = (href.match(/\/(\d+)\/?$/) || [])[1] || href;
        n++;
        if (seen.has(id)) continue;
        if (regionRe && !regionRe.test(loc)) continue;
        const locs = loc.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
        seen.set(id, job({ companyKey: cfg.key, company: cfg.name, id, title, url: href.startsWith("http") ? href : base + href, locations: locs, postedAt: null, type: guessType(title), snippet: "" }));
      }
      if (!n) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}
radancy.fetchDetail = async function (cfg, j) {
  const html = await getText(j.url);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ld) { try { const o = JSON.parse(ld[1]); if (o.description) return { description: htmlToText(o.description), postedAt: toDate(o.datePosted) }; } catch {} }
  const m = html.match(/class="ats-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/) || html.match(/<div class="job-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  return m ? { description: htmlToText(m[1]) } : null;
};

// ───────────────────────── Eightfold (Microsoft; Morgan Stanley has its own adapter) ─────────────────────────
// cfg: { host: "https://apply.careers.microsoft.com", domain: "microsoft.com", searches: [{query, location}], urlBase }
export async function eightfold(cfg) {
  const host = cfg.host.replace(/\/$/, "");
  const seen = new Map();
  const warnings = [];
  // pages are 10 rows (num is capped server-side); newest first, so the page cap keeps the freshest postings.
  // The API rate-limits bursts (HTTP 429) → ~1 s between pages, and back off + retry when it happens.
  for (const s of cfg.searches || [{ query: "", location: "" }]) {
    for (let p = 0; p < (cfg.maxPages || 15); p++) {
      const u = `${host}/api/pcsx/search?domain=${cfg.domain}&query=${encodeURIComponent(s.query || "")}&location=${encodeURIComponent(s.location || "")}&start=${p * 10}&num=10&sort_by=timestamp`;
      let res = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await getJson(u, { headers: { accept: "application/json", referer: `${host}/careers` } });
          break;
        } catch (e) {
          if (!/HTTP 429/.test(String(e.message || e))) throw e;
          if (attempt === 2) warnings.push(`rate-limited at ${s.location || s.query} page ${p + 1} — kept what was fetched`);
          else await sleep(6000 * (attempt + 1));
        }
      }
      if (!res) break;
      const list = res?.data?.positions || [];
      for (const pos of list) {
        if (seen.has(pos.id)) continue;
        seen.set(pos.id, job({ companyKey: cfg.key, company: cfg.name, id: pos.id, title: pos.name, url: `${host}${pos.positionUrl || "/careers/job/" + pos.id}`, locations: pos.locations || [], postedAt: pos.postedTs || pos.creationTs || null, type: guessType(pos.name, pos.department || ""), snippet: [pos.department, pos.displayJobId].filter(Boolean).join(" · "), extra: { division: pos.department || null } }));
      }
      const count = res?.data?.count || 0;
      if (!list.length || (p + 1) * 10 >= count) break;
      await sleep(1000);
    }
  }
  const out = [...seen.values()];
  if (warnings.length) out.warnings = warnings;
  return out;
}
eightfold.fetchDetail = async function (cfg, j) {
  const host = cfg.host.replace(/\/$/, "");
  const id = j.id.split(":").slice(1).join(":");
  const res = await getJson(`${host}/api/pcsx/position_details?position_id=${id}&domain=${cfg.domain}&hl=en`, { headers: { accept: "application/json", referer: `${host}/careers` } });
  const d = res?.data || {};
  return d.jobDescription ? { description: htmlToText(d.jobDescription), locations: d.locations } : null;
};

// ───────────────────────── Amazon (amazon.jobs/search.json) ─────────────────────────
// cfg: { cities: ["Toronto", "New York", "Hong Kong", "Shenzhen"], keywords: ["", "analyst", …] } — rows carry description + basic_qualifications
export async function amazon(cfg) {
  const seen = new Map();
  for (const city of cfg.cities || [""]) for (const kw of cfg.keywords || [""]) {
    for (let offset = 0; offset < 100 * (cfg.maxPages || 5); offset += 100) {
      const u = `https://www.amazon.jobs/en/search.json?normalized_city_name[]=${encodeURIComponent(city)}&base_query=${encodeURIComponent(kw)}&result_limit=100&offset=${offset}&sort=recent`;
      const res = await getJson(u, { headers: { accept: "application/json", referer: "https://www.amazon.jobs/en/search" } });
      const list = res.jobs || [];
      for (const d of list) {
        if (seen.has(d.id_icims)) continue;
        const text = [d.description_short, d.basic_qualifications, d.preferred_qualifications].filter(Boolean).map((h) => htmlToText(h)).join("\n");
        seen.set(d.id_icims, job({ companyKey: cfg.key, company: cfg.name, id: d.id_icims, title: d.title, url: `https://www.amazon.jobs${d.job_path}`, locations: [d.normalized_location || d.location], postedAt: d.posted_date || null, type: d.is_intern ? "internship" : d.university_job ? guessType(d.title, "graduate") : guessType(d.title), snippet: [d.job_category, d.team && d.team.label].filter(Boolean).join(" · "), extra: { division: d.job_category || null, description: text } }));
      }
      if (!list.length || offset + 100 >= (res.hits || 0)) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}

// ───────────────────────── Avature (Bain) ─────────────────────────
// cfg: { base: "https://careers.bain.com", cities: ["Toronto", "New York", "Hong Kong", "Shenzhen"] } — lists everything (10 per page), keeps the wanted cities
export async function avature(cfg) {
  const base = cfg.base.replace(/\/$/, "");
  const seen = new Map();
  const want = (cfg.cities || []).map((c) => c.toLowerCase());
  const ids = new Set();
  let fetched = 0;
  // the portal pages with folderOffset (10 rows a page; jobOffset / folderRecordsPerPage are ignored)
  for (let off = 0; off < 10 * (cfg.maxPages || 40); off += 10) {
    const html = await getText(`${base}/jobs/SearchJobs/?folderRecordsPerPage=10&folderOffset=${off}`);
    let n = 0, fresh = 0;
    for (const m of matchAll(/<article class="article article--result">([\s\S]*?)<\/article>/g, html)) {
      const block = m[1];
      const a = block.match(/<a href="([^"]*\/FolderDetail\/[^"]*\/(\d+))"[^>]*>([\s\S]*?)<\/a>/);
      if (!a) continue;
      n++;
      if (!ids.has(a[2])) { ids.add(a[2]); fresh++; fetched++; }
      const title = stripTags(a[3]);
      const loc = stripTags((block.match(/article__header__text__subtitle"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "");
      const locs = loc.split(/\s*,\s*/).filter(Boolean);
      if (want.length && !locs.some((l) => want.some((w) => l.toLowerCase().includes(w)))) continue;
      if (!seen.has(a[2])) seen.set(a[2], job({ companyKey: cfg.key, company: cfg.name, id: a[2], title, url: a[1], locations: locs, postedAt: null, type: guessType(title), snippet: "" }));
    }
    if (!n || !fresh) break; // empty page, or the site ignored the offset and repeated itself
    await sleep(300);
  }
  const out = [...seen.values()];
  out.warnings = [`${fetched} postings on the portal, ${out.length} in ${(cfg.cities || []).join("/") || "all cities"}`];
  return out;
}
avature.fetchDetail = async function (cfg, j) {
  const html = await getText(j.url);
  const m = html.match(/<div class="article__content">([\s\S]*?)<\/div>\s*<\/article>/) || html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return m ? { description: htmlToText(m[1]).slice(0, 12000) } : null;
};

// ───────────────────────── Greenhouse with descriptions (content=true) ─────────────────────────
// cfg: { board: "warburgpincusllc", cities: [...] } — same as generic.greenhouse but keeps the description for the requirement parser
export async function greenhouseFull(cfg) {
  const res = await getJson(`https://boards-api.greenhouse.io/v1/boards/${cfg.board}/jobs?content=true`);
  const out = [];
  for (const j of res.jobs || []) {
    const locs = [j.location?.name, ...(j.offices || []).map((o) => o.name)].filter(Boolean);
    out.push(job({ companyKey: cfg.key, company: cfg.name, id: j.id, title: j.title, url: j.absolute_url, locations: locs, postedAt: j.first_published || j.updated_at || null, type: guessType(j.title), snippet: (j.departments || []).map((d) => d.name).join(" · "), extra: { division: (j.departments || [])[0]?.name || null, description: htmlToText(decodeEntities(j.content || "")).slice(0, 12000) } }));
  }
  return out;
}

// ───────────────────────── Lever / Ashby with descriptions ─────────────────────────
export async function leverFull(cfg) {
  const res = await getJson(`https://api.lever.co/v0/postings/${cfg.site}?mode=json`);
  return (res || []).map((j) => job({ companyKey: cfg.key, company: cfg.name, id: j.id, title: j.text, url: j.hostedUrl, locations: [j.categories?.location, ...(j.categories?.allLocations || [])].filter(Boolean), postedAt: j.createdAt || null, type: guessType(j.text, j.categories?.commitment || ""), snippet: [j.categories?.team, j.categories?.commitment].filter(Boolean).join(" · "), extra: { division: j.categories?.team || null, description: [j.descriptionPlain, ...(j.lists || []).map((l) => l.text + "\n" + htmlToText(l.content || ""))].filter(Boolean).join("\n").slice(0, 12000) } }));
}
export async function ashbyFull(cfg) {
  const res = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${cfg.board}?includeCompensation=false`);
  return (res.jobs || []).map((j) => job({ companyKey: cfg.key, company: cfg.name, id: j.id, title: j.title, url: j.jobUrl || j.applyUrl, locations: [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean), postedAt: j.publishedAt || null, type: guessType(j.title, j.employmentType || ""), snippet: [j.department, j.team, j.employmentType].filter(Boolean).join(" · "), extra: { division: j.department || null, description: htmlToText(j.descriptionHtml || j.descriptionPlain || "").slice(0, 12000) } }));
}
