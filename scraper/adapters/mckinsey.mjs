// McKinsey & Company — job search gateway used by mckinsey.com/careers/search-jobs
import { getJson, job, guessType, sleep } from "../lib.mjs";

const API = "https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search";

function toJob(d) {
  const cities = d.cities || [];
  const countries = d.countries || [];
  // cities and countries are independent facet lists (a global BA posting lists ~100 cities) — keep cities only
  const locs = cities.length ? cities : countries;
  return job({
    companyKey: "mckinsey",
    company: "McKinsey & Company",
    id: d.jobID,
    title: d.title,
    url: `https://www.mckinsey.com/careers/search-jobs/jobs/${d.friendlyURL}`,
    locations: locs,
    postedAt: d.postedToLinkedInDate || null,
    type: guessType(d.title, (d.interest || "") + " " + (d.linkedInSeniorityLevel || []).join(" ")),
    snippet: d.shortJobSummary || "",
    extra: { division: d.interest || null, level: (d.linkedInSeniorityLevel || [])[0] || null, functions: d.functions || [] },
  });
}

export async function fetchJobs(cfg = {}) {
  const pageSize = cfg.pageSize || 100;
  const maxPages = cfg.maxPages || 15;
  const seen = new Map();
  for (let p = 0; p < maxPages; p++) {
    // NB: "start" is a 1-based PAGE index on this API, not an offset
    const u = `${API}?pageSize=${pageSize}&start=${p + 1}&lang=en`;
    const res = await getJson(u, { headers: { referer: "https://www.mckinsey.com/careers/search-jobs", origin: "https://www.mckinsey.com" } });
    const docs = res.docs || [];
    for (const d of docs) if (!seen.has(d.jobID)) seen.set(d.jobID, toJob(d));
    const total = res.numFound || 0;
    if (!docs.length || (p + 1) * pageSize >= total) break;
    await sleep(250);
  }
  return [...seen.values()];
}

export const key = "mckinsey";
export const name = "McKinsey & Company";
