// Barclays — search.jobs.barclays (Radancy job search; JSON wrapper around HTML cards)
import { getJson, job, guessType, sleep, stripTags, matchAll, parseShortDate } from "../lib.mjs";

const BASE = "https://search.jobs.barclays";

function url(keywords, page, perPage) {
  const q = new URLSearchParams({
    ActiveFacetID: "0", CurrentPage: String(page), RecordsPerPage: String(perPage), Distance: "50", RadiusUnitType: "0",
    Keywords: keywords, Location: "", ShowRadius: "False", IsPagination: "False", CustomFacetName: "", FacetTerm: "", FacetType: "0",
    SearchResultsModuleName: "Search Results", SearchFiltersModuleName: "Search Filters", SortCriteria: "5", SortDirection: "1",
    SearchType: "5", PostalCode: "", ResultsType: "0", fc: "", fl: "", fcf: "", afc: "", afl: "", afcf: "",
  });
  return `${BASE}/search-jobs/results?${q.toString()}`;
}

export function parseCards(html) {
  const out = [];
  const re = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*job-title--link[^"]*"[^>]*data-job-id="(\d+)"[^>]*>([\s\S]*?)<\/a>\s*<div class="job-location">([\s\S]*?)<\/div>([\s\S]*?)(?=<a[^>]*job-title--link|$)/g;
  for (const m of matchAll(re, html)) {
    const [, href, jobId, titleHtml, locHtml, rest] = m;
    const date = (rest.match(/job-date"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/) || [])[1] || "";
    out.push({ href, jobId, title: stripTags(titleHtml), location: stripTags(locHtml), date: date.trim() });
  }
  return out;
}

export async function fetchJobs(cfg = {}) {
  const keywords = cfg.keywords || ["graduate", "2027", "analyst", "internship"];
  const perPage = 50;
  const maxPages = cfg.maxPages || 6;
  const seen = new Map();
  for (const kw of keywords) {
    for (let p = 1; p <= maxPages; p++) {
      const res = await getJson(url(kw, p, perPage), { headers: { "x-requested-with": "XMLHttpRequest", referer: `${BASE}/search-jobs/${encodeURIComponent(kw)}` } });
      const cards = parseCards(res.results || "");
      for (const c of cards) {
        if (seen.has(c.jobId)) continue;
        seen.set(
          c.jobId,
          job({
            companyKey: "barclays",
            company: "Barclays",
            id: c.jobId,
            title: c.title,
            url: c.href.startsWith("http") ? c.href : `${BASE}${c.href}`,
            locations: [c.location],
            postedAt: parseShortDate(c.date),
            type: guessType(c.title),
            snippet: "",
          })
        );
      }
      const totalPages = Number((res.results || "").match(/data-total-pages="(\d+)"/)?.[1] || 1);
      if (!cards.length || p >= totalPages) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}

export const key = "barclays";
export const name = "Barclays";
