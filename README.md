# DreamCatcher — 2027 求职雷达 · live feed

DreamCatcher is a zero-dependency scraper + a single-page radar. Every 3 hours GitHub Actions checks the
career sites you care about, keeps **full-time** postings only, scores them with plain rules into a six-band
heat scale (red = best fit → blue), optionally lets Claude judge the *new* ones, and writes `data/jobs.json`
for the page (`index.html`).

**No AI tokens are used for scanning.** Fetching and filtering is plain code. Claude is only
called for postings that are new *and* already passed the rule filter — and only if you add an
API key. Without a key everything still works, just rule-based.

## Sources (all verified against the live sites, Sep 2026)

| Company | Endpoint the script calls | Notes |
|---|---|---|
| Goldman Sachs | `api-higher.gs.com` GraphQL (same API the higher.gs.com search uses) | campus + professional roles, page size 50 |
| J.P. Morgan | Oracle HCM REST (`jpmc.fa.oraclecloud.com/hcmRestApi/...`) | keyword searches: 2027, Analyst Program, Hong Kong, Toronto… |
| Morgan Stanley | `morganstanley.eightfold.ai/api/pcsx/search` + `morganstanley.tal.net` campus board | tal.net sometimes shows a human check → falls back to eightfold only |
| McKinsey | `gateway.mckinsey.com/.../jobs/search` | all ~600 postings, page size 100 |
| Barclays | `search.jobs.barclays/search-jobs/results` (Radancy JSON) | keywords: graduate, 2027, analyst, internship |
| BNP Paribas | `group.bnpparibas/en/careers/all-job-offers?json=1` | Graduate Programme filter + city searches |
| 国信证券 / 中信建投 / 中金 / 科大讯飞 | Beisen `https://<tenant>.zhiye.com/api/Jobad/GetJobAdPageList` | 校园招聘 (+ 中金 项目实习); any other Beisen tenant works too |
| NVIDIA | Workday CXS (`nvidia.wd5.myworkdayjobs.com/wday/cxs/...`) | generic `workday` adapter, a few search terms |
| AI / tech companies | generic adapters: Greenhouse, Lever, Ashby, Workday | add companies in `config.json` |

## 5-minute setup

1. Create a new **public** GitHub repository (e.g. `dreamcatcher`) and push this folder to it
   (`git init && git add . && git commit -m "job radar" && git branch -M main && git remote add origin … && git push -u origin main`).
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
   Your radar is now at `https://<you>.github.io/dreamcatcher/` and reads `data/jobs.json` from the same place.
3. **Actions tab → "DreamCatcher scan" → Run workflow** once to seed the data. It then runs every 3 hours by itself.
4. *(Optional)* **Settings → Secrets and variables → Actions → New repository secret**:
   name `ANTHROPIC_API_KEY`, value = a key from console.anthropic.com. From the next run on, Claude
   scores new postings (verdict + one-line reason, EN/中文). Cost is a few cents per month with Haiku.

If you'd rather keep hosting the page on Netlify Drop: set `DATA_URL` inside `index.html` (search for `DATA_URL`) to
`https://raw.githubusercontent.com/<you>/dreamcatcher/main/data/jobs.json` — raw GitHub URLs allow
cross-origin reads, so the page works from any host.

## Files

```
config.json                 your profile, cities, keyword rules, company list, scoring settings
scraper/index.mjs           orchestrator (fetch → rules → diff → optional Claude → data/jobs.json)
scraper/lib.mjs             fetch/parse helpers shared by adapters
scraper/match.mjs           rule-based scoring (0–100 → strong / possible / weak)
scraper/score.mjs           Claude scoring for new postings (optional)
scraper/adapters/*.mjs      one file per site (+ generic.mjs for Greenhouse/Lever/Ashby/Workday)
data/jobs.json              output the page reads
data/scores.json            memory of Claude scores (so a posting is scored once)
index.html                  DreamCatcher page = the original 2027 求职雷达 (verbatim copy) + Klein-blue skin + boot + ⚡ live section
scraper/tools/dc/           page sources: theme.css, live.css/html/js, logo.js, boot.js, motion.js, build.py (assembles index.html)
scraper/tools/dc/build_app.py + icon.html   DreamCatcher.app builder (icon → .icns, launcher, bundle, zip)
assets/ + manifest.webmanifest   icons for the hosted page / Chrome "Install as app"
scraper/tools/original_radar.html   the curated content, untouched
.github/workflows/radar.yml the schedule
```

## Tuning

* **Cities / keywords / exclusions** — edit `config.json → profile`. Plain strings are matched
  case-insensitively; entries containing `\b` are treated as regex.
* **Add a company** — append to `config.json → companies`:
  ```json
  { "key": "nvidia", "name": "NVIDIA", "adapter": "workday", "tenant": "nvidia", "wd": "wd5",
    "site": "NVIDIAExternalCareerSite", "queries": ["new college grad", "analyst"], "enabled": true }
  { "key": "openai", "name": "OpenAI", "adapter": "greenhouse", "board": "openai", "enabled": true }
  { "key": "palantir", "name": "Palantir", "adapter": "lever", "site": "palantir", "enabled": true }
  ```
  For Workday sites the tenant / wd number / site name are in the careers URL
  (`https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite`).
* **Scoring** — `config.json → scoring`: `model`, `maxPerRun`, which tiers get scored, or `"enabled": false`.
* **Run locally** — `node scraper/index.mjs` (Node 22+). `--only=goldman,bnp` limits to some
  companies, `--no-score` skips Claude.

## The page

`python3 scraper/tools/dc/build.py` assembles `index.html` from `scraper/tools/original_radar.html` (the
curated content — edit it there) and the DreamCatcher layer in `scraper/tools/dc/`. `--embed` also writes
`DreamCatcher_PREVIEW.html` with the current `data/jobs.json` inlined.

* **Heat scale** — rule score → band: 极高 90+ (red) · 高 78–89 (orange) · 中高 66–77 (amber) · 中 52–65
  (green) · 偏低 38–51 (teal) · 低 <38 (blue). Score = level (校招项目 35 / 入门级 28) + 2027 (20) + city
  (`cityWeights`) + business area (title 15 / division 8 / adjacent 4) + priority firm (`companyBoost`) −
  negatives (35). Tune all of it in `config.json → profile`.
* **Full-time only** — `profile.excludeTypes: ["internship"]` drops summer / off-cycle / placement / 实习 postings.
* **标记已投 / 忽略** — stored in the browser (localStorage); "已投" tile filters to what you applied for.
* **Boot animation** — full sequence (≈8.5 s: sky fades up, meteors, a spark traces the hoop, the web is
  woven, the moon rises with halo ripples, stars, feathers, fireflies, wordmark, then the logo flies into the
  header) once per day, a 2-second version afterwards; `跳过` skips; clicking the header logo replays it;
  honours `prefers-reduced-motion`.
* **已投自动收起** — postings you mark as applied leave the main list (the 已投递 tile / 只看已投 shows them);
  untick the box to keep them inline. The app cannot see your applications by itself — marking is manual.

## Desktop app (macOS)

`python3 scraper/tools/dc/build_app.py` builds `dist/DreamCatcher.app` (+ `DreamCatcher.app.zip`): a one-click
launcher with the moon logo as its icon. Inside: `Contents/MacOS/DreamCatcher` (a 20-line bash launcher),
`Contents/Resources/DreamCatcher.html` (the page with the latest captured data embedded, so it works offline),
`AppIcon.icns` (rendered from `scraper/tools/dc/icon.html`) and `config.sh`.

* Double-click → the radar opens in a chromeless Chrome window with its own profile (falls back to the default
  browser when Chrome / Edge / Brave / Arc is not installed).
* **Keep it live** — open `DreamCatcher.app` → right-click → *Show Package Contents* → `Contents/Resources/config.sh`
  and set `SITE_URL="https://<you>.github.io/dreamcatcher/"` (opens the hosted page) **or**
  `DATA_URL="https://raw.githubusercontent.com/<you>/dreamcatcher/main/data/jobs.json"` (keeps the built-in
  page, fetches fresh data every launch). Or rebuild: `build_app.py --site-url … --data-url …`.
* **Gatekeeper** — the app is unsigned. If macOS refuses to open it: System Settings → Privacy & Security →
  scroll down → *Open Anyway* (once). On older macOS: right-click → Open.
* **Alternative without a bundle** — once the site is on GitHub Pages, Chrome ⋮ → *Cast, save and share* →
  *Install page as app*. `manifest.webmanifest` + `assets/icon-*.png` give that install the same icon.

## How "new" works

Every posting has a stable id (`company:externalId`). A posting not present in the previous
`data/jobs.json` gets `firstSeen = now`. The page highlights postings first seen after your last visit
(stored in your browser) and everything from the last 3 days.

If a site fails (network hiccup, bot check), the previous postings for that company are kept and
marked `stale`, and the page shows the last successful sync time — the radar never goes blank.
