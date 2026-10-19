// Rule-based fit scoring. No AI here — pure keyword/location rules driven by config.json.
// Score 0–100 → tier: strong (>= 65) / possible (40–64) / weak (20–39) / dropped (< 20 or excluded).

// Plain strings are escaped and get word boundaries on any Latin/digit edge ("NY" never matches "whippaNY");
// entries containing a backslash (e.g. "\\bvp\\b") are used as raw regex.
const rx = (arr) =>
  new RegExp(
    "(" +
      arr
        .map((s) => {
          if (s.includes("\\")) return s;
          const e = s.replace(/[.*+?^${}()|[\]]/g, "\\$&");
          const lead = /^[A-Za-z0-9]/.test(s) ? "(?<![A-Za-z0-9])" : "";
          const tail = /[A-Za-z0-9]$/.test(s) ? "(?![A-Za-z0-9])" : "";
          return lead + e + tail;
        })
        .join("|") +
      ")",
    "i"
  );

const DIM_KEYS = ["ai", "finance", "consulting", "management"];
const ENTRY_TEXT = /(new grad|new graduate|recent graduate|recent grads?|fresh graduate|graduating (students|seniors)|class of 20\d\d|entry[- ]level|early[- ]career|\b0\s*[-–to]+\s*[12]\s*years?|no (prior )?experience (required|necessary)|campus hire|university hire|应届|校招|毕业生|零经验)/i;

/** Compile the dimension / resume-keyword dictionaries once; textSignals() then scans any text (title, snippet, description). */
export function buildSignals(profile) {
  const dims = {};
  for (const k of DIM_KEYS) {
    const d = (profile.dimensions || {})[k] || {};
    dims[k] = { strong: d.strong && d.strong.length ? rx(d.strong) : null, weak: d.weak && d.weak.length ? rx(d.weak) : null };
  }
  const kws = ((profile.resumeKeywords || {}).items || []).map((it) => ({ tag: it.tag, en: it.en || it.tag, re: rx(it.terms || []) }));
  return function textSignals(text) {
    const t = String(text || "");
    const out = { dims: {}, hits: [] };
    for (const k of DIM_KEYS) out.dims[k] = dims[k].strong && dims[k].strong.test(t) ? 2 : dims[k].weak && dims[k].weak.test(t) ? 1 : 0;
    for (const kw of kws) if (kw.re.test(t)) out.hits.push(kw.tag);
    out.entry = ENTRY_TEXT.test(t);
    return out;
  };
}

export function buildMatcher(profile, companies) {
  const P = profile;
  const signals = buildSignals(P);
  const tiers = {};
  for (const c of companies || []) if (c.key) tiers[c.key] = Number(c.tier) || 2;
  const O = { tierBase: { 1: 18, 2: 38, 3: 52 }, localCities: ["Toronto"], chineseCities: ["Hong Kong", "Shenzhen", "Beijing", "Shanghai"], visaCities: ["New York", "Chicago", "San Francisco", "Boston", "Jersey City", "Purchase"], mandarinTag: "中英双语", ...(P.odds || {}) };
  const cityIndex = [];
  for (const [tier, list] of [["target", P.cities.target], ["secondary", P.cities.secondary || []]]) {
    for (const c of list) {
      const aliases = [c, ...(P.cityAliases?.[c] || [])];
      cityIndex.push({ city: c, tier, re: rx(aliases) });
    }
  }
  const R = {
    entry: rx(P.levels.entry),
    mba: rx(P.levels.mbaAssociate || ["summer associate", "pre-mba", "mba"]),
    senior: rx(P.levels.senior),
    seniorHard: rx(P.levels.seniorHard || ["vice president", "\\bvp\\b", "executive director", "managing director", "director", "head of", "\\bphd\\b"]),
    seniorSoft: rx(P.levels.seniorSoft || ["senior analyst"]),
    preferred: rx(P.domains.preferred),
    moderate: rx(P.domains.moderate || ["risk", "finance", "treasury", "operations"]),
    negative: rx(P.domains.negative),
    exclude: rx(P.exclude || ["nurse", "physician"]),
    global: /(global|multiple locations|various|remote|anywhere|全国|各地)/i,
  };
  const years = { target: P.years.target, ok: P.years.ok || [] };
  const excludeTypes = new Set(P.excludeTypes || []);
  // hard limits Caesar cannot meet: experience above maxYears, credentials he does not hold
  const lim = { maxYears: 2, creds: ["MBA", "CPA", "CFA", "PHD", "JD", "ACCA", "FSA", "ASA", "FCIA", "PENG"], ...(P.hardLimits || {}) };
  const limCreds = new Set((lim.creds || []).map((c) => String(c).toUpperCase().replace(/\./g, "")));

  return function match(j) {
    const title = j.title || "";
    // ---- type excludes (e.g. internships when only full-time roles are wanted)
    if (excludeTypes.has(j.type)) return { score: 0, tier: "dropped", reasons: ["type:" + j.type], excluded: true };
    const hay = `${title} ${j.snippet || ""} ${(j.locations || []).join(" ")} ${j.division || ""} ${j.level || ""}`;
    const reasons = [];
    let score = 0;
    let excluded = false;

    // ---- hard excludes
    if (R.exclude.test(hay)) return { score: 0, tier: "dropped", reasons: ["excluded-term"], excluded: true };

    // ---- level
    const isEvent = j.type === "event";
    if (R.seniorHard.test(title)) {
      // VP / director / MD / PhD-only titles are out even when they also say "analyst"
      excluded = true;
      reasons.push("senior:" + (title.match(R.seniorHard)?.[1] || "").toLowerCase());
    } else if (R.senior.test(title) && !R.entry.test(title)) {
      excluded = true;
      reasons.push("senior");
    } else if (R.seniorSoft.test(title)) {
      score += 10;
      reasons.push("senior-analyst");
    } else if (R.mba.test(title) && !/analyst/i.test(title)) {
      score += 2;
      reasons.push("mba-track");
    } else if (["graduate", "campus", "internship"].includes(j.type)) {
      score += 35;
      reasons.push("program");
    } else if (R.entry.test(title) || (j.level && R.entry.test(j.level))) {
      score += 28;
      reasons.push("entry-level");
    } else if (/\bassociate\b/i.test(title) && !/junior associate|associate analyst|research associate|associate consultant/i.test(title)) {
      score += 5;
      reasons.push("associate");
    } else {
      score += 12;
      reasons.push("level-unknown");
    }

    // ---- year
    const ys = [...hay.matchAll(/\b(20\d{2})\b/g)].map((m) => +m[1]);
    const yearHit = ys.find((y) => years.target.includes(y));
    if (yearHit) {
      score += 20;
      reasons.push(String(yearHit));
    } else if (ys.some((y) => years.ok.includes(y))) {
      score += 5;
      reasons.push(String(ys.find((y) => years.ok.includes(y))));
    } else if (ys.some((y) => y < Math.min(...years.target) - 1)) {
      score -= 25;
      reasons.push("old-cycle");
    }

    // ---- city
    let cityTier = null;
    let matchedCity = null;
    for (const c of cityIndex) {
      if (c.re.test(hay)) {
        if (!cityTier || (cityTier === "secondary" && c.tier === "target")) {
          cityTier = c.tier;
          matchedCity = c.city;
        }
      }
    }
    if (cityTier === "target") {
      score += P.cityWeights?.[matchedCity] ?? 25;
      reasons.push(matchedCity);
    } else if (cityTier === "secondary") {
      score += P.cityWeights?.[matchedCity] ?? 10;
      reasons.push(matchedCity);
    } else if (R.global.test(hay) || !(j.locations || []).length) {
      score += 5;
      reasons.push("location-open");
    } else {
      score -= 10;
      reasons.push("other-city");
    }

    // ---- domain (a hit in the title counts more than one in the division / snippet)
    const rest = `${j.snippet || ""} ${j.division || ""}`;
    if (R.preferred.test(title)) {
      score += 15;
      reasons.push("domain:" + (title.match(R.preferred)?.[1] || "").toLowerCase());
    } else if (R.preferred.test(rest)) {
      score += 8;
      reasons.push("domain:" + (rest.match(R.preferred)?.[1] || "").toLowerCase());
    } else if (R.moderate.test(hay)) {
      score += 4;
      reasons.push("domain:" + (hay.match(R.moderate)?.[1] || "").toLowerCase());
    }
    // ---- company priority (config.profile.companyBoost)
    const boost = P.companyBoost?.[j.companyKey] || 0;
    if (boost) {
      score += boost;
      reasons.push("priority-firm");
    }
    const negHay = `${title} ${rest}`; // never the location ("香港特别行政区" must not trip "行政")
    if (R.negative.test(negHay)) {
      score -= 35;
      reasons.push("neg:" + (negHay.match(R.negative)?.[1] || "").toLowerCase());
    }

    // ---- hard requirements parsed from the description (index.mjs attaches j.req)
    const req = j.req || null;
    let reqOut = null;
    if (req) {
      reqOut = { years: req.minYears != null ? req.minYears + "+" : req.maxYears != null ? "≤" + req.maxYears : null, soft: !!req.yearsSoft, creds: req.creds || [], credsSoft: req.credsSoft || [] };
      if (req.minYears != null && req.minYears > lim.maxYears) {
        if (!req.yearsSoft) { excluded = true; reasons.push("years:" + req.minYears + "+"); }
        else { score -= 8; reasons.push("years-pref:" + req.minYears + "+"); }
      }
      const hardCred = (req.creds || []).find((c) => limCreds.has(String(c).toUpperCase()));
      if (hardCred) { excluded = true; reasons.push("cred:" + hardCred); }
      else if ((req.credsSoft || []).some((c) => limCreds.has(String(c).toUpperCase()))) { score -= 4; reasons.push("cred-pref"); }
    }

    // ---- multi-dimension fit: AI / 金融 / 咨询 / 管理 (keywords) + 应届 (how open to a new graduate)
    // title hits count most, then the description (index.mjs attaches j.textDims / j.textHits from the cached text),
    // then the division / snippet.
    const sigTitle = signals(title), sigRest = signals(rest), textDims = j.textDims || {}, textHits = j.textHits || [];
    const dims = {};
    for (const k of DIM_KEYS) {
      const t = sigTitle.dims[k], d = textDims[k] || 0, r = sigRest.dims[k];
      dims[k] = Math.max(t === 2 ? 100 : t === 1 ? 62 : 0, d === 2 ? 72 : d === 1 ? 38 : 0, r === 2 ? 70 : r === 1 ? 35 : 0, 8);
    }
    const level = reasons[0] || "";
    let entry = level === "program" ? 95 : level === "entry-level" ? 85 : level === "associate" ? 55 : level === "level-unknown" ? 55 : level === "senior-analyst" ? 45 : level === "mba-track" ? 40 : 50;
    if (req) {
      if (req.maxYears != null && req.maxYears <= lim.maxYears) entry = Math.max(entry, 88);
      if (req.minYears != null && req.minYears > 0 && req.minYears <= lim.maxYears && !req.yearsSoft) entry = Math.min(entry, 72);
      if (req.minYears != null && req.minYears > lim.maxYears && req.yearsSoft) entry = Math.min(entry, 45);
    }
    if (sigTitle.entry || sigRest.entry || j.textEntry) entry = Math.max(entry, 90);
    dims.entry = entry;
    const hits = [...new Set([...sigTitle.hits, ...sigRest.hits, ...textHits])];
    const best = Math.max(dims.ai, dims.finance, dims.consulting, dims.management);
    // nudge the overall score toward Caesar's directions and résumé — small on purpose, the fingerprint carries the detail
    if (best >= 90) { score += 6; reasons.push("fit:" + DIM_KEYS.find((k) => dims[k] === best)); } else if (best >= 70) { score += 3; reasons.push("fit:" + DIM_KEYS.find((k) => dims[k] === best)); }
    if (hits.length >= 3) { score += 4; reasons.push("resume:" + hits.length); } else if (hits.length) { score += 2; reasons.push("resume:" + hits.length); }
    if (entry >= 85) score += 3; else if (entry <= 45) { score -= 6; reasons.push("not-entry"); }

    // ---- 胜算: a rough chance of getting an interview / offer (heuristic — public signals only)
    const odds = oddsOf(j, { tier: tiers[j.companyKey] || 2, entry, best, hits, matchedCity, level, req });

    // ---- events: informational, never "strong"
    if (isEvent) {
      const t = cityTier ? "event" : "dropped";
      const sc = Math.max(0, Math.min(score, 45));
      return { score: sc, tier: t, heat: heatBand(sc), reasons: ["event", ...reasons], excluded: false, matchedCity, dims, hits, odds };
    }
    if (excluded) return { score: 0, tier: "dropped", reasons, excluded: true, matchedCity, req: reqOut || undefined, dims, hits, odds };

    score = Math.max(0, Math.min(100, score));
    const tier = score >= 65 ? "strong" : score >= 40 ? "possible" : score >= 20 ? "weak" : "dropped";
    return { score, tier, heat: heatBand(score), reasons, excluded: false, matchedCity, req: reqOut || undefined, dims, hits, odds };
  };

  function oddsOf(j, x) {
    const parts = []; // [token, weight]
    const base = O.tierBase[x.tier] ?? 45;
    parts.push(["tier:" + x.tier, 0]);
    let v = base;
    const e = Math.round((x.entry - 50) * 0.4); v += e; if (Math.abs(e) >= 5) parts.push([e > 0 ? "entry" : "not-entry", e]);
    if (x.best >= 90) { v += 8; parts.push(["fit", 8]); } else if (x.best >= 70) { v += 4; parts.push(["fit", 4]); }
    const h = Math.min(10, Math.round(2.5 * x.hits.length)); if (h) { v += h; parts.push(["hits:" + x.hits.length, h]); }
    if (x.hits.includes(O.mandarinTag)) { v += 8; parts.push(["mandarin", 8]); }
    if (x.matchedCity) {
      if (O.localCities.includes(x.matchedCity)) { v += 6; parts.push(["local", 6]); }
      else if (O.chineseCities.includes(x.matchedCity)) { v += 4; parts.push(["cn-city", 4]); }
      else if (O.visaCities.includes(x.matchedCity)) { v -= 5; parts.push(["visa", -5]); }
      else { v -= 2; parts.push(["far", -2]); }
    }
    if (x.tier >= 2 && ["graduate", "campus"].includes(j.type)) { v += 5; parts.push(["program", 5]); }
    if (x.level === "senior-analyst") { v -= 8; parts.push(["senior-analyst", -8]); }
    if (x.req) {
      if (x.req.minYears != null && x.req.minYears > lim.maxYears && x.req.yearsSoft) { v -= 6; parts.push(["years-pref", -6]); }
      if ((x.req.credsSoft || []).some((c) => limCreds.has(String(c).toUpperCase()))) { v -= 5; parts.push(["cred-pref", -5]); }
    }
    if (j.postedAt && !j.closesAt && Date.now() - new Date(j.postedAt).getTime() > 45 * 86400000) { v -= 5; parts.push(["stale", -5]); }
    v = Math.max(3, Math.min(92, Math.round(v))); // never 0 or 100 — it is an estimate
    const band = v >= 70 ? "A" : v >= 50 ? "B" : v >= 30 ? "C" : "D";
    const why = parts.filter((p) => p[1] !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map((p) => p[0]);
    return { v, band, why: ["tier:" + x.tier, ...why] };
  }
}

/** Heat band ("敏感度"): colour temperature from red (best) down to blue. 0 = hottest. */
export function heatBand(score) {
  if (score >= 90) return 0; // 极高 red
  if (score >= 78) return 1; // 高   orange
  if (score >= 66) return 2; // 中高 amber
  if (score >= 52) return 3; // 中   green
  if (score >= 38) return 4; // 偏低 teal
  return 5;                  // 低   blue
}
