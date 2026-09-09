// Generic adapters for the ATS platforms most tech / AI companies use.
// Add a company in config.json with "adapter": "greenhouse" | "lever" | "ashby" | "workday".
import { getJson, postJson, job, guessType, sleep } from "../lib.mjs";

// ---- Greenhouse: {"adapter":"greenhouse","board":"openai"} -> https://boards.greenhouse.io/openai
export async function greenhouse(cfg) {
  const res = await getJson(`https://boards-api.greenhouse.io/v1/boards/${cfg.board}/jobs?content=false`);
  return (res.jobs || []).map((j) =>
    job({
      companyKey: cfg.key,
      company: cfg.name,
      id: j.id,
      title: j.title,
      url: j.absolute_url,
      locations: [j.location?.name].filter(Boolean),
      postedAt: j.first_published || j.updated_at || null,
      type: guessType(j.title),
      snippet: (j.departments || []).map((d) => d.name).join(" · "),
      extra: { division: (j.departments || [])[0]?.name || null },
    })
  );
}

// ---- Lever: {"adapter":"lever","site":"palantir"} -> https://jobs.lever.co/palantir
export async function lever(cfg) {
  const res = await getJson(`https://api.lever.co/v0/postings/${cfg.site}?mode=json`);
  return (res || []).map((j) =>
    job({
      companyKey: cfg.key,
      company: cfg.name,
      id: j.id,
      title: j.text,
      url: j.hostedUrl,
      locations: [j.categories?.location, ...(j.categories?.allLocations || [])].filter(Boolean),
      postedAt: j.createdAt || null,
      type: guessType(j.text, j.categories?.commitment || ""),
      snippet: [j.categories?.team, j.categories?.commitment].filter(Boolean).join(" · "),
      extra: { division: j.categories?.team || null },
    })
  );
}

// ---- Ashby: {"adapter":"ashby","board":"cohere"} -> https://jobs.ashbyhq.com/cohere
export async function ashby(cfg) {
  const res = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${cfg.board}`);
  return (res.jobs || []).map((j) =>
    job({
      companyKey: cfg.key,
      company: cfg.name,
      id: j.id,
      title: j.title,
      url: j.jobUrl || j.applyUrl,
      locations: [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean),
      postedAt: j.publishedAt || null,
      type: guessType(j.title, j.employmentType || ""),
      snippet: [j.department, j.team, j.employmentType].filter(Boolean).join(" · "),
      extra: { division: j.department || null },
    })
  );
}

// ---- Workday: {"adapter":"workday","tenant":"nvidia","wd":"wd5","site":"NVIDIAExternalCareerSite","queries":["new college grad","analyst"]}
export async function workday(cfg) {
  const host = `https://${cfg.tenant}.${cfg.wd || "wd5"}.myworkdayjobs.com`;
  const api = `${host}/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`;
  const queries = cfg.queries || [""];
  const limit = 20;
  const maxPages = cfg.maxPages || 10;
  const seen = new Map();
  for (const q of queries) {
    for (let p = 0; p < maxPages; p++) {
      const res = await postJson(api, { appliedFacets: cfg.facets || {}, limit, offset: p * limit, searchText: q }, { headers: { accept: "application/json", referer: `${host}/${cfg.site}` } });
      const list = res.jobPostings || [];
      for (const j of list) {
        const id = (j.externalPath || "").split("/").pop() || j.title;
        if (seen.has(id)) continue;
        seen.set(
          id,
          job({
            companyKey: cfg.key,
            company: cfg.name,
            id,
            title: j.title,
            url: `${host}/${cfg.lang || "en-US"}/${cfg.site}${j.externalPath}`,
            locations: [j.locationsText].filter(Boolean),
            postedAt: workdayPosted(j.postedOn),
            type: guessType(j.title),
            snippet: (j.bulletFields || []).join(" · "),
          })
        );
      }
      const total = res.total || 0;
      if (!list.length || (p + 1) * limit >= total) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}

function workdayPosted(s = "") {
  // "Posted Today" / "Posted Yesterday" / "Posted 3 Days Ago" / "Posted 30+ Days Ago"
  const now = new Date();
  const m = String(s).match(/(\d+)\+?\s*day/i);
  let days = m ? Number(m[1]) : /yesterday/i.test(s) ? 1 : /today/i.test(s) ? 0 : null;
  if (days == null) return null;
  const d = new Date(now.getTime() - days * 86400000);
  return d.toISOString().slice(0, 10);
}
