// Goldman Sachs — higher.gs.com (GraphQL gateway used by the public role search)
import { postJson, job, guessType, sleep } from "../lib.mjs";

const ENDPOINT = "https://api-higher.gs.com/gateway/api/v1/graphql";
const FIELDS = `totalCount items { roleId corporateTitle jobTitle jobFunction locations { primary state country city } status division jobType { code description } externalSource { sourceId } startDate }`;
const QUERY = `query GetRoles($searchQueryInput: RoleSearchQueryInput!) { roleSearch(searchQueryInput: $searchQueryInput) { ${FIELDS} } }`;

async function page(experiences, pageNumber, pageSize, searchTerm = "") {
  const body = {
    operationName: "GetRoles",
    query: QUERY,
    variables: { searchQueryInput: { page: { pageSize, pageNumber }, filters: [], experiences, searchTerm } },
  };
  const res = await postJson(ENDPOINT, body, { headers: { origin: "https://higher.gs.com", referer: "https://higher.gs.com/results" } });
  if (res.errors) throw new Error("GS GraphQL: " + JSON.stringify(res.errors).slice(0, 200));
  return res.data.roleSearch;
}

function toJob(r, experience) {
  const id = r.externalSource?.sourceId || r.roleId;
  const locs = (r.locations || []).map((l) => [l.city, l.state, l.country].filter(Boolean).join(", "));
  const hint = experience === "CAMPUS" ? "campus" : "";
  return job({
    companyKey: "goldman",
    company: "Goldman Sachs",
    id,
    title: r.jobTitle,
    url: `https://higher.gs.com/roles/${id}`,
    locations: locs,
    postedAt: r.startDate || null,
    type: experience === "CAMPUS" ? guessType(r.jobTitle, "campus " + (r.corporateTitle || "")) : guessType(r.jobTitle),
    snippet: [r.division, r.corporateTitle, r.jobFunction].filter(Boolean).join(" · "),
    extra: { level: r.corporateTitle || null, division: r.division || null, hint },
  });
}

export async function fetchJobs(cfg = {}) {
  const out = [];
  const sets = [
    { experiences: ["CAMPUS"], label: "CAMPUS" },
    { experiences: ["EARLY_CAREER", "PROFESSIONAL"], label: "PROFESSIONAL" },
  ];
  const pageSize = cfg.pageSize || 50;
  const maxPages = cfg.maxPages || 40;
  for (const s of sets) {
    let n = 0;
    for (let p = 0; p < maxPages; p++) {
      const r = await page(s.experiences, p, pageSize);
      const items = r.items || [];
      for (const it of items) out.push(toJob(it, s.label));
      n += items.length;
      if (!items.length || n >= (r.totalCount || 0)) break;
      await sleep(250);
    }
  }
  return out;
}

export const key = "goldman";
export const name = "Goldman Sachs";
