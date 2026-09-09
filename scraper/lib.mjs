// Shared helpers for all adapters. Plain JS, no dependencies — runs in Node 22+
// (GitHub Actions) and, for testing, inside a browser tab on the target site.

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with timeout + retry. Throws on final failure. */
export async function request(url, opts = {}, { retries = 2, timeoutMs = 30000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const headers = { "user-agent": UA, accept: "application/json, text/html;q=0.9, */*;q=0.8", "accept-language": "en-US,en;q=0.9", ...(opts.headers || {}) };
      const res = await fetch(url, { ...opts, headers, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} ${url}`);
      return res;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function getJson(url, opts = {}, r) {
  const res = await request(url, opts, r);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url} :: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${url} :: ${text.slice(0, 200)}`);
  }
}

export async function getText(url, opts = {}, r) {
  const res = await request(url, opts, r);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url} :: ${text.slice(0, 200)}`);
  return text;
}

export async function postJson(url, body, opts = {}, r) {
  return getJson(
    url,
    { ...opts, method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...(opts.headers || {}) } },
    r
  );
}

/** Decode common HTML entities and strip tags. Good enough for titles/locations. */
export function stripTags(html = "") {
  return decodeEntities(String(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function decodeEntities(s = "") {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Iterate over regex matches. */
export function* matchAll(re, text) {
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m;
  while ((m = r.exec(text))) yield m;
}

/** Normalize a date-ish value to YYYY-MM-DD or null. */
export function toDate(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // seconds vs ms
    const d = new Date(ms);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

/**
 * Parse short localized dates like "01 Sep", "03 9月", "28 Aug" (Barclays cards).
 * Assumes the most recent occurrence of that day/month.
 */
export function parseShortDate(s, now = new Date()) {
  if (!s) return null;
  const t = String(s).trim();
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  let day, mon;
  let m = t.match(/^(\d{1,2})\s*([A-Za-z]{3,4})/);
  if (m) {
    day = +m[1];
    mon = months[m[2].toLowerCase()];
  } else if ((m = t.match(/^(\d{1,2})\s*(\d{1,2})月/))) {
    day = +m[1];
    mon = +m[2] - 1;
  } else if ((m = t.match(/^([A-Za-z]{3,4})\s*(\d{1,2})/))) {
    day = +m[2];
    mon = months[m[1].toLowerCase()];
  }
  if (day == null || mon == null || isNaN(mon)) return toDate(t);
  let y = now.getUTCFullYear();
  let d = new Date(Date.UTC(y, mon, day));
  if (d > now) d = new Date(Date.UTC(y - 1, mon, day));
  return d.toISOString().slice(0, 10);
}

/** Build a normalized job record. Adapters call this so every source looks the same. */
export function job({ companyKey, company, id, title, url, locations = [], postedAt = null, closesAt = null, type = "unknown", snippet = "", extra = {} }) {
  const locs = [...new Set(locations.map((l) => String(l || "").replace(/\s+/g, " ").trim()).filter(Boolean))];
  return {
    id: `${companyKey}:${id}`,
    companyKey,
    company,
    title: String(title || "").replace(/\s+/g, " ").trim(),
    url,
    locations: locs,
    location: locs.length > 6 ? locs.slice(0, 5).join(" · ") + ` · +${locs.length - 5} more` : locs.join(" · "),
    postedAt: toDate(postedAt),
    closesAt: toDate(closesAt),
    type, // campus | internship | graduate | experienced | event | unknown
    snippet: String(snippet || "").replace(/\s+/g, " ").trim().slice(0, 240),
    ...extra,
  };
}

/** Guess job type from title text. */
export function guessType(title = "", hint = "") {
  const t = `${title} ${hint}`.toLowerCase();
  if (/(case challenge|insight|inside the industry|women who lead|event|workshop|open day|networking|spring week|discovery day|early insights|history month|conference)/.test(t)) return "event";
  if (/(summer analyst|summer associate|\bintern\b|\binternship\b|\binterns\b|industrial placement|off-cycle|off cycle|co-op|\bplacement\b|winter cohort|seasonal|长期实习|实习)/.test(t)) return "internship";
  if (/(graduate|new analyst|full[- ]time analyst|analyst program|analyst programme|development program|development programme|校招|校园招聘|应届|管培|new associate|rotational)/.test(t)) return "graduate";
  if (/^\d{4}\b/.test(title.trim()) || /\b20(26|27|28)\b/.test(t)) return "campus";
  return "experienced";
}
