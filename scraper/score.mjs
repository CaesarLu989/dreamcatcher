// Optional Claude scoring — ONLY for jobs that are new (never scored before) and already
// passed the rule filter. Skipped entirely when ANTHROPIC_API_KEY is not set.
import { sleep } from "./lib.mjs";

const API = (globalThis.process?.env?.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages";

export async function scoreJobs(jobs, { profile, model, batchSize = 10, apiKey, log = console.log }) {
  const results = {};
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    try {
      const r = await scoreBatch(batch, { profile, model, apiKey });
      Object.assign(results, r);
      log(`  scored ${Object.keys(r).length}/${batch.length} (batch ${i / batchSize + 1})`);
    } catch (e) {
      log(`  scoring batch failed: ${e.message}`);
    }
    if (i + batchSize < jobs.length) await sleep(500);
  }
  return results;
}

async function scoreBatch(batch, { profile, model, apiKey }) {
  const lines = batch.map((j) =>
    JSON.stringify({
      id: j.id,
      company: j.company,
      title: j.title,
      location: j.location,
      type: j.type,
      snippet: j.snippet || undefined,
      requirements: j.requirements || undefined,
      rule_reasons: j.match?.reasons,
    })
  );
  const system = `You are a career advisor screening job postings for one specific candidate. Be realistic and concise. Judge fit on: level (entry-level only — the candidate has internships but no full-time experience), location preference, business area, and 2027 timing. Respond with JSON only.`;
  const user = `CANDIDATE PROFILE:\n${profile}\n\nJOBS (one JSON object per line):\n${lines.join("\n")}\n\nFor EACH job return an object: {"id": <id>, "fit": <1-10 integer>, "verdict": "apply" | "consider" | "skip", "reason_en": <max 18 words>, "reason_zh": <max 30 Chinese characters>}.\nReturn a JSON array and nothing else.`;

  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const content = (data.content || []).map((c) => c.text || "").join("");
  const arr = extractJsonArray(content);
  const now = new Date().toISOString();
  const out = {};
  for (const r of arr) {
    if (!r || !r.id) continue;
    out[r.id] = {
      fit: Math.max(1, Math.min(10, Number(r.fit) || 0)),
      verdict: ["apply", "consider", "skip"].includes(r.verdict) ? r.verdict : "consider",
      reason_en: String(r.reason_en || "").slice(0, 200),
      reason_zh: String(r.reason_zh || "").slice(0, 120),
      model,
      scoredAt: now,
    };
  }
  return out;
}

function extractJsonArray(s) {
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start < 0 || end < 0) throw new Error("no JSON array in model output");
  return JSON.parse(s.slice(start, end + 1));
}
