# DreamCatcher — 2027 求职雷达 · v6

DreamCatcher is a zero-dependency scraper and a single-page radar. Every 3 hours GitHub Actions reads the career
sites of 115 firms, keeps full-time postings, and runs each one down the same judgement line:

    region → role family → level and status → seven hard gates → fit → interview odds → priority

Whatever clears the line is listed — there is no daily cap; priority only sets the order. Whatever is stopped
stays searchable with the gate that stopped it. The scan writes `data/jobs.json` (everything the base filter kept)
and `data/radar.json` (what the page shows).

**No AI tokens are used for scanning.** Fetching, filtering, fit, odds and priority are plain rules. Claude is
only called for postings that are new *and* already passed the rule filter, and only if you add an API key.

## v6 — the Compass

**Scope.** Finance and consulting, entry level. Toronto and Hong Kong for every firm; mainland China only for the
Chinese brokers (`config.json → v6.mainland`). Engineering, quant, audit / tax / actuarial, legal and compliance,
branch sales and advisors, operations and support, HR / marketing are never pushed. Big Four and digital-consulting
firms pass when the title is a consulting or advisory role. Quant shops are fetched but paused (`v6.paused`).

**The line** (`scraper/v6.mjs`, no network, no model):

| Step | What it checks |
|---|---|
| Region | the posting's location text against the three regions |
| Role family | eight tracks — investment banking, research & ratings, asset & wealth, buy side, strategy consulting, Big Four & digital, rotational, credit / risk / markets |
| Level & status | new-grad and entry-level full-time pass. One notch above entry — "Senior Analyst", "Sr. Associate", "Senior Consultant", a bare "Associate" at banks / PE / strategy firms — is kept as a **stretch** (够一够): listed, counted separately, always ranked under what fits the level. Managerial grades, interns, co-ops, contracts, events, talent pools and expired postings stop here |
| Hard gates | language, work authorization, licences, group-restricted programmes, duplicates (the same role posted in several cities is merged) |
| Fit | family match, entry-level signals, résumé hits, the base rule score |
| Interview odds | a range, from six résumé signals weighted the way each of eight recruiter types screens (`ARCH` in `v6.mjs`) |
| Priority | fit<sup>0.45</sup> × odds<sup>0.35</sup> × timeliness<sup>0.20</sup>, plus up to 8 points for `profile.companyBoost` firms; 66+ goes into "look at these first" |

Re-derive the radar from the last scan without touching the network: `node scraper/v6.mjs --list`.

**The page** (`index.html`, built from `scraper/tools/dc6/`): the chosen design, Compass「晕」— a fluted silver bezel
with two gold lines, a dark sunburst dial inside a deep-blue ring of light, Klein blue as the main colour. Every
role is a moon: sector = track, distance from the centre = fit, the fuller the moon the higher the priority,
blue-lit moons first. Tonight's real moon phase rides the bezel as the hand and shows how far the 3-hour scan cycle
has run. Dark and light themes, 中文 / EN.

* **Today** — the dial, the roles to look at first, today's filter funnel, the pipeline, examples of what was kept out.
* **Roles** — every qualifying role plus the stretch ones. Filter by **location**, **firm type** and **firm** (chips with
  live counts; a tracked firm with nothing right now stays listed and says why), by track, new-only, with or without
  stretch; group by region, firm or track; sort; bring back dismissed ones. Under any filter, one click lists the
  postings that same filter kept out, each with the gate that stopped it.
* **Pipeline** — what you applied to, by stage; a rejection puts the same firm and track on hold for 12 months.
* **Engine** — how the line works, the recruiter weights, your work-authorization answers, a search over everything
  that was stopped ("which gate stopped it?"), and the health of every source.
* **Keys** — `J` `K` move, `↵` open, `A` applied, `X` not for me, `⌘K` or `/` search and commands, `1`–`4` screens, `T` theme, `Esc` close.

**Where your marks live.** Applied / dismissed / pipeline stage / work authorization / theme / language are kept in
the browser (`localStorage`, the same `dc.*` keys as before — earlier marks carry over) and are never written to
this public repository.

**New in the scan.** A UBS adapter (`brassring` in `scraper/adapters/more.mjs`) and 13 more firms with Toronto
or Hong Kong desks: Bank of America, Deutsche Bank, Mizuho · Greenhill, MUFG, Canaccord Genuity, Desjardins,
Capital One Canada, State Street, Invesco, Fidelity Canada, CI Financial, Intact, Mastercard. Their endpoints were
checked in a browser on 2026-11-17; they stay marked `"probation"` in `config.json` until a few scans from GitHub
Actions confirm them, and the Engine screen shows each one's result. (Tried and left out because their career
sites return nothing for Toronto: Raymond James, Northern Trust, Franklin Templeton, PSP Investments.) All Workday tenants now share one polite lane in `scraper/lib.mjs`
(spaced requests, Retry-After aware back-off) because Workday started answering HTTP 429 to bursts.

**Fixed on 2026-11-22** (found while reading the banks' sites directly in a browser):

* *Workday paging.* Many tenants now send `total` with the first page only; the adapter read that as "done" after two
  pages, so a query never returned more than 40 postings. TD lists about 860 for Toronto, BMO 260, CIBC 140,
  Brookfield 63 — most of it had never been read. The adapter now remembers the first total (`adapters/generic.mjs`).
* *Soft wording read as a requirement.* "Completion of a CPA or CFA is beneficial", "on track to complete … to pursue
  their CPA" were parsed as a required credential and the posting was dropped. Those phrasings are now soft
  (`SOFT` in `lib.mjs`); cached descriptions parsed the old way are fetched again.
* *"Consultant, X" at a bank* is a grade, not consulting: it no longer puts a posting in the consulting track.
* *Blocked list.* Every stopped posting is counted; when there are more than 2,500 the page gets the most telling
  ones first (level, language, credential, status), then "no track", then the out-of-scope families.

**Workday and GitHub's servers (2026-11-23).** The first scan with the fixed adapter showed the real state of things:
every Workday tenant (the Canadian banks, the pension funds, Brookfield, most of the new firms) answers HTTP 429 to
GitHub's runners almost all the time, whatever the pacing. Two things follow:

* *Lanes per host* (`lib.mjs`). Each Workday host is paced and backed off on its own; a host that keeps refusing is
  closed for the run, the others still get their chance. Which tenant answers a shared runner address is largely luck.
* *Browser relay* (`data/relay.json`). Postings read through a real browser — a home connection is not rate-limited —
  are kept in the repository. When the scanner's own read of a Workday firm fails, it keeps that firm's previous
  postings and adds what the relay saw (with the requirements and résumé hits already parsed from the description),
  and drops the ones the relay found closed. A relay older than three weeks is ignored. The Engine screen marks
  these sources "browser read" and says which day the read was made; the firm tallies use the relay's count of
  postings in range. The file is refreshed by reading the sites again in a browser — it does not update itself.

## Sources (115 companies, 7 groups — the 101 below were verified in the live sites, Sep–Oct 2026)

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
| 多伦多本地 · 中型（v5，tier 3 unless noted） | TMX Group · Interac · IMCO · HOOPP · OPTrust · Fiera Capital · Morningstar/DBRS · LSEG · Onex (tier 2) · Houlihan Lokey (tier 2) · ZS Associates (tier 2) · Mercer/NERA/Marsh (tier 2) · 1Password · Float · Loopio · Relay · Clearco · KOHO · Hopper · Faire · Instacart · StackAdapt · D2L · Pine · Ada · League · Shakudo · Wave · PointClickCare · Bell (2027 Graduate Program) · Rogers | Workday · Greenhouse · Ashby · Lever · `jibe` (jobs.zs.com) · `phenom` (jobs.bell.ca) · `successfactors` (jobs.rogers.com) |
| 纽约 / 芝加哥 量化（v5，tier 1） | DRW · IMC · Jump Trading · Optiver · Tower Research · Hudson River Trading · Virtu · Akuna | Greenhouse |
| 中国券商 · 科技 `cn` | 国信证券 · 中信建投 · 中金 · 科大讯飞 | Beisen `https://<tenant>.zhiye.com/api/Jobad/GetJobAdPageList` (校园招聘 + 中金 项目实习; any Beisen tenant works) |

**Checked by hand** (bot-gated or no public API — listed in `config.json → _manual`): 腾讯 · 阿里 · 百度 · 字节 ·
Google · Meta · Siemens · Apple · Bain campus (bain.com/careers) · Bloomberg · Moody's · KKR · Hillhouse / HongShan /
IDG / 深创投.

### Fit fingerprint + résumé hits (new in v4)

Every posting gets five scores (`match.dims`, 0–100): **AI · 金融 · 咨询 · 管理** from the keyword dictionaries in
`config.json → profile.dimensions` (a hit in the title scores 100, in the description 72, in the division / snippet 70;
"weak" words score less), and **应届** — how open the posting is to a new graduate (campus / graduate program 95,
entry-level title 85, "0–2 years" 88, associate or unstated 55, "3+ years preferred" 45; text such as "new grad",
"recent graduate", "class of 2027" lifts it to 90). The page shows them as the five-bar fingerprint on each card and as
the 方向 chips (a posting counts for a direction when that dimension ≥ 60).

`profile.resumeKeywords.items` lists what Caesar can prove from his résumé (估值建模, 投行经验, AI / 大模型, Python / SQL,
中英双语 …); a posting that mentions one shows it as a 命中 tag (`match.hits`). The overall score moves only a little:
best direction ≥ 90 → +6 (≥ 70 → +3), 3+ résumé hits → +4 (1–2 → +2), 应届 ≥ 85 → +3, 应届 ≤ 45 → −6.

### 胜算 — odds of an interview / offer (new in v5)

`match.odds` = `{ v, band, why }`: a rough, public-signals-only estimate of Caesar's chance, shown as the diamond badge on
every card (A 高把握 ≥ 70 · B 有戏 50–69 · C 冲刺 30–49 · D 远冲 < 30), as the 高把握 tile and as the odds chips.
Base comes from the company's competition tier in `config.json` (`tier` 1 elite → 18, 2 strong → 38, 3 mid-size /
local → 52; `profile.odds.tierBase`), then: new-grad friendliness (`(应届 − 50) × 0.4`, −20…+18), best direction ≥ 90
→ +8 (≥ 70 → +4), résumé hits +2.5 each (max +10), Mandarin asked for → +8, city (Toronto +6 · HK/Shenzhen/Beijing
+4 · New York/Chicago −5 · elsewhere −2), graduate program at a tier-2/3 firm +5, senior-analyst title −8, "3+ years
preferred" −6, credential preferred −5, posted > 45 days ago with no deadline −5. Clamped to 3–92 — it is an estimate,
never a certainty. `why` keeps the three biggest factors for the badge text.

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
   Your radar is now at `https://CaesarLu989.github.io/dreamcatcher/` and reads `data/radar.json` from the same place.
3. **Actions tab → "DreamCatcher scan" → Run workflow** once to seed the data. It then runs every 3 hours by itself.
4. *(Optional)* **Settings → Secrets and variables → Actions → New repository secret**:
   name `ANTHROPIC_API_KEY`, value = a key from console.anthropic.com. From the next run on, Claude
   scores new postings (verdict + one-line reason, EN/中文). Cost is a few cents per month with Haiku.

If you'd rather host the page somewhere else (Netlify Drop, a local file): open it as
`index.html?data=https://caesarlu989.github.io/dreamcatcher/data/radar.json` — GitHub Pages allows cross-origin
reads, so the page works from any host.

## Files

```
config.json                 your profile, cities, keyword rules, company list, scoring settings, the `v6` block
scraper/index.mjs           orchestrator (fetch → rules → diff → optional Claude → data/jobs.json → data/radar.json)
scraper/v6.mjs              the v6 judgement line (jobs.json → radar.json); also runs alone, offline
scraper/lib.mjs             fetch/parse helpers shared by adapters, the Workday lane
scraper/match.mjs           base rule filter and score (0–100 → strong / possible / weak)
scraper/score.mjs           Claude scoring for new postings (optional)
scraper/adapters/*.mjs      one file per site; generic.mjs = Greenhouse/Lever/Ashby/Workday, more.mjs = Phenom,
                            SuccessFactors, Jibe, Radancy, Eightfold, Amazon, Avature, BrassRing (+ description fetchers)
data/jobs.json              everything the base filter kept (version 4)
data/radar.json             what the page shows (version 6): roles, blocked (with the gate), funnel, sources
data/relay.json             postings read through a browser for Workday firms that refuse GitHub's servers (see above)
data/details.json           cache of fetched job descriptions → parsed requirements / resolved locations
data/scores.json            memory of Claude scores (so a posting is scored once)
index.html                  the page, one self-contained file (built — edit the sources, not this)
scraper/tools/dc6/          page sources: core.js (mark, moon phases), theme.js, dial.js, i18n.js, views.js, app.js,
                            base.css + app.css, fonts.css (Outfit + DM Mono, OFL), page.html, build.mjs, build_app.py
assets/ + manifest.webmanifest   icons for the hosted page / Chrome "Install as app"
scraper/tools/dc/ + scraper/tools/original_radar.html   the v5 page sources, kept for reference; no longer built
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

`node scraper/tools/dc6/build.mjs` assembles `index.html` from the parts in `scraper/tools/dc6/` (plain scripts
concatenated in one scope, no bundler, no dependencies). `--embed --out FILE` writes one file with the current
`data/radar.json` inside it. The page reads `data/radar.json` next to it, or the URL in `?data=…`, re-checks every
five minutes, and falls back to the embedded copy when offline.

* **Heat** — priority → moon phase: 极高 90+ (full) · 高 78+ · 较高 66+ · 中 52+ · 较低 38+.
* **Bands** — interview odds: 高把握 ≥35 % · 有戏 20–35 % · 冲刺 8–20 % · 远冲 <8 %. They are estimates, not promises.
* **Motion** — the hand makes one turn when the page opens and the moons light up as it passes; the ring of light
  breathes; new roles ripple; closing ones glow. Everything stops under `prefers-reduced-motion`.
* **Settings that change the list** — `config.json → v6` (thresholds, mainland firms, paused firms, `edges` for a
  firm where you have a real connection) and, in the page, the work-authorization answers on the Engine screen.

## Updating a live repo

Upload the changed files to the same paths on GitHub (*Add file → Upload files*, one folder at a time), commit,
then *Actions → DreamCatcher scan → Run workflow* once. Do not upload `data/jobs.json`, `data/details.json` or
`data/scores.json` — the scan owns them. `data/radar.json` is rewritten by every scan.

## Desktop app (macOS)

`python3 scraper/tools/dc6/build_app.py` rebuilds the page, draws the white icon (`assets/icon-*.png`,
`AppIcon.icns`) from the same code the page uses, and writes `dist/DreamCatcher.app` (+ `DreamCatcher.app.zip`).
Inside: a 20-line bash launcher, `DreamCatcher.html` (the page with the data of the build day, so it opens
offline), `AppIcon.icns` and `config.sh`.

* Double-click → the radar opens in a chromeless Chrome window with its own profile (falls back to the default
  browser when Chrome / Edge / Brave / Arc is not installed). The profile is the one earlier versions used, so
  applied and dismissed marks are still there.
* **It stays live** — `config.sh` ships with `DATA_URL="https://caesarlu989.github.io/dreamcatcher/data/radar.json"`:
  the built-in page fetches fresh data at launch and every five minutes. Set `SITE_URL` instead to open the hosted page.
* **Gatekeeper** — the app is unsigned. If macOS refuses to open it: System Settings → Privacy & Security →
  scroll down → *Open Anyway* (once). On older macOS: right-click → Open.
* **Alternative without a bundle** — Chrome ⋮ → *Cast, save and share* → *Install page as app* on the hosted page.

## How "new" works

Every posting has a stable id (`company:externalId`). A posting not present in the previous
`data/jobs.json` gets `firstSeen = now`. The page highlights postings first seen after your last visit
(stored in your browser) and everything from the last 3 days.

If a site fails (network hiccup, bot check), the previous postings for that company are kept and
marked `stale`, and the page shows the last successful sync time — the radar never goes blank.
