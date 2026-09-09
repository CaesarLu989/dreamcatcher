// J.P. Morgan — Oracle Cloud HCM candidate experience (public REST used by the careers site)
import { getJson, job, guessType, sleep } from "../lib.mjs";

const BASE = "https://jpmc.fa.oraclecloud.com";
const SITE = "CX_1001";

function url(keyword, offset, limit) {
  const finder = [`siteNumber=${SITE}`, `limit=${limit}`, `offset=${offset}`, `sortBy=POSTING_DATES_DESC`];
  if (keyword) finder.push(`keyword=${encodeURIComponent(`"${keyword}"`)}`);
  return `${BASE}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;${finder.join(",")}`;
}

function toJob(r) {
  const locs = [r.PrimaryLocation, ...(r.secondaryLocations || []).map((s) => s.Name)].filter(Boolean);
  return job({
    companyKey: "jpmorgan",
    company: "J.P. Morgan",
    id: r.Id,
    title: r.Title,
    url: `${BASE}/hcmUI/CandidateExperience/en/sites/${SITE}/job/${r.Id}`,
    locations: locs,
    postedAt: r.PostedDate,
    closesAt: r.PostingEndDate,
    type: guessType(r.Title, r.JobFamily || ""),
    snippet: r.ShortDescriptionStr || "",
    extra: { level: r.JobFamily || null, division: r.Organization || r.BusinessUnit || null },
  });
}

export async function fetchJobs(cfg = {}) {
  const keywords = cfg.keywords || ["2027", "2026 Analyst", "Analyst Program", "Graduate Programme", "Hong Kong", "Toronto"];
  const limit = 25;
  const maxPages = cfg.maxPages || 12;
  const seen = new Map();
  for (const kw of keywords) {
    for (let p = 0; p < maxPages; p++) {
      const res = await getJson(url(kw, p * limit, limit), { headers: { "ora-irc-language": "en", referer: `${BASE}/hcmUI/CandidateExperience/en/sites/${SITE}/jobs` } });
      const item = res.items?.[0];
      const list = item?.requisitionList || [];
      for (const r of list) if (!seen.has(r.Id)) seen.set(r.Id, toJob(r));
      const total = item?.TotalJobsCount || 0;
      if (!list.length || (p + 1) * limit >= total) break;
      await sleep(200);
    }
  }
  return [...seen.values()];
}

export const key = "jpmorgan";
export const name = "J.P. Morgan";
