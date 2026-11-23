// DreamCatcher v6 — the judgement line that turns the scan (data/jobs.json) into the radar (data/radar.json).
//
//   every posting → region → role family → level and status → hard gates → fit → interview odds → priority
//
// Nothing is capped: every posting that passes is listed; priority only orders them. Postings that fall inside the
// regions but fail a later step are kept in `blocked` with the gate that stopped them, so the page can answer
// "why is this role not here?". Fit, odds and priority are rule-based estimates (no model call).
//
//   node scraper/v6.mjs            re-derive data/radar.json from the current data/jobs.json (no network)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rx = (list) => new RegExp("(" + list.join("|") + ")", "i");

/* ---- regions: Toronto and Hong Kong for everyone; mainland China only for the Chinese brokers ---- */
const REGIONS = [
  { k: "多伦多", en: "Toronto", re: /toronto|mississauga|markham|north york|etobicoke|scarborough|vaughan|oakville|多伦多/i },
  { k: "香港", en: "Hong Kong", re: /hong\s?kong|kowloon|hksar|香港/i },
  { k: "内地", en: "Mainland", re: /shenzhen|beijing|shanghai|guangzhou|hangzhou|nanjing|chengdu|wuhan|china|深圳|北京|上海|广州|杭州|南京|成都|武汉|全国|内地/i, keys: ["guosen", "csc108", "cicc"] },
];

/* ---- role families. `out` families are never pushed; the rest are the eight sectors of the dial ---- */
const OUT = [
  ["eng", rx(["software", "developer", "\\bengineer", "devops", "\\bsre\\b", "full[- ]?stack", "front[- ]?end", "back[- ]?end", "programmer", "architect", "cyber", "information security", "it support", "(it|technology|cloud|platform|data|network) infrastructure", "infrastructure (engineer|operations|support|services|specialist|administrator)", "network (engineer|administrator|operations|security|analyst)", "\\bcloud\\b", "\\bqa\\b", "test(ing)? (analyst|engineer)", "scrum", "\\bux\\b", "\\bui\\b", "machine learning", "data scien", "technician", "scientist", "azure", "\\baws\\b", "\\bsap\\b", "salesforce", "servicenow", "\\berp\\b", "integration", "access management", "identity", "business systems", "solution design", "systems analyst", "application(s)? (support|specialist)", "tech(nology)? consultant", "enterprise solutions", "data (analyst|governance|steward|management|quality)", "开发", "工程师", "算法", "测试", "运维", "技术"])],
  ["quant", rx(["\\bquant", "\\bstrats?\\b", "algorithmic", "high[- ]frequency", "market mak", "量化"])],
  ["audit", rx(["\\baudit", "assurance", "\\btax\\b", "actuar", "accountant", "accounting", "bookkeep", "payroll", "controller", "financial reporting", "审计", "税务", "精算", "会计", "财务核算"])],
  ["legal", rx(["\\blegal\\b", "counsel", "lawyer", "paralegal", "compliance", "\\baml\\b", "\\bkyc\\b", "financial crime", "regulatory affairs", "privacy", "independence", "法务", "合规", "律师"])],
  ["sales", rx(["teller", "\\bbranch\\b", "customer service", "client service", "customer experience", "call cent", "contact cent", "personal banker", "banking advisor", "financial advisor", "financial planner", "mortgage (specialist|advisor)", "insurance advisor", "sales representative", "customer representative", "personal banking", "advisor trainee", "sales associate", "insurance sales", "account executive", "solution sales", "sales (advisor|specialist)", "solution area specialist", "solutions? consultant", "business development", "pre-?sales", "group consultant", "benefits", "\\badvisor\\b", "\\bbanker\\b", "financial planning(?! (and|&) analysis)", "concierge", "private client associate", "enrolment", "理财经理", "客户经理", "柜员", "营业部", "客服", "财富顾问", "业务顾问", "渠道顾问", "投资顾问", "理财顾问", "售前", "销售助理", "主讲", "教研", "老师", "科普"])],
  ["ops", rx(["\\boperations\\b", "settlement", "reconciliation", "back office", "middle office", "fund accounting", "processing", "administrator", "administrative", "coordinator", "executive assistant", "receptionist", "\\bclerk\\b", "facilities", "procurement", "billing", "accounts (payable|receivable)", "resource management", "shared services", "\\bsupport\\b", "help ?desk", "supervisor", "workforce", "capacity planning", "corporate affairs", "team assistant", "secretary", "corporate real estate", "business advisor", "alliance", "cost estimator", "(portfolio|wealth|investment|client)( management| service)? assistant", "administrative assistant", "disaster", "business continuity", "third[- ]party", "运营", "清算", "行政", "后台", "专员"])],
  ["hr", rx(["human resources", "\\bhr\\b", "recruit", "talent acquisition", "marketing", "communications", "public relations", "\\bbrand\\b", "social media", "\\bevents?\\b", "content", "designer", "\\beditor\\b", "\\bproducer\\b", "\\bvideo\\b", "storytelling", "reporter", "journalist", "learning (and|&) development", "\\bpeople\\b", "人力", "招聘专员", "市场营销", "营销", "品牌", "公关", "投教"])],
];
const FAMILIES = [
  ["ib", "投行与资本市场", rx(["investment bank", "\\bibd?\\b", "m&a", "mergers", "capital markets", "\\becm\\b", "\\bdcm\\b", "leveraged finance", "corporate finance", "underwrit", "origination", "\\bipo\\b", "industry coverage", "diversified industries", "restructuring", "debt capital", "equity capital", "债券", "发行", "投行", "投资银行", "并购", "承销", "保荐"])],
  ["res", "研究与评级", rx(["equity research", "research (analyst|associate|assistant)", "credit research", "rating", "macro research", "economist", "economics research", "研究", "行研", "评级", "分析师"])],
  ["buy", "买方直投", rx(["private equity", "private markets", "private capital", "infrastructure", "real estate", "real assets", "venture", "growth equity", "direct invest", "principal invest", "natural resources", "投资岗", "直投", "股权投资"])],
  ["am", "资管与财富", rx(["asset management", "wealth management", "private wealth", "private bank", "portfolio", "fund analyst", "investment management", "fixed income(?!.*trading)", "multi[- ]asset", "asset allocation", "investment analyst", "investment specialist", "institutional sales", "equities", "total fund", "public markets", "capital allocation", "hedge fund", "\\binvestments\\b", "资管", "资产管理", "财富管理", "基金"])],
  ["crd", "信贷、风险与市场", rx(["credit", "\\brisk\\b", "treasury", "sales (and|&) trading", "global markets", "markets", "trading", "structuring", "derivatives", "prime services", "commercial banking", "corporate banking", "lending", "business analyst", "liquidity", "balance sheet", "securiti[sz]ation", "信贷", "风险", "资金", "销售交易", "固定收益", "交易员"])],
  ["con", "战略咨询", rx(["strategy", "consulting", "advisory", "decision analytics", "economic", "战略", "咨询"])],
  ["rot", "管培与企业金融", rx(["corporate development", "financial analyst", "finance analyst", "analyst,? finance", "\\bfp&a\\b", "financial planning (and|&) analysis", "investor relations", "forecast", "modell?ing", "pricing"])],
];
const DIGITAL = rx(["digital", "transformation", "product (analyst|associate)", "数字化"]);
const FINANCEISH = rx(["financ", "treasury", "strategy", "corporate development", "investment", "banking", "\\brisk\\b", "capital", "财务", "金融", "战略"]);
const PROGRAM = rx(["rotational", "rotation", "graduate (program|scheme)", "graduate programme", "new grad", "management trainee", "trainee", "leadership development", "development program", "associate program", "analyst program", "talent programme", "campus", "class of 20", "管培", "培训生", "轮岗", "校园招聘", "校招", "应届"]);
const CN_CITY = { shenzhen: "深圳", beijing: "北京", shanghai: "上海", guangzhou: "广州", hangzhou: "杭州", nanjing: "南京", chengdu: "成都", wuhan: "武汉" };
const SECTORS = [["ib", "投行与资本市场"], ["res", "研究与评级"], ["am", "资管与财富"], ["buy", "买方直投"], ["con", "战略咨询"], ["big4", "四大与数字化"], ["rot", "管培与企业金融"], ["crd", "信贷、风险与市场"]];
const BIG4 = new Set(["deloitte", "ey", "kpmg", "pwc"]), DIGICON = new Set(["accenture", "capco", "zs", "ibm", "cgi"]);

/* ---- level, status and the hard gates ---- */
const NOTJOB = rx(["connect with us", "talent (community|network|pool)", "general application", "future opportunit", "expression of interest", "applicant portal", "future leaders program", "insight (program|week|day)", "spring week", "open day", "\\(online\\)", "人才库"]);
const GROUPONLY = rx(["\\bwomen\\b", "\\bfemale\\b", "indigenous", "\\bblack (talent|professionals|students)", "lgbtq", "veteran", "persons? with disabilit"]);
const PAUSED = ["janestreet", "squarepoint", "drw", "imc", "jump", "optiver", "tower", "hrt", "virtu", "akuna", "point72"];
const CONSULTISH = rx(["consult", "advisory", "analyst", "associate", "deals", "transaction", "valuation", "strategy", "\\brisk\\b", "digital", "transformation", "graduate", "new grad", "campus", "咨询", "顾问"]);
// HARD: a managerial or expert grade — stopped. SOFT: one notch above entry ("Senior Analyst", "Sr. Associate",
// "Senior Consultant", an experienced-hire posting) — kept as a stretch, ranked below everything that fits the level.
const HARD_SENIOR = rx(["\\blead\\b", "principal", "director", "vice president", "\\b[sa]?vp\\b", "\\bhead\\b", "\\bleader\\b", "managing", "partner", "\\bchief\\b", "supervising", "(?<!assistant |product |project |program |portfolio |relationship )manager(?! trainee)", "总监", "经理(?!助理)", "负责人", "主管"]);
const SOFT_SENIOR = rx(["\\bsen(io|oi)r\\b", "\\bsr\\.?\\b", "experienced (hire|professional)", "\\blateral\\b"]);
const STRETCHABLE = rx(["analyst", "associate", "consultant", "\\bstaff\\b", "strategist", "trader", "economist", "研究员", "分析师"]);
const ASSOC_DEAL = rx(["investment bank", "m&a", "capital markets", "private equity", "leveraged finance", "\\bdcm\\b", "\\becm\\b"]);
const PARTTIME = rx(["\\bintern(ship|s)?\\b", "\\bco-?op\\b", "summer (analyst|associate|student)", "off[- ]cycle", "placement", "part[- ]time", "\\bcontract\\b(?!.*permanent)(?<!permanent.*)", "temporary", "\\bstudent\\b", "work term", "\\b(4|8|12|16)[- ]months?\\b", "summer 20\\d\\d(?!.*(graduate|new grad|full[- ]time))", "实习", "兼职"]);
const LANG_NO = rx(["korean", "\\bkorea\\b", "japanese", "\\bjapan\\b", "thai\\b", "vietnamese", "bahasa", "german", "spanish", "portuguese", "italian", "arabic", "french( |-)?(speaking|bilingual)", "bilingual.{0,12}french", "韩语", "日语", "法语"]);

/* ---- who reads the résumé, and how much each signal counts (school, internships, major, coverage, grades, hook) ---- */
const ARCH = {
  gib: { name: "外资投行", en: "Global investment bank", base: 7, w: [20, 35, 5, 10, 20, 10], school: .65 },
  cab: { name: "加拿大五大行", en: "Canadian big five", base: 15, w: [20, 25, 10, 15, 15, 15], school: .85 },
  str: { name: "战略与财务咨询", en: "Strategy & financial consulting", base: 9, w: [25, 20, 5, 5, 25, 20], school: .7 },
  b4: { name: "四大与数字化咨询", en: "Big Four & digital consulting", base: 17, w: [10, 15, 20, 20, 20, 15], school: .8 },
  buy: { name: "买方直投", en: "Buy side", base: 8, w: [10, 35, 10, 30, 5, 10], school: .6 },
  hkc: { name: "香港企业管培", en: "Hong Kong corporate programmes", base: 12, w: [15, 10, 5, 10, 25, 35], school: .6 },
  cnb: { name: "中资券商校招", en: "Chinese brokers, campus", base: 20, w: [30, 35, 10, 10, 5, 10], school: .85 },
  corp: { name: "大型企业项目", en: "Large corporate programmes", base: 15, w: [10, 20, 15, 30, 10, 15], school: .75 },
};
const archOf = (group, key) => group === "cn" ? "cnb" : group === "cabank" ? "cab" : group === "ib" ? "gib" : group === "buyside" ? "buy" : group === "hkcorp" ? "hkc" : group === "consulting" ? (BIG4.has(key) || DIGICON.has(key) ? "b4" : "str") : "corp";
const INTERN = { ib: .85, res: .85, am: .8, buy: .85, crd: .75, con: .6, big4: .65, rot: .7 }, MAJOR = { ib: .9, res: .9, am: .9, buy: .9, crd: .85, con: .65, big4: .8, rot: .75 };

export const HEAT = [{ key: "极高", en: "Peak", min: 90, lit: 1 }, { key: "高", en: "High", min: 78, lit: .74 }, { key: "较高", en: "Raised", min: 66, lit: .5 }, { key: "中", en: "Medium", min: 52, lit: .34 }, { key: "较低", en: "Low", min: 38, lit: .2 }, { key: "低", en: "Faint", min: 0, lit: .07 }];
const BLOCKED_MAX = 2500;
const BAND = (m) => (m >= 35 ? "A" : m >= 20 ? "B" : m >= 8 ? "C" : "D");
const days = (a, b) => Math.round((a - b) / 86400000), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function buildRadar({ jobs = [], dropped = [], sources = {}, counts = {}, config = {}, now = new Date(), generatedAt = null }) {
  const P = config.profile || {}, V = config.v6 || {}, comp = Object.fromEntries((config.companies || []).map((c) => [c.key, c]));
  const freshDays = V.freshDays ?? 6, soonDays = V.soonDays ?? 14, staleDays = V.staleDays ?? 45, focusMin = V.focusMin ?? 66, edges = V.edges || {}, auth = P.workAuth || {}, boost = P.companyBoost || {};
  const signals = { grades: .5, hook: .6, ...(V.signals || {}) };
  const roles = [], blocked = [], n = { region: 0, family: 0, eligible: 0, pass: 0 }, out = { region: 0, family: 0, level: 0, gate: 0 };
  // gate: 0 岗位族 · 1 级别 · 2 非全职 · 3 语言 · 4 工作许可 · 5 证书执照 · 6 岗位状态 · 7 资格 ; n: [code, …params] — the page owns the wording
  const tally = new Map(), F = (k) => tally.get(k) || tally.set(k, { n: 0, ok: 0, st: 0, bl: 0 }).get(k);
  const block = (j, region, g, ...n) => { F(j.companyKey).bl++; blocked.push({ id: j.id, k: j.companyKey, co: j.company, t: j.title, url: j.url, region, g, n }); };

  const seen = new Map();
  for (const j of [...jobs, ...dropped.map((d) => ({ ...d, _dropped: true }))]) {
    if (j.type === "event") continue;
    const c = comp[j.companyKey] || {}, group = c.group || null, where = [j.location || "", ...(j.locations || [])].join(" · ");
    const R = REGIONS.find((r) => r.re.test(where) && (!r.keys || (V.mainland || r.keys).includes(j.companyKey)));
    if (!R) { out.region++; continue; }
    n.region++; F(j.companyKey).n++;
    const title = j.title || "", hay = title, m = j.match || {}, reasons = m.reasons || [], ak = archOf(group, j.companyKey), A = ARCH[ak];
    if ((V.paused || PAUSED).includes(j.companyKey)) { out.family++; block(j, R.k, 0, "paused"); continue; }
    // role family
    // "Strategy & Operations", "Operations Finance" and the like are consulting or finance work, not back-office operations
    const cleaned = title.replace(/strategy\s*(and|&)\s*operations|operations\s*(consult\w*|advisory|strategy|transformation|excellence|finance|-\s*mergers)|business operations (analyst|associate)/gi, " ");
    const bad = OUT.find(([, re]) => re.test(cleaned));
    let fam = FAMILIES.find(([, , re]) => re.test(hay));
    const isProgram = PROGRAM.test(hay) || ["graduate", "campus"].includes(j.type) || reasons.includes("program");
    if (bad) { out.family++; block(j, R.k, 0, "fam", bad[0]); continue; }
    let sector = fam ? fam[0] : null;
    if (ak === "b4") { if (!CONSULTISH.test(title)) { out.family++; block(j, R.k, 0, "notcon"); continue; } sector = "big4"; }
    else if (ak === "str") { if (!CONSULTISH.test(title)) { out.family++; block(j, R.k, 0, "notcon"); continue; } sector = "con"; }
    else if (ak === "corp" && !FINANCEISH.test(title)) sector = null;
    else if (!sector && group === "buyside" && /analyst|associate|invest/i.test(title)) sector = "am";
    else if (!sector && ak !== "cnb" && DIGITAL.test(hay)) sector = "big4";
    else if (!sector && isProgram && ak !== "cnb" && (ak !== "corp" || FINANCEISH.test(title))) sector = "rot";
    if (!sector) { out.family++; block(j, R.k, 0, "nofam"); continue; }
    n.family++;
    // level, type, status
    const req = m.req || {}, posted = j.postedAt ? new Date(j.postedAt) : null, closes = j.closesAt ? new Date(j.closesAt) : null;
    const age = posted && !isNaN(posted) ? Math.max(0, days(now, posted)) : null, left = closes && !isNaN(closes) ? days(closes, now) : null;
    let stop = null, stretch = null;
    const lvl = title.replace(/\b(consultant|analyst|associate|staff)\s*\/\s*(senior|sr\.?)\s+(consultant|analyst|associate|staff)\b/i, "$1");
    if (NOTJOB.test(title)) stop = [6, "notjob"];
    else if (PARTTIME.test(title) || j.type === "internship") stop = [2, "parttime"];
    else if (HARD_SENIOR.test(lvl) && !isProgram) stop = [1, "senior"];
    else if (SOFT_SENIOR.test(lvl) && !isProgram) { if (STRETCHABLE.test(title)) stretch = "senior"; else stop = [1, "senior"]; }
    else if (/\bassociate\b/i.test(title) && !/analyst|junior/i.test(title) && !isProgram && (ASSOC_DEAL.test(hay) || ["gib", "buy", "str"].includes(ak))) stretch = "assoc";
    if (stop || stretch) { /* decided */ }
    else if (req.years != null && req.years > (P.hardLimits?.maxYears ?? 2) && !req.soft) stop = [1, "years", req.years];
    else if (reasons.some((r) => /^years:/.test(r))) stop = [1, "yearsx"];
    else if (left != null && left < 0) stop = [6, "closed"];
    if (stop) { out.level++; block(j, R.k, ...stop); continue; }
    if (stretch) out.level++; else n.eligible++;
    // hard gates
    if (LANG_NO.test(title + " " + (j.snippet || ""))) { out.gate++; block(j, R.k, 3, "lang"); continue; }
    if ((req.creds || []).length || reasons.some((r) => /^cred:/.test(r))) { out.gate++; block(j, R.k, 5, "cred", (req.creds || []).join("、")); continue; }
    if (GROUPONLY.test(title) && !(V.eligible || []).includes(j.id)) { out.gate++; block(j, R.k, 7, "group"); continue; }
    if (auth[R.k] === false) { out.gate++; block(j, R.k, 4, "auth"); continue; }
    if (j._dropped) { out.gate++; block(j, R.k, 0, "old", reasons[0] || ""); continue; }
    // the city inside the region: a Toronto suburb, or the mainland city (from the title's brackets or the location text); null = the region itself
    const cityIn = R.k === "内地" ? (title.match(/[（(]([\u4e00-\u9fff、，,]{2,12})[）)]/) || [])[1] : null, hit = [...(j.locations || []), j.location || ""].find((l) => R.re.test(l)) || "";
    const city0 = cityIn || (R.k === "多伦多" ? (hit.match(/mississauga|markham|vaughan|oakville|north york|etobicoke|scarborough/i) || [null])[0] : R.k === "内地" ? (hit.match(/深圳|北京|上海|广州|杭州|南京|成都|武汉|全国/) || [CN_CITY[(hit.match(/shenzhen|beijing|shanghai|guangzhou|hangzhou|nanjing|chengdu|wuhan/i) || [""])[0].toLowerCase()] || null])[0] : null);
    const dupKey = (j.company || j.companyKey) + "|" + title.toLowerCase().replace(/[（(][^）)]*[）)]/g, " ").replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\bj\d+\b/g, "").replace(/\s+/g, " ").trim() + "|" + R.k;
    if (seen.has(dupKey)) { const first = seen.get(dupKey); if (city0 && !first.cities.includes(city0)) first.cities.push(city0); out.gate++; continue; }
    n.pass++;

    // fit
    const d = m.dims || {}, hits = m.hits || [], fin = d.finance ?? 50, con = d.consulting ?? 50, man = d.management ?? 50, ent = d.entry ?? 55;
    const famDim = sector === "con" ? con : sector === "big4" ? Math.max(con, .6 * (d.ai ?? 40) + .4 * man) : sector === "rot" ? Math.max(fin, man) : fin;
    const fit = Math.round(clamp(.42 * famDim + .23 * ent + .2 * Math.min(100, hits.length * 15) + .15 * Math.min(100, m.score ?? 50), 40, 98));
    // odds of a first-round interview with a person
    const s = [A.school, INTERN[sector], MAJOR[sector], clamp(hits.length / 6, .2, 1), signals.grades, signals.hook];
    const S = A.w.reduce((q, w, i) => q + w * s[i], 0) / 100, seenAge = j.firstSeen ? Math.max(0, days(now, new Date(j.firstSeen))) : null, fresh = (age ?? seenAge ?? 99) <= freshDays, soon = left != null && left <= soonDays, stale = left == null && age != null && age > staleDays, tier = Number(c.tier) || 2, edge = edges[j.companyKey];
    let mid = A.base * (.45 + 1.55 * S) * (isProgram ? 1.3 : 1) * (ent < 60 ? .6 : 1) * (tier === 1 ? .7 : tier === 3 ? 1.15 : 1) * (R.k === "多伦多" || ak === "cnb" ? 1 : ak === "gib" || ak === "buy" ? .8 : .85) * (stale ? .75 : fresh ? 1.1 : 1) * (edge ? edge.x || 1.2 : 1);
    if (stretch) mid *= stretch === "assoc" ? .4 : .45;
    mid = clamp(mid, stretch ? 1.5 : 2.5, 45);
    const lo = Math.max(stretch ? 1 : 2, Math.round(mid * .82)), hi = Math.min(60, Math.round(mid * 1.22)), band = BAND(mid);
    // priority: fit 45 %, odds 35 %, timeliness 20 % (weighted geometric mean), plus a lift for priority firms
    const T = left != null ? (left <= soonDays ? 100 : left <= 30 ? 88 : 75) : age == null ? 60 : age <= freshDays ? 100 : age <= 14 ? 85 : age <= 30 ? 70 : age <= staleDays ? 58 : 35;
    const pr = Math.round(clamp(Math.exp(.45 * Math.log(fit) + .35 * Math.log(Math.min(100, mid * 2.3)) + .2 * Math.log(T)) + Math.min(8, (boost[j.companyKey] || 0) * 1.4), 20, stretch ? Math.min(62, focusMin - 4) : 99));
    const heat = HEAT.find((h) => pr >= h.min);
    // why: [code, …params], most telling first — the page turns the top two into a sentence in either language
    const why = [stretch ? ["stretch", stretch] : null, edge?.note ? ["edge", edge.note, edge.noteEn || edge.note] : null, soon ? ["soon", j.closesAt, left] : null, fresh ? ["fresh"] : null, isProgram ? ["prog"] : null, hits.length ? ["hits", hits.slice(0, 3)] : null, stale ? ["stale", age] : null].filter(Boolean);
    // the seven hard gates, in order: 级别 · 学位与毕业窗口 · 语言 · 工作许可 · 证书执照 · 岗位状态 · 冷却期与资格 (the last one is completed in the page from your own records)
    const gates = [stretch ? ["ask", "stretch_" + stretch] : ["ok", isProgram ? "prog" : "junior"], ["ok", isProgram ? "gradprog" : "nograd"], ["ok", reasons.some((r) => /mandarin|中文|中英/.test(r)) || hits.includes("中英双语") ? "zh" : "enzh"], [auth[R.k] === true ? "ok" : "ask", auth[R.k] === true ? "auth" : "authask"],
      ["ok", (req.credsSoft || []).length ? "credsoft" : "nocred", (req.credsSoft || []).join("、") || undefined], [stale ? "ask" : "ok", stale ? "stale" : left != null ? "left" : "open", stale ? age : left != null ? left : undefined], ["ok", "nocool"]];
    const shown = title.replace(/\s*[（(]J\d+[）)]\s*$/, "").replace(cityIn ? /[（(][\u4e00-\u9fff、，,]{2,12}[）)]/ : /$^/, "");
    const role = { id: j.id, co: j.company, key: j.companyKey, group, t: shown, url: j.url, region: R.k, city: city0 ? city0.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null, cities: city0 ? [city0] : [], s: sector, st: stretch || undefined, prog: isProgram || undefined, pr, heat: heat.key, lit: heat.lit, fit, lo, hi, band, arch: ak,
      age, left, posted: j.postedAt || null, closes: j.closesAt || null, first: j.firstSeen || null, fresh: fresh || undefined, soon: soon || undefined, stale: stale || undefined, old: j.stale || undefined, why, hits, gates, sig: s.map((x) => Math.round(x * 100)), ai: j.ai?.reason || undefined };
    seen.set(dupKey, role); roles.push(role); F(j.companyKey)[stretch ? "st" : "ok"]++;
  }
  for (const r of roles) { if (r.cities.length > 1) r.more = r.cities.length - 1; delete r.cities; }
  roles.sort((a, b) => b.pr - a.pr || b.fit - a.fit || (a.t > b.t ? 1 : -1));
  roles.forEach((r, i) => { r.rank = i + 1; });
  // more is blocked than a page can list: level / language / credential / status stops first, then "no family", then the out-of-scope families
  const blockedAll = blocked.length, rankB = (b) => (b.g !== 0 ? 0 : b.n[0] === "fam" ? 2 : 1);
  if (blocked.length > BLOCKED_MAX) { blocked.sort((a, b) => rankB(a) - rankB(b)); blocked.length = BLOCKED_MAX; }
  const core = roles.filter((r) => !r.st), inScope = new Set(["ib", "consulting", "cabank", "buyside", "cn"]);
  // every firm that is tracked for these regions, with what happened to its postings — the page's company filter reads this
  const firms = (config.companies || []).filter((c) => c.adapter && c.enabled !== false && !String(c.key).startsWith("_") && (tally.has(c.key) || (inScope.has(c.group) && !(V.paused || PAUSED).includes(c.key))))
    .map((c) => ({ key: c.key, name: c.name, group: c.group || null, tier: c.tier || 2, ...(tally.get(c.key) || { n: 0, ok: 0, st: 0, bl: 0 }), err: sources[c.key]?.ok === false || undefined, relay: (sources[c.key]?.ok === false && sources[c.key]?.relay) || undefined, seen: sources[c.key] ? undefined : false, paused: (V.paused || PAUSED).includes(c.key) || undefined, probation: c.probation || undefined }));
  // a relayed firm: the browser counted every posting in range, the engine only saw the ones worth sending
  for (const f of firms) { const inR = sources[f.key]?.ok === false ? sources[f.key]?.relayInRegion : null; if (inR > f.n) { f.n = inR; f.bl = f.n - f.ok - f.st; } }
  const relayed = Object.values(sources).filter((s) => s.ok === false && s.relay).map((s) => s.relay).sort();
  const fetched = counts.fetched ?? jobs.length + dropped.length, src = Object.entries(sources).map(([k, v]) => ({ key: k, name: v.name, group: v.group, ok: v.ok !== false, count: v.count ?? 0, kept: core.filter((r) => r.key === k).length, error: v.ok === false ? String(v.error || "").slice(0, 140) : undefined, relay: (v.ok === false && v.relay) || undefined, at: v.fetchedAt || v.failedAt || null, probation: comp[k]?.probation || undefined }));
  return {
    version: 6, generatedAt: generatedAt || now.toISOString(), focusMin, freshDays, soonDays, staleDays, tags: Object.fromEntries(((P.resumeKeywords || {}).items || []).filter((x) => x.tag).map((x) => [x.tag, x.en || x.tag])), sectors: SECTORS, regions: REGIONS.map((r) => r.k), groups: config.groups || {}, heat: HEAT, archetypes: Object.fromEntries(Object.entries(ARCH).map(([k, a]) => [k, { name: a.name, en: a.en, w: a.w, base: a.base }])),
    funnel: [{ n: fetched }, { n: n.region, drop: fetched - n.region }, { n: n.family, drop: out.family }, { n: n.eligible, drop: out.level }, { n: core.length, drop: n.eligible - core.length }],
    counts: { fetched, roles: core.length, stretch: roles.length - core.length, focus: core.filter((r) => r.pr >= focusMin).length, fresh: core.filter((r) => r.fresh).length, soon: core.filter((r) => r.soon).length, blocked: blockedAll, blockedListed: blocked.length, sources: src.length, sourceErrors: src.filter((x) => !x.ok).length, sourceEmpty: src.filter((x) => x.ok && !x.count).length },
    roles, blocked, firms, sources: src, note: relayed.length ? { relay: relayed[relayed.length - 1], firms: relayed.length } : undefined,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  const data = read("data/jobs.json"), radar = buildRadar({ jobs: data.jobs, sources: data.sources, counts: data.counts, config: read("config.json"), now: new Date(data.generatedAt), generatedAt: data.generatedAt });
  fs.writeFileSync(path.join(root, "data/radar.json"), JSON.stringify(radar));
  const by = (f) => Object.entries(radar.roles.reduce((q, r) => ((q[f(r)] = (q[f(r)] || 0) + 1), q), {})).map(([k, v]) => k + " " + v).join(" · ");
  console.log(`radar: ${radar.funnel.map((x) => x.n).join(" → ")} (+${radar.counts.stretch} stretch) | focus ${radar.counts.focus} · fresh ${radar.counts.fresh} · soon ${radar.counts.soon} | ${by((r) => r.region)} | ${by((r) => r.s)} | ${by((r) => r.band)} | blocked ${radar.blocked.length}`);
  if (process.argv.includes("--list")) for (const r of radar.roles) console.log(String(r.rank).padStart(3), r.pr, r.fit, `${r.lo}-${r.hi}%`, r.band, r.s.padEnd(4), r.st ? "STRETCH" : "", r.region, r.city, "|", r.co, "|", r.t.slice(0, 70), "|", r.why.map((w) => w[0]).join(","));
}
