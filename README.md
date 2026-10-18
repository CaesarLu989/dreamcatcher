# DreamCatcher — 2027 求职雷达 · live feed

DreamCatcher is a zero-dependency scraper + a single-page radar. Every 3 hours GitHub Actions checks the
career sites you care about, keeps **full-time** postings only, scores them with plain rules into a six-band
heat scale (red = best fit → blue), optionally lets Claude judge the *new* ones, and writes `data/jobs.json`
for the page (`index.html`).

**No AI tokens are used for scanning.** Fetching and filtering is plain code. Claude is only
called for postings that are new *and* already passed the rule filter — and only if you add an
API key. Without a key everything still works, just rule-based.

## Sources (62 companies, 7 groups — endpoints verified in the live sites, Sep–Oct 2026)

Every company in `config.json` carries a `group` (the tinted chips above the company chips on the page) and,
where the firm hires everywhere, a `cities` list — only postings in those cities survive (Toronto / New York /
Hong Kong / Shenzhen unless noted; Workday rows that just say "3 Locations" are resolved through the detail call).

| Group | Companies | Adapter / endpoint |
|---|---|---|
| 投行 / 外资行 `ib` | Goldman Sachs · J.P. Morgan · Morgan Stanley (eightfold + tal.net, plus the Workday site) · Citi · Barclays · BNP Paribas | `goldman` GraphQL · Oracle HCM REST · `eightfold` pcsx / Workday CXS · Radancy JSON · `?json=1` |
| 咨询 `consulting` | McKinsey · BCG · Bain & Company · Oliver Wyman · PwC / Strategy& (experienced + campus sites) · Deloitte · EY · KPMG · Accenture · FTI Consulting · Capco | `mckinsey` gateway · `phenom` widgets · `avature` (careers.bain.com) · Workday (mmc / pwc / accenture / fticonsulting) · `successfactors` (Deloitte JSON API, EY classic) · `jibe` (careers.kpmg.ca) · Greenhouse |
| 加拿大五大行 `cabank` (Toronto only) | TD · CIBC (search + campus sites) · RBC · BMO (External + Campus) · Scotiabank | Workday CXS ×4 · `successfactors` (jobs.scotiabank.com) |
| 资管 · 养老金 · PE · 对冲基金 `buyside` | CPP Investments · Ontario Teachers' · OMERS · Brookfield · Manulife · Sun Life · BlackRock · Blackstone (+ campus site) · Carlyle · Warburg Pincus · General Atlantic · Point72 · Jane Street · ICONIQ · Squarepoint · S&P Global | Workday CXS · Greenhouse |
| VC `vc` | a16z · Georgian · Bessemer | Greenhouse · Ashby |
| 科技 · AI · 大厂 `tech` | NVIDIA · Microsoft (Toronto / New York / Hong Kong / Shenzhen searches) · Amazon / AWS · Disney (US, Canada, China, Hong Kong, Shanghai) · Thomson Reuters · Cohere · Wealthsimple · Waabi · Ideogram · Tenstorrent · Stripe · Datadog · Scale AI · Ramp · Coinbase · Anthropic | Workday · `eightfold` (apply.careers.microsoft.com) · `amazon` search.json · `radancy` (disneycareers.com) · Ashby · Lever · Greenhouse |
| 中国券商 · 科技 `cn` | 国信证券 · 中信建投 · 中金 · 科大讯飞 | Beisen `https://<tenant>.zhiye.com/api/Jobad/GetJobAdPageList` (校园招聘 + 中金 项目实习; any Beisen tenant works) |

**Checked by hand** (bot-gated or no public API — listed in `config.json → _manual`): 腾讯 · 阿里 · 百度 · 字节 ·
Google · Meta · Siemens · Apple · Bain campus (bain.com/careers) · Bloomberg · Moody's · KKR · Hillhouse / HongShan /
IDG / 深创投.

### Hard requirements (new in v3)

The engine now reads the posting text and drops what Caesar cannot apply for:

* **years of experience** — "minimum 3 years", "3+ years", "3–5 years' experience", "三年以上…经验" above
  `profile.hardLimits.maxYears` (2) → **dropped** (`counts.droppedHard`). Phrases like "preferred", "an asset",
  "nice to have", "优先" make it soft: kept, −8 points, badge `经验 3+ 年（偏好）`. Upper bounds ("0–2 years",
  "less than 4 years") are fine and show as `经验 ≤2 年`.
* **credentials** — MBA / CPA / CFA / PhD / JD / ACCA / FSA / ASA / FCIA / P.Eng **required** → dropped; "preferred"
  → −4 points, badge `偏好 MBA`.
* Job descriptions are fetched once per posting through each adapter's `fetchDetail` and cached in
  `data/details.json` (kept 45 days after a posting disappears). Per run: postings scoring ≥ `details.minScore` (52)
  plus every "N Locations" row, at most `details.maxPerRun` (300), `details.concurrency` 4 in parallel. The first run
  after an upgrade therefore takes a few minutes longer; later runs only fetch what is new.

## 5-minute setup

1. Create a new **public** GitHub repository (e.g. `dreamcatcher`) and push this folder to it
   (`git init && git add . && git commit -m "job radar" && git branch -M main && git remote add origin … && git push -u origin main`).
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
   Your radar is now at `https://CaesarLu989.github.io/dreamcatcher/` and reads `data/jobs.json` from the same place.
3. **Actions tab → "DreamCatcher scan" → Run workflow** once to seed the data. It then runs every 3 hours by itself.
4. *(Optional)* **Settings → Secrets and variables → Actions → New repository secret**:
   name `ANTHROPIC_API_KEY`, value = a key from console.anthropic.com. From the next run on, Claude
   scores new postings (verdict + one-line reason, EN/中文). Cost is a few cents per month with Haiku.

If you'd rather keep hosting the page on Netlify Drop: set `DATA_URL` inside `index.html` (search for `DATA_URL`) to
`https://raw.githubusercontent.com/CaesarLu989/dreamcatcher/main/data/jobs.json` — raw GitHub URLs allow
cross-origin reads, so the page works from any host.

## Files

```
config.json                 your profile, cities, keyword rules, company list, scoring settings
scraper/index.mjs           orchestrator (fetch → rules → diff → optional Claude → data/jobs.json)
scraper/lib.mjs             fetch/parse helpers shared by adapters
scraper/match.mjs           rule-based scoring (0–100 → strong / possible / weak)
scraper/score.mjs           Claude scoring for new postings (optional)
scraper/adapters/*.mjs      one file per site; generic.mjs = Greenhouse/Lever/Ashby/Workday, more.mjs = Phenom,
                            SuccessFactors, Jibe, Radancy, Eightfold, Amazon, Avature (+ description fetchers)
data/jobs.json              output the page reads (version 3: + groups, companyGroup, match.req)
data/details.json           cache of fetched job descriptions → parsed requirements / resolved locations
data/scores.json            memory of Claude scores (so a posting is scored once)
index.html                  DreamCatcher page = the original 2027 求职雷达 (verbatim copy) + Klein-blue skin + boot + ⚡ live section
scraper/tools/dc/           page sources: theme.css, live.css/html/js, logo.js, boot.js, motion.js, i18n.js + i18n_curated.json, build.py (assembles index.html)
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
  (`https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite`). Add `"group": "tech"` (one of `config.groups`)
  and, for firms that hire everywhere, `"cities": ["Toronto"]` to keep only those cities. The other adapters:
  ```json
  { "key": "bcg", "adapter": "phenom", "base": "https://careers.bcg.com", "path": "global/en", "lang": "en_global", "country": "global", "pageId": "page35-ds", "cities": ["Toronto"] }
  { "key": "ey", "adapter": "successfactors", "base": "https://careers.ey.com", "path": "/ey", "cities": ["Toronto"] }
  { "key": "deloitte", "adapter": "successfactors", "api": true, "base": "https://careers.deloitte.ca", "locale": "en_US", "cities": ["Toronto"] }
  { "key": "kpmg", "adapter": "jibe", "base": "https://careers.kpmg.ca", "cities": ["Toronto"] }
  { "key": "disney", "adapter": "radancy", "base": "https://www.disneycareers.com", "path": "/en", "regions": ["Canada"] }
  { "key": "microsoft", "adapter": "eightfold", "host": "https://apply.careers.microsoft.com", "domain": "microsoft.com", "searches": [{ "query": "", "location": "Toronto, Canada" }] }
  { "key": "bain", "adapter": "avature", "base": "https://careers.bain.com", "cities": ["Toronto"] }
  ```
* **Hard limits** — `config.json → profile.hardLimits`: `maxYears` (2) and the `creds` list that are dropped when
  *required*. `details.minScore / maxPerRun / concurrency` control how many descriptions a run fetches;
  `--no-details` skips the fetch altogether (titles and snippets only).
* **Scoring** — `config.json → scoring`: `model`, `maxPerRun`, which tiers get scored, or `"enabled": false`.
* **Run locally** — `node scraper/index.mjs` (Node 22+). `--only=goldman,bnp` limits to some
  companies, `--no-score` skips Claude, `--no-details` skips description fetches,
  `--fixtures=scraper/tools/fixtures-real` replays saved responses offline.

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
* **中文 / EN** — the switch in the top-right corner flips the whole page (Caesar's curated sections via the
  zh→en table in `scraper/tools/dc/i18n_curated.json`, the live feed via `i18n.js`); the choice is remembered.
* **已投自动收起** — postings you mark as applied leave the main list (the 已投递 tile / 只看已投 shows them);
  untick the box to keep them inline. The app cannot see your applications by itself — marking is manual.
* **Group chips** (v3) — 投行 / 咨询 / 加拿大五大行 / 资管 / VC / 科技 / 中国 filter the company chips and the
  list; the company row shows the 12 busiest firms and a `更多 N 家 ▾` toggle for the rest. Cards carry a
  requirement badge (`经验 ≤2 年`, `经验 3+ 年（偏好）`, `偏好 MBA`) when the posting text states one.

## Updating a live repo

Unzip `dreamcatcher-update-N.zip` and drop its contents on the repository root (GitHub → *Add file → Upload files*,
drag the folders in, *Commit changes*). It carries `config.json`, `index.html`, `scraper/`, `README.md` and the
workflow — **never `data/`**, so the postings and your applied-marks stay untouched. Then *Actions → DreamCatcher
scan → Run workflow* once; the page picks up the new `data/jobs.json` on its next load.

## Desktop app (macOS)

`python3 scraper/tools/dc/build_app.py` builds `dist/DreamCatcher.app` (+ `DreamCatcher.app.zip`): a one-click
launcher with the moon logo as its icon. Inside: `Contents/MacOS/DreamCatcher` (a 20-line bash launcher),
`Contents/Resources/DreamCatcher.html` (the page with the latest captured data embedded, so it works offline),
`AppIcon.icns` (rendered from `scraper/tools/dc/icon.html`) and `config.sh`.

* Double-click → the radar opens in a chromeless Chrome window with its own profile (falls back to the default
  browser when Chrome / Edge / Brave / Arc is not installed).
* **Keep it live** — open `DreamCatcher.app` → right-click → *Show Package Contents* → `Contents/Resources/config.sh`
  and set `SITE_URL="https://CaesarLu989.github.io/dreamcatcher/"` (opens the hosted page) **or**
  `DATA_URL="https://raw.githubusercontent.com/CaesarLu989/dreamcatcher/main/data/jobs.json"` (keeps the built-in
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
