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
  function reasonZh(r) { if (RZ[r]) return RZ[r]; if (r.indexOf("domain:") === 0) return T("reason.domain") + r.slice(7); if (r.indexOf("neg:") === 0) return T("reason.neg") + r.slice(4); if (r.indexOf("senior:") === 0) return T("reason.senior") + r.slice(7); return r; }

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
      return '<div><span><i class="rl-dot ' + (s.ok ? "" : "bad") + '"></i>' + esc(s.name || k) + '</span><span>' + (s.ok ? s.count + T("src.count") + esc(ago(s.fetchedAt)) : '<span class="err">' + T("src.failed") + esc(ago(s.failedAt)) + (s.lastOkAt ? T("src.lastok") + esc(ago(s.lastOkAt)) : '') + '</span>') + '</span></div>'; }).join("");

    var visible = jobs.filter(function (j) { return (S.showHidden || !S.hidden.has(j.id)) && (S.showEvents || j.type !== "event"); });
    // heat tiles
    var byHeat = [0, 0, 0, 0, 0, 0]; visible.forEach(function (j) { if (j.type !== "event") byHeat[heatOf(j)]++; });
    var maxHeat = Math.max.apply(null, byHeat) || 1;
    $("rl-heat").innerHTML = HEAT.map(function (h, i) { return '<div class="rl-tile h' + i + (S.heat.has(i) ? "" : " off") + '" data-heat="' + i + '"><b data-n="' + byHeat[i] + '">0</b><small>' + h[0] + ' · ' + h[1] + '</small><span class="bar" style="--w:' + Math.round(100 * byHeat[i] / maxHeat) + '%"></span></div>'; }).join("");
    var newCount = visible.filter(function (j) { return isNew(j) && heatOf(j) <= 2; }).length;
    var appliedCount = jobs.filter(function (j) { return S.applied[j.id]; }).length;
    var eventCount = jobs.filter(function (j) { return j.type === "event" && !S.hidden.has(j.id); }).length;
    $("rl-meta").innerHTML = '<div class="rl-tile new" data-meta="new"' + (S.onlyNew ? "" : ' style="opacity:.85"') + '><b data-n="' + newCount + '">0</b><small>' + T("tile.new") + (S.onlyNew ? T("tile.filtering") : '') + '</small></div>' +
      '<div class="rl-tile applied" data-meta="applied"><b data-n="' + appliedCount + '">0</b><small>' + T("tile.applied") + (S.onlyApplied ? T("tile.filtering") : (appliedCount && S.hideApplied ? T("tile.collapsed") : '')) + '</small></div>' +
      '<div class="rl-tile event' + (S.showEvents ? "" : " off") + '" data-meta="events"><b data-n="' + eventCount + '">0</b><small>' + T("tile.events") + '</small></div>';
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile b[data-n]"), function (b) { countUp(b, +b.getAttribute("data-n")); });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile[data-heat]"), function (el) { el.onclick = function () { var h = +el.getAttribute("data-heat"); S.heat.has(h) ? S.heat.delete(h) : S.heat.add(h); LS.set("heat", Array.from(S.heat)); render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile[data-meta]"), function (el) { el.onclick = function () { var m = el.getAttribute("data-meta");
      if (m === "new") { S.onlyNew = !S.onlyNew; $("rl-onlynew").checked = S.onlyNew; }
      if (m === "applied") { S.onlyApplied = !S.onlyApplied; $("rl-onlyapplied").checked = S.onlyApplied; }
      if (m === "events") { S.showEvents = !S.showEvents; LS.set("events", S.showEvents); }
      render(); }; });

    // chips
    var byCompany = {}, byCity = {}, byType = {};
    visible.forEach(function (j) { byCompany[j.company] = (byCompany[j.company] || 0) + 1; var c = cityOf(j) || OTHER; byCity[c] = (byCity[c] || 0) + 1; byType[j.type] = (byType[j.type] || 0) + 1; });
    $("rl-companies").innerHTML = Object.keys(byCompany).sort(function (a, b) { return byCompany[b] - byCompany[a]; }).map(function (c) { return chip("companies", c, window.dcLang && window.dcLang() === "en" ? c.replace(/^[\u4e00-\u9fff]+ /, "") : c.replace(/ (Guosen Securities|CSC Financial|CICC|iFlytek)$/, ""), byCompany[c], S.companies.has(c)); }).join("");
    var cityOrder = ((d.profileCities && d.profileCities.target) || []).concat((d.profileCities && d.profileCities.secondary) || []).filter(function (c) { return byCity[c]; });
    if (byCity[OTHER]) cityOrder.push(OTHER);
    $("rl-cities").innerHTML = cityOrder.map(function (c) { return chip("cities", c, c, byCity[c], S.cities.has(c)); }).join("");
    $("rl-types").innerHTML = Object.keys(TYPE).filter(function (t) { return byType[t]; }).map(function (t) { return chip("types", t, TYPE[t], byType[t], S.types.has(t)); }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-chip"), function (el) { el.onclick = function () { var set = S[el.getAttribute("data-group")], key = el.getAttribute("data-key"); set.has(key) ? set.delete(key) : set.add(key); LS.set(el.getAttribute("data-group"), Array.from(set)); render(); }; });

    // list
    var q = S.q.trim().toLowerCase();
    var rows = visible.filter(function (j) {
      return (j.type === "event" || S.heat.has(heatOf(j))) &&
        (!S.companies.size || S.companies.has(j.company)) &&
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
      '<div class="meta">' + chips.join("") + '</div>' + ddl + fit +
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
