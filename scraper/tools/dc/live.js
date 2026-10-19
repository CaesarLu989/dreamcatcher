/* ===== ⚡ LIVE RADAR — logic ===== */
(function () {
  // ---------- 配置 ----------
  // 页面和数据放在同一个 GitHub 仓库（GitHub Pages）时留空，会读同目录下的 data/jobs.json。
  // 放在别处（Netlify Drop 等）时填 raw 地址，例如：
  //   "https://raw.githubusercontent.com/<你的用户名>/dreamcatcher/main/data/jobs.json"
  var DATA_URL = "";
  try { DATA_URL = new URLSearchParams(location.search).get("data") || DATA_URL; } catch (e) {}   // DreamCatcher.app passes ?data=<raw url>
  var NEW_WINDOW_DAYS = 3;        // "新增" = 上次访问之后首次出现，或最近 N 天内首次出现
  var PAGE = 12;                  // 默认先显示多少条，其余点"展开"
  var DEFAULT_HEAT = [0, 1, 2, 3]; // 默认显示的热度档（偏低 / 低 点色块再打开）

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem("dc." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("dc." + k, JSON.stringify(v)); } catch (e) {} }
  };
  var S = {
    data: null,
    heat: new Set(LS.get("heat", DEFAULT_HEAT)),
    companies: new Set(LS.get("companies", [])),
    groups: new Set(LS.get("groups", [])), moreCompanies: false,
    dirs: new Set(LS.get("dirs", [])),
    odds: new Set(LS.get("odds", ["A", "B", "C", "D"])),
    cities: new Set(LS.get("cities", [])),
    types: new Set(LS.get("types", [])),
    q: "", onlyNew: false, onlyApplied: false, showHidden: false, expanded: false, showEvents: LS.get("events", false), hideApplied: LS.get("hideApplied", true),
    hidden: new Set(LS.get("hidden", [])),
    applied: LS.get("applied", {}),          // id -> ISO date
    lastVisit: LS.get("lastVisit", null),
    counted: false
  };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ago = function (iso) {
    if (!iso) return "—";
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return T("ago.now"); if (m < 60) return m + T("ago.m");
    var h = Math.round(m / 60); if (h < 48) return h + T("ago.h");
    return Math.round(h / 24) + T("ago.d");
  };
  window.dcAgo = ago;
  var isNew = function (j) {
    var seen = new Date(j.firstSeen).getTime();
    var sinceVisit = S.lastVisit ? seen > new Date(S.lastVisit).getTime() : false;
    return sinceVisit || (Date.now() - seen < NEW_WINDOW_DAYS * 86400000);
  };
  var cityOf = function (j) { return (j.match && j.match.matchedCity) || null; };
  var heatOf = function (j) { var h = j.match && j.match.heat; return typeof h === "number" ? h : 5; };
  var T = function (k, v) { return window.dcT ? window.dcT(k, v) : k; };   // i18n.js (中文 / EN)
  var HEAT, TYPE, RZ, OTHER;
  function strings() { HEAT = T("heat"); TYPE = T("type"); RZ = T("reason"); OTHER = T("city.other"); }
  strings();
  function reasonZh(r) { if (RZ[r]) return RZ[r]; if (r.indexOf("domain:") === 0) return T("reason.domain") + r.slice(7); if (r.indexOf("neg:") === 0) return T("reason.neg") + r.slice(4); if (r.indexOf("senior:") === 0) return T("reason.senior") + r.slice(7); if (r.indexOf("years-pref:") === 0) return T("reason.yearspref") + r.slice(11); if (r === "cred-pref") return T("reason.credpref"); if (r.indexOf("fit:") === 0) return T("reason.fit") + T("dim." + r.slice(4)); if (r.indexOf("resume:") === 0) return T("reason.resume", { n: r.slice(7) }); if (r === "not-entry") return T("reason.notentry"); return r; }
  var DIMS = ["ai", "finance", "consulting", "management", "entry"];
  var DIR_MIN = 60;   // a posting counts for a direction chip when that dimension scores at least this
  function fingerprint(m) {
    var dm = m && m.dims; if (!dm) return "";
    return '<div class="fp" aria-label="fit">' + DIMS.map(function (k) { var v = Math.max(0, Math.min(100, Math.round(dm[k] || 0))); return '<span class="fp-i' + (v >= DIR_MIN ? " hi" : "") + '" style="--v:' + v + '" title="' + T("dim." + k) + ' ' + v + '"><i></i><b>' + T("dim." + k) + '</b></span>'; }).join("") + '</div>';
  }
  function hitsRow(m, d) {
    var h = (m && m.hits) || []; if (!h.length) return "";
    var en = window.dcLang && window.dcLang() === "en", tags = (d && d.resumeTags) || {};
    return '<div class="hits"><span class="hits-k">' + T("hits.k") + '</span>' + h.slice(0, 5).map(function (t) { return '<span class="hit">' + esc(en && tags[t] ? tags[t] : t) + '</span>'; }).join("") + (h.length > 5 ? '<span class="hit more">+' + (h.length - 5) + '</span>' : "") + '</div>';
  }
  var daysLeft = function (j) { if (!j.closesAt) return null; return Math.ceil((new Date(j.closesAt).getTime() - Date.now()) / 86400000); };
  var BANDS = ["A", "B", "C", "D"];
  var oddsOf = function (j) { return (j.match && j.match.odds) || null; };
  function oddsWhy(o) { return (o && o.why || []).map(function (w) { if (w.indexOf("hits:") === 0) return T("odds.why.hits", { n: w.slice(5) }); var k = "odds.why." + w; var v = T(k); return v === k ? w : v; }); }
  function oddsBadge(o, full) {
    if (!o) return "";
    return '<span class="odds b' + o.band + '" title="' + esc(T("odds.label") + " " + o.v + " · " + oddsWhy(o).join(" · ")) + '"><i></i>' + T("odds." + o.band) + ' <span class="s">' + o.v + '</span>' + (full ? '<small>' + esc(oddsWhy(o).slice(0, 3).join(" · ")) + '</small>' : "") + '</span>';
  }

  function load() {
    var urls = [DATA_URL, "data/jobs.json"].filter(Boolean), i = 0;
    return new Promise(function (resolve, reject) {
      (function next() {
        if (i >= urls.length) return window.__RADAR_EMBED ? resolve(window.__RADAR_EMBED) : reject(new Error("no data"));
        var u = urls[i++];
        fetch(u + (u.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(resolve, next);
      })();
    });
  }

  // number roll-up on first paint
  function countUp(el, to) {
    if (reduced || S.counted) { el.textContent = to; return; }
    var t0 = performance.now(), dur = 700 + Math.min(500, to * 6);
    (function tick(now) { var p = Math.min(1, (now - t0) / dur); p = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * p); if (p < 1) requestAnimationFrame(tick); })(t0);
  }
  function chip(group, key, label, n, on) { return '<span class="rl-chip ' + (on ? "on" : "") + '" data-group="' + group + '" data-key="' + esc(key) + '">' + esc(label) + '<span class="n">' + n + '</span></span>'; }

  function render() {
    var d = S.data, jobs = d.jobs || [];
    var srcs = Object.keys(d.sources || {}).map(function (k) { return d.sources[k]; });
    var ok = srcs.filter(function (s) { return s.ok; }).length, stale = srcs.length - ok;
    $("rl-status").innerHTML = '<span><i class="rl-dot ' + (stale ? "stale" : "") + '"></i>' + T("status.last") + '<b>' + esc(ago(d.generatedAt)) + '</b></span>' +
      '<span>' + ok + '/' + srcs.length + T("status.sources") + (stale ? T("status.failed", { n: stale }) : '') + '</span>' +
      '<button class="rl-link" id="rl-togglesrc">' + ($("rl-sources").hidden ? T("status.show") : T("status.hide")) + '</button>';
    $("rl-togglesrc").onclick = function () { $("rl-sources").hidden = !$("rl-sources").hidden; render(); };
    $("rl-sources").innerHTML = Object.keys(d.sources || {}).map(function (k) { var s = d.sources[k];
      return '<div><span><i class="rl-dot ' + (s.ok ? "" : "bad") + '"></i>' + esc(s.name || k) + (s.group && (d.groups || {})[s.group] ? ' <small style="opacity:.6">' + esc((T("group." + s.group) === "group." + s.group ? d.groups[s.group] : T("group." + s.group))) + '</small>' : '') + '</span><span>' + (s.ok ? s.count + T("src.count") + esc(ago(s.fetchedAt)) : '<span class="err">' + T("src.failed") + esc(ago(s.failedAt)) + (s.lastOkAt ? T("src.lastok") + esc(ago(s.lastOkAt)) : '') + '</span>') + '</span></div>'; }).join("");

    var visible = jobs.filter(function (j) { return (S.showHidden || !S.hidden.has(j.id)) && (S.showEvents || j.type !== "event"); });
    // heat tiles
    var byHeat = [0, 0, 0, 0, 0, 0]; visible.forEach(function (j) { if (j.type !== "event") byHeat[heatOf(j)]++; });
    var maxHeat = Math.max.apply(null, byHeat) || 1;
    $("rl-heat").innerHTML = HEAT.map(function (h, i) { return '<div class="rl-tile h' + i + (S.heat.has(i) ? "" : " off") + '" data-heat="' + i + '"><b data-n="' + byHeat[i] + '">0</b><small>' + h[0] + ' · ' + h[1] + '</small><span class="bar" style="--w:' + Math.round(100 * byHeat[i] / maxHeat) + '%"></span></div>'; }).join("");
    var newCount = visible.filter(function (j) { return isNew(j) && heatOf(j) <= 2; }).length;
    var appliedCount = jobs.filter(function (j) { return S.applied[j.id]; }).length;
    var eventCount = jobs.filter(function (j) { return j.type === "event" && !S.hidden.has(j.id); }).length;
    var likelyCount = visible.filter(function (j) { var o = oddsOf(j); return j.type !== "event" && o && o.band === "A"; }).length;
    var oddsOnlyA = S.odds.size === 1 && S.odds.has("A");
    $("rl-meta").innerHTML = '<div class="rl-tile new" data-meta="new"' + (S.onlyNew ? "" : ' style="opacity:.85"') + '><b data-n="' + newCount + '">0</b><small>' + T("tile.new") + (S.onlyNew ? T("tile.filtering") : '') + '</small></div>' +
      '<div class="rl-tile applied" data-meta="applied"><b data-n="' + appliedCount + '">0</b><small>' + T("tile.applied") + (S.onlyApplied ? T("tile.filtering") : (appliedCount && S.hideApplied ? T("tile.collapsed") : '')) + '</small></div>' +
      '<div class="rl-tile event' + (S.showEvents ? "" : " off") + '" data-meta="events"><b data-n="' + eventCount + '">0</b><small>' + T("tile.events") + '</small></div>' +
      (likelyCount ? '<div class="rl-tile odds" data-meta="odds"><b data-n="' + likelyCount + '">0</b><small>' + T("odds.tile") + (oddsOnlyA ? T("odds.tile.on") : "") + '</small></div>' : "");
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile b[data-n]"), function (b) { countUp(b, +b.getAttribute("data-n")); });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile[data-heat]"), function (el) { el.onclick = function () { var h = +el.getAttribute("data-heat"); S.heat.has(h) ? S.heat.delete(h) : S.heat.add(h); LS.set("heat", Array.from(S.heat)); render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile[data-meta]"), function (el) { el.onclick = function () { var m = el.getAttribute("data-meta");
      if (m === "new") { S.onlyNew = !S.onlyNew; $("rl-onlynew").checked = S.onlyNew; }
      if (m === "applied") { S.onlyApplied = !S.onlyApplied; $("rl-onlyapplied").checked = S.onlyApplied; }
      if (m === "events") { S.showEvents = !S.showEvents; LS.set("events", S.showEvents); }
      if (m === "odds") { S.odds = (S.odds.size === 1 && S.odds.has("A")) ? new Set(BANDS) : new Set(["A"]); LS.set("odds", Array.from(S.odds)); }
      render(); }; });

    // 今日待投 — new × high fit × closing soon, never applied / hidden; marking applied frees the slot
    var picks = visible.filter(function (j) { if (j.type === "event" || S.applied[j.id] || heatOf(j) > 1) return false; var dl = daysLeft(j); return isNew(j) || (dl != null && dl >= 0 && dl <= 14); })
      .sort(function (a, b) { var da = daysLeft(a), db = daysLeft(b); var sa = da != null && da <= 14 ? da : 99, sb = db != null && db <= 14 ? db : 99; var ra = a.match.score * 0.6 + ((oddsOf(a) || {}).v || 0) * 0.4, rb = b.match.score * 0.6 + ((oddsOf(b) || {}).v || 0) * 0.4; return (sa - sb) || (rb - ra) || ((b.firstSeen || "") > (a.firstSeen || "") ? 1 : -1); }).slice(0, 6);
    $("rl-picks").hidden = !picks.length;
    if (picks.length) {
      var ph = $("rl-picks").querySelector(".rl-picks-head");
      ph.querySelector(".rl-picks-title").textContent = T("picks.title"); ph.querySelector(".rl-picks-sub").textContent = T("picks.sub"); ph.querySelector(".rl-picks-n").textContent = T("picks.n", { n: picks.length });
      $("rl-picks-row").innerHTML = picks.map(function (j, i) { var m = j.match, h = heatOf(j), dl = daysLeft(j);
        var badge = dl != null && dl <= 14 ? '<span class="pk-badge ddl' + (dl <= 3 ? " hot" : "") + '">' + (dl <= 0 ? T("picks.today") : T("picks.closes", { d: dl })) + '</span>' : '<span class="pk-badge new">' + T("picks.new") + '</span>';
        return '<div class="pk h' + h + '" style="--i:' + i + '"><div class="pk-top"><span class="firm">' + esc(j.company) + '</span>' + badge + '</div><h4>' + esc(j.title) + '</h4>' +
          '<div class="pk-meta">' + esc((j.locations || []).slice(0, 2).join(" · ")) + '</div>' + fingerprint(m) +
          '<div class="pk-line"><span class="pk-badges"><span class="heat"><i></i>' + HEAT[h][0] + ' <span class="s">' + m.score + '</span></span>' + oddsBadge(oddsOf(j)) + '</span><span class="pk-btns"><a class="pk-go" href="' + esc(j.url) + '" target="_blank" rel="noopener">' + T("picks.go") + '</a><button class="rl-b" data-apply="' + esc(j.id) + '">' + T("btn.apply") + '</button></span></div></div>'; }).join("");
    }

    // 胜算 chips (A 高把握 / B 有戏 / C 冲刺 / D 远冲) — all on by default, click to narrow
    var byBand = {}; visible.forEach(function (j) { var o = oddsOf(j); if (o && j.type !== "event") byBand[o.band] = (byBand[o.band] || 0) + 1; });
    var allBands = S.odds.size === 0 || S.odds.size >= BANDS.length;
    var oddsHtml = BANDS.filter(function (b) { return byBand[b]; }).map(function (b) { return '<span class="rl-chip b' + b + (!allBands && S.odds.has(b) ? " on" : "") + '" data-group="odds" data-key="' + b + '"><i></i>' + T("odds." + b) + '<span class="n">' + byBand[b] + '</span></span>'; }).join("");
    $("rl-odds").innerHTML = oddsHtml;
    $("rl-odds").style.display = oddsHtml ? "" : "none";
    if ($("rl-odds").nextElementSibling) $("rl-odds").nextElementSibling.style.display = oddsHtml ? "" : "none";

    // direction chips (AI / 金融 / 咨询 / 管理): a posting counts when that dimension ≥ DIR_MIN
    var byDir = {}; visible.forEach(function (j) { var dm = j.match && j.match.dims; if (!dm) return; DIMS.slice(0, 4).forEach(function (k) { if ((dm[k] || 0) >= DIR_MIN) byDir[k] = (byDir[k] || 0) + 1; }); });
    var dirHtml = DIMS.slice(0, 4).filter(function (k) { return byDir[k]; }).map(function (k) { return chip("dirs", k, T("dim." + k), byDir[k], S.dirs.has(k)); }).join("");
    $("rl-dirs").innerHTML = dirHtml;
    $("rl-dirs").style.display = dirHtml ? "" : "none";
    if ($("rl-dirs").nextElementSibling) $("rl-dirs").nextElementSibling.style.display = dirHtml ? "" : "none";

    // chips
    var byCompany = {}, byCity = {}, byType = {};
    visible.forEach(function (j) { byCompany[j.company] = (byCompany[j.company] || 0) + 1; var c = cityOf(j) || OTHER; byCity[c] = (byCity[c] || 0) + 1; byType[j.type] = (byType[j.type] || 0) + 1; });
    // industry groups (config.groups) → company chips (top 12 + 更多)
    var G = d.groups || {}, CG = d.companyGroup || {};
    var byGroup = {}; visible.forEach(function (j) { var g = CG[j.company] || "other"; byGroup[g] = (byGroup[g] || 0) + 1; });
    var groupHtml = Object.keys(G).filter(function (g) { return byGroup[g]; }).map(function (g) { return chip("groups", g, T("group." + g) === "group." + g ? G[g] : T("group." + g), byGroup[g], S.groups.has(g)); }).join("");
    $("rl-groups").innerHTML = groupHtml;
    // older data files (before v3) carry no groups: hide the empty row and its separator
    $("rl-groups").style.display = groupHtml ? "" : "none";
    if ($("rl-groups").nextElementSibling) $("rl-groups").nextElementSibling.style.display = groupHtml ? "" : "none";
    var compNames = Object.keys(byCompany).filter(function (c) { return !S.groups.size || S.groups.has(CG[c] || "other"); }).sort(function (a, b) { return byCompany[b] - byCompany[a]; });
    var CAP = 12, shownComp = S.moreCompanies || compNames.length <= CAP + 2 ? compNames : compNames.filter(function (c, i) { return i < CAP || S.companies.has(c); });
    $("rl-companies").innerHTML = shownComp.map(function (c) { return chip("companies", c, window.dcLang && window.dcLang() === "en" ? c.replace(/^[\u4e00-\u9fff]+ /, "") : c.replace(/ (Guosen Securities|CSC Financial|CICC|iFlytek)$/, ""), byCompany[c], S.companies.has(c)); }).join("") +
      (compNames.length > shownComp.length ? '<span class="rl-chip more" id="rl-morecomp">' + T("chips.more", { n: compNames.length - shownComp.length }) + '</span>' : S.moreCompanies && compNames.length > CAP + 2 ? '<span class="rl-chip more" id="rl-morecomp">' + T("chips.less") + '</span>' : "");
    if ($("rl-morecomp")) $("rl-morecomp").onclick = function () { S.moreCompanies = !S.moreCompanies; render(); };
    var cityOrder = ((d.profileCities && d.profileCities.target) || []).concat((d.profileCities && d.profileCities.secondary) || []).filter(function (c) { return byCity[c]; });
    if (byCity[OTHER]) cityOrder.push(OTHER);
    $("rl-cities").innerHTML = cityOrder.map(function (c) { return chip("cities", c, c, byCity[c], S.cities.has(c)); }).join("");
    $("rl-types").innerHTML = Object.keys(TYPE).filter(function (t) { return byType[t]; }).map(function (t) { return chip("types", t, TYPE[t], byType[t], S.types.has(t)); }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-chip[data-group]"), function (el) { el.onclick = function () { var g = el.getAttribute("data-group"), set = S[g], key = el.getAttribute("data-key");
      if (g === "odds") { // all on → pick just this band; toggling the last one off → back to all
        if (set.size === 0 || set.size >= BANDS.length) set = new Set([key]); else { set.has(key) ? set.delete(key) : set.add(key); if (!set.size) set = new Set(BANDS); }
        S.odds = set;
      } else { set.has(key) ? set.delete(key) : set.add(key); }
      LS.set(g, Array.from(set)); render(); }; });

    // list
    var q = S.q.trim().toLowerCase();
    var rows = visible.filter(function (j) {
      return (j.type === "event" || S.heat.has(heatOf(j))) &&
        (!S.companies.size || S.companies.has(j.company)) &&
        (!S.groups.size || S.groups.has(CG[j.company] || "other")) &&
        (!S.dirs.size || Array.from(S.dirs).some(function (k) { return ((j.match && j.match.dims) || {})[k] >= DIR_MIN; })) &&
        (j.type === "event" || !oddsOf(j) || S.odds.size === 0 || S.odds.size === BANDS.length || S.odds.has(oddsOf(j).band)) &&
        (!S.cities.size || S.cities.has(cityOf(j) || OTHER)) &&
        (!S.types.size || S.types.has(j.type)) &&
        (!S.onlyNew || isNew(j)) &&
        (!S.onlyApplied || S.applied[j.id]) &&
        (S.onlyApplied || !S.hideApplied || !S.applied[j.id]) &&
        (!q || (j.title + " " + j.company + " " + j.location + " " + (j.division || "") + " " + (j.snippet || "")).toLowerCase().indexOf(q) >= 0);
    });
    rows.sort(function (a, b) { return (b.match.score - a.match.score) || ((b.postedAt || b.firstSeen) > (a.postedAt || a.firstSeen) ? 1 : -1); });
    var shown = S.expanded ? rows : rows.slice(0, PAGE);
    $("rl-list").innerHTML = shown.length ? shown.map(card).join("") : '<div class="rl-empty">' + T("list.empty") + '</div>';
    $("rl-more").hidden = rows.length <= PAGE;
    $("rl-morebtn").textContent = S.expanded ? T("more.collapse") : T("more.expand", { n: rows.length });
    $("rl-morebtn").onclick = function () { S.expanded = !S.expanded; render(); };
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live [data-hide]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-hide"); S.hidden.has(id) ? S.hidden.delete(id) : S.hidden.add(id); LS.set("hidden", Array.from(S.hidden)); render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live [data-apply]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-apply"); if (S.applied[id]) delete S.applied[id]; else S.applied[id] = new Date().toISOString().slice(0, 10); LS.set("applied", S.applied); render(); }; });
    var c = d.counts || {};
    $("rl-foot").innerHTML = T("foot", { shown: rows.length, visible: visible.length, fetched: c.fetched != null ? c.fetched : "?", dropped: c.dropped != null ? c.dropped : "?", at: esc((d.generatedAt || "").replace("T", " ").slice(0, 16)) });
    S.counted = true;
  }

  function card(j, i) {
    var m = j.match || { score: 0, reasons: [] }, h = heatOf(j);
    var dismissed = S.hidden.has(j.id), applied = S.applied[j.id];
    var chips = [];
    (j.locations || []).slice(0, 4).forEach(function (l) { chips.push('<span class="chip">' + esc(l) + '</span>'); });
    if ((j.locations || []).length > 4) chips.push('<span class="chip">+' + (j.locations.length - 4) + '</span>');
    chips.push('<span class="chip">' + esc(TYPE[j.type] || j.type) + '</span>');
    var rq = m.req; if (rq && (rq.years || (rq.credsSoft || []).length)) chips.push('<span class="req' + (rq.soft && /\+$/.test(rq.years || "") ? " warn" : "") + '">' + (rq.years ? T("req.years", { y: rq.years }) + (rq.soft ? T("req.soft") : "") : "") + ((rq.credsSoft || []).length ? (rq.years ? " · " : "") + T("req.cred", { c: rq.credsSoft.join("/") }) : "") + '</span>');
    if (j.division) chips.push('<span class="chip">' + esc(j.division) + '</span>');
    var ddl = j.closesAt ? '<div class="ddl' + (new Date(j.closesAt) - Date.now() < 14 * 86400000 ? " hot" : "") + '">' + T("card.closes") + esc(j.closesAt) + '</div>'
      : j.postedAt ? '<div class="ddl">' + T("card.posted") + esc(j.postedAt) + '</div>' : '<div class="ddl">' + T("card.firstseen") + esc((j.firstSeen || "").slice(0, 10)) + '</div>';
    var ai = j.ai;
    var en = window.dcLang && window.dcLang() === "en";
    var fit = ai ? '<p class="fit"><span class="v ' + esc(ai.verdict) + '">' + (T("verdict")[ai.verdict] || ai.verdict) + ' · AI ' + ai.fit + '/10</span>' + esc(en ? ai.reason_en : (ai.reason_zh || ai.reason_en)) + (en ? '' : '<span class="zh">' + esc(ai.reason_en) + '</span>') + '</p>'
      : '<p class="fit">' + (m.reasons || []).map(reasonZh).join(" · ") + '</p>';
    return '<div class="role h' + h + (dismissed ? " dismissed" : "") + (applied ? " applied" : "") + '" style="--i:' + Math.min(i, 14) + '">' +
      '<div class="role-top"><span class="firm">' + esc(j.company) + '</span><span>' + (isNew(j) ? '<span class="pill new">NEW</span> ' : "") + (applied ? '<span class="pill applied">' + T("card.applied") + esc(applied) + '</span> ' : "") + (j.stale ? '<span class="pill stale">' + T("card.stale") + '</span> ' : "") + '<span class="heat"><i></i>' + HEAT[h][0] + ' <span class="s">' + m.score + '</span></span></span></div>' +
      '<h3>' + esc(j.title) + '</h3>' +
      '<div class="meta">' + chips.join("") + '</div>' + fingerprint(m) + (oddsOf(j) ? '<div class="odds-row">' + oddsBadge(oddsOf(j), true) + '</div>' : "") + hitsRow(m, S.data) + ddl + fit +
      '<div class="rl-line"><a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + T("card.link") + '</a><span><span class="rl-bar"><i style="--w:' + Math.max(3, m.score) + '%"></i></span><span class="rl-score">' + m.score + '</span><span class="rl-btns"><button class="rl-b' + (applied ? " on" : "") + '" data-apply="' + esc(j.id) + '">' + (applied ? T("btn.applied") : T("btn.apply")) + '</button><button class="rl-b" data-hide="' + esc(j.id) + '">' + (dismissed ? T("btn.restore") : T("btn.hide")) + '</button></span></span></div>' +
      '</div>';
  }

  $("rl-q").addEventListener("input", function (e) { S.q = e.target.value; render(); });
  $("rl-onlynew").addEventListener("change", function (e) { S.onlyNew = e.target.checked; render(); });
  $("rl-onlyapplied").addEventListener("change", function (e) { S.onlyApplied = e.target.checked; render(); });
  $("rl-showhidden").addEventListener("change", function (e) { S.showHidden = e.target.checked; render(); });
  $("rl-hideapplied").checked = S.hideApplied;
  $("rl-hideapplied").addEventListener("change", function (e) { S.hideApplied = e.target.checked; LS.set("hideApplied", S.hideApplied); render(); });

  load().then(function (d) {
    S.data = d; window.__dcGeneratedAt = d.generatedAt;
    var go = function () { render(); LS.set("lastVisit", new Date().toISOString()); };
    // wait for the boot overlay so the number roll-up is actually seen
    if (window.__dcBootDone) go(); else window.addEventListener("dc:boot-done", go, { once: true });
    window.addEventListener("dc:lang", function () { strings(); S.counted = true; render(); });   // 中文 / EN switch
  }).catch(function (e) {
    $("rl-list").innerHTML = "";
    $("rl-status").innerHTML = '<span><i class="rl-dot bad"></i>' + esc(T("load.error", { msg: e.message })) + '</span>';
  });
})();
