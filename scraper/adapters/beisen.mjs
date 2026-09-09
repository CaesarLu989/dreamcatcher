// Beisen (北森) zhiye.com recruiting portals — used by 国信证券 (guosen) and 中信建投 (csc108).
// Generic: any tenant that lives at https://<tenant>.zhiye.com works with the same API.
import { postJson, job, guessType, sleep } from "../lib.mjs";

function toJob(d, cfg) {
  const title = d.JobAdName || "";
  const locs = (d.LocNames || []).flatMap((l) => String(l).split("/")).map((l) => l.replace(/^.+?·/, "").trim());
  return job({
    companyKey: cfg.key,
    company: cfg.name,
    id: d.Id,
    title,
    url: `https://${cfg.tenant}.zhiye.com/campus/detail?jobAdId=${d.Id}`,
    locations: locs.length ? locs : d.LocNames || [],
    postedAt: d.PostDate || d.PostDateInt || null,
    closesAt: d.EndTime && !String(d.EndTime).startsWith("2222") ? d.EndTime : null,
    type: d.Category === "校园招聘" || d.CategoryId === "2" ? guessType(title, "校招") : guessType(title),
    snippet: [d.Org, d.Category].filter(Boolean).join(" · "),
    extra: { division: d.Org || null, level: null, requirements: String(d.Require || "").replace(/\s+/g, " ").slice(0, 300) },
  });
}

export async function fetchJobs(cfg) {
  const tenant = cfg.tenant;
  if (!tenant) throw new Error("beisen adapter needs cfg.tenant");
  const categories = cfg.categories || ["2"]; // "2" = 校园招聘
  const pageSize = 50;
  const maxPages = cfg.maxPages || 10;
  const seen = new Map();
  for (const cat of categories) {
    for (let p = 0; p < maxPages; p++) {
      const body = { PageIndex: p, PageSize: pageSize, ClassificationOne: [], Category: [cat], KeyWords: "", SpecialType: 0, PortalId: "", DisplayFields: ["Category", "LocId", "Org", "EndTime", "PostDate", "WorkWeChatQrCode"] };
      const res = await postJson(`https://${tenant}.zhiye.com/api/Jobad/GetJobAdPageList`, body, {
        headers: { accept: "application/json", "x-requested-with": "xmlhttprequest", langType: "zh_CN", referer: `https://${tenant}.zhiye.com/campus/jobs` },
      });
      if (res.Code && res.Code !== 200) throw new Error(`Beisen ${tenant}: ${res.Message}`);
      const list = res.Data || [];
      for (const d of list) if (!seen.has(d.Id)) seen.set(d.Id, toJob(d, cfg));
      const total = res.Count || 0;
      if (!list.length || (p + 1) * pageSize >= total) break;
      await sleep(300);
    }
  }
  return [...seen.values()];
}

export const key = "beisen";
export const name = "Beisen (generic)";
