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

export function buildMatcher(profile) {
  const P = profile;
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

    // ---- events: informational, never "strong"
    if (isEvent) {
      const t = cityTier ? "event" : "dropped";
      const sc = Math.max(0, Math.min(score, 45));
      return { score: sc, tier: t, heat: heatBand(sc), reasons: ["event", ...reasons], excluded: false, matchedCity };
    }
    if (excluded) return { score: 0, tier: "dropped", reasons, excluded: true, matchedCity };

    score = Math.max(0, Math.min(100, score));
    const tier = score >= 65 ? "strong" : score >= 40 ? "possible" : score >= 20 ? "weak" : "dropped";
    return { score, tier, heat: heatBand(score), reasons, excluded: false, matchedCity };
  };
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
