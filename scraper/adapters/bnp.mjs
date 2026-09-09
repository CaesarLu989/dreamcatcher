// BNP Paribas — group.bnpparibas job offers (JSON endpoint returning HTML cards)
import { getJson, job, guessType, sleep, stripTags, matchAll } from "../lib.mjs";

const BASE = "https://group.bnpparibas";

export function parseCards(html) {
  const out = [];
  const re = /<article class="[^"]*card-offer[^"]*">([\s\S]*?)<\/article>/g;
  for (const m of matchAll(re, html)) {
    const card = m[1];
    const href = (card.match(/<a href="([^"]+)" class="card-link"/) || [])[1];
    if (!href) continue;
    const type = stripTags((card.match(/<div class="offer-type">([\s\S]*?)<\/div>/) || [])[1] || "");
    const title = stripTags((card.match(/<h3 class="[^"]*">([\s\S]*?)<\/h3>/) || [])[1] || "");
    const loc = stripTags((card.match(/<div class="offer-location">([\s\S]*?)<\/div>/) || [])[1] || "");
    const entity = (card.match(/<img[^>]*alt="([^"]*)"/) || [])[1] || "";
    out.push({ href, type, title, location: loc, entity });
  }
  return out;
}

export async function fetchJobs(cfg = {}) {
  // Each search is a set of query-string params for ?json=1
  const searches = cfg.searches || [
    { "form[type][]": "2134" }, // Graduate Programme
    { "form[q]": "Hong Kong" },
    { "form[q]": "graduate" },
    { "form[q]": "New York" },
    { "form[q]": "Toronto" },
    { "form[q]": "Montreal" },
    { "form[q]": "Beijing" },
    { "form[q]": "Shanghai" },
  ];
  const maxPages = cfg.maxPages || 10;
  const seen = new Map();
  for (const s of searches) {
    for (let p = 1; p <= maxPages; p++) {
      const q = new URLSearchParams({ json: "1", page: String(p), ...s });
      const res = await getJson(`${BASE}/en/careers/all-job-offers?${q.toString()}`, { headers: { "x-requested-with": "XMLHttpRequest", referer: `${BASE}/en/careers/all-job-offers` } });
      const cards = parseCards(res.html || "");
      for (const c of cards) {
        const id = c.href.split("/").filter(Boolean).pop();
        if (seen.has(id)) continue;
        const t = c.type.toLowerCase();
        const type = /graduate/.test(t) ? "graduate" : /intern|trainee/.test(t) ? "internship" : /volunteer|v\.i\.e/.test(t) ? "internship" : guessType(c.title);
        seen.set(
          id,
          job({
            companyKey: "bnp",
            company: "BNP Paribas",
            id,
            title: c.title,
            url: c.href.startsWith("http") ? c.href : `${BASE}${c.href}`,
            locations: [c.location],
            type,
            snippet: [c.type, c.entity].filter(Boolean).join(" · "),
            extra: { division: c.entity || null, contract: c.type || null },
          })
        );
      }
      const total = Number(res.total || 0);
      if (!cards.length || p * 10 >= total) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}

export const key = "bnp";
export const name = "BNP Paribas";
