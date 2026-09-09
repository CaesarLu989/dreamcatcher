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
    if (m < 1) return "刚刚"; if (m < 60) return m + " 分钟前";
    var h = Math.round(m / 60); if (h < 48) return h + " 小时前";
    return Math.round(h / 24) + " 天前";
  };
  var isNew = function (j) {
    var seen = new Date(j.firstSeen).getTime();
    var sinceVisit = S.lastVisit ? seen > new Date(S.lastVisit).getTime() : false;
    return sinceVisit || (Date.now() - seen < NEW_WINDOW_DAYS * 86400000);
  };
  var cityOf = function (j) { return (j.match && j.match.matchedCity) || null; };
  var heatOf = function (j) { var h = j.match && j.match.heat; return typeof h === "number" ? h : 5; };
  var HEAT = [["极高", "值得立刻投"], ["高", "优先投"], ["中高", "核实后投"], ["中", "看情况"], ["偏低", "备用"], ["低", "参考"]];
  var TYPE = { graduate: "全职 / 毕业生项目", campus: "校招", experienced: "社招 · 入门级", event: "活动", unknown: "其他" };
  var RZ = { "program": "校招项目", "entry-level": "入门级", "senior": "资深岗", "senior-analyst": "资深分析师", "mba-track": "MBA 通道", "associate": "Associate 级", "level-unknown": "级别未标", "old-cycle": "往届", "location-open": "地点不限", "other-city": "非目标城市", "event": "活动", "excluded-term": "排除词", "priority-firm": "优先公司" };
  function reasonZh(r) { if (RZ[r]) return RZ[r]; if (r.indexOf("domain:") === 0) return "方向 " + r.slice(7); if (r.indexOf("neg:") === 0) return "扣分 " + r.slice(4); return r; }

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
    $("rl-status").innerHTML = '<span><i class="rl-dot ' + (stale ? "stale" : "") + '"></i>上次抓取 <b>' + esc(ago(d.generatedAt)) + '</b></span>' +
      '<span>' + ok + '/' + srcs.length + ' 个来源正常' + (stale ? '（' + stale + ' 个失败，沿用上次数据）' : '') + '</span>' +
      '<button class="rl-link" id="rl-togglesrc">' + ($("rl-sources").hidden ? "查看来源" : "收起来源") + '</button>';
    $("rl-togglesrc").onclick = function () { $("rl-sources").hidden = !$("rl-sources").hidden; render(); };
    $("rl-sources").innerHTML = Object.keys(d.sources || {}).map(function (k) { var s = d.sources[k];
      return '<div><span><i class="rl-dot ' + (s.ok ? "" : "bad") + '"></i>' + esc(s.name || k) + '</span><span>' + (s.ok ? s.count + ' 条 · ' + esc(ago(s.fetchedAt)) : '<span class="err">失败 ' + esc(ago(s.failedAt)) + (s.lastOkAt ? ' · 上次成功 ' + esc(ago(s.lastOkAt)) : '') + '</span>') + '</span></div>'; }).join("");

    var visible = jobs.filter(function (j) { return (S.showHidden || !S.hidden.has(j.id)) && (S.showEvents || j.type !== "event"); });
    // heat tiles
    var byHeat = [0, 0, 0, 0, 0, 0]; visible.forEach(function (j) { if (j.type !== "event") byHeat[heatOf(j)]++; });
    var maxHeat = Math.max.apply(null, byHeat) || 1;
    $("rl-heat").innerHTML = HEAT.map(function (h, i) { return '<div class="rl-tile h' + i + (S.heat.has(i) ? "" : " off") + '" data-heat="' + i + '"><b data-n="' + byHeat[i] + '">0</b><small>' + h[0] + ' · ' + h[1] + '</small><span class="bar" style="--w:' + Math.round(100 * byHeat[i] / maxHeat) + '%"></span></div>'; }).join("");
    var newCount = visible.filter(function (j) { return isNew(j) && heatOf(j) <= 2; }).length;
    var appliedCount = jobs.filter(function (j) { return S.applied[j.id]; }).length;
    var eventCount = jobs.filter(function (j) { return j.type === "event" && !S.hidden.has(j.id); }).length;
    $("rl-meta").innerHTML = '<div class="rl-tile new" data-meta="new"' + (S.onlyNew ? "" : ' style="opacity:.85"') + '><b data-n="' + newCount + '">0</b><small>新增（极高–中高）' + (S.onlyNew ? ' · 筛选中' : '') + '</small></div>' +
      '<div class="rl-tile applied" data-meta="applied"><b data-n="' + appliedCount + '">0</b><small>已投递' + (S.onlyApplied ? ' · 筛选中' : (appliedCount && S.hideApplied ? ' · 已收起，点击查看' : '')) + '</small></div>' +
      '<div class="rl-tile event' + (S.showEvents ? "" : " off") + '" data-meta="events"><b data-n="' + eventCount + '">0</b><small>校园活动 · 案例赛</small></div>';
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile b[data-n]"), function (b) { countUp(b, +b.getAttribute("data-n")); });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile[data-heat]"), function (el) { el.onclick = function () { var h = +el.getAttribute("data-heat"); S.heat.has(h) ? S.heat.delete(h) : S.heat.add(h); LS.set("heat", Array.from(S.heat)); render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-tile[data-meta]"), function (el) { el.onclick = function () { var m = el.getAttribute("data-meta");
      if (m === "new") { S.onlyNew = !S.onlyNew; $("rl-onlynew").checked = S.onlyNew; }
      if (m === "applied") { S.onlyApplied = !S.onlyApplied; $("rl-onlyapplied").checked = S.onlyApplied; }
      if (m === "events") { S.showEvents = !S.showEvents; LS.set("events", S.showEvents); }
      render(); }; });

    // chips
    var byCompany = {}, byCity = {}, byType = {};
    visible.forEach(function (j) { byCompany[j.company] = (byCompany[j.company] || 0) + 1; var c = cityOf(j) || "其他"; byCity[c] = (byCity[c] || 0) + 1; byType[j.type] = (byType[j.type] || 0) + 1; });
    $("rl-companies").innerHTML = Object.keys(byCompany).sort(function (a, b) { return byCompany[b] - byCompany[a]; }).map(function (c) { return chip("companies", c, c.replace(/ (Guosen Securities|CSC Financial|CICC|iFlytek)$/, ""), byCompany[c], S.companies.has(c)); }).join("");
    var cityOrder = ((d.profileCities && d.profileCities.target) || []).concat((d.profileCities && d.profileCities.secondary) || []).filter(function (c) { return byCity[c]; });
    if (byCity["其他"]) cityOrder.push("其他");
    $("rl-cities").innerHTML = cityOrder.map(function (c) { return chip("cities", c, c, byCity[c], S.cities.has(c)); }).join("");
    $("rl-types").innerHTML = Object.keys(TYPE).filter(function (t) { return byType[t]; }).map(function (t) { return chip("types", t, TYPE[t], byType[t], S.types.has(t)); }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live .rl-chip"), function (el) { el.onclick = function () { var set = S[el.getAttribute("data-group")], key = el.getAttribute("data-key"); set.has(key) ? set.delete(key) : set.add(key); LS.set(el.getAttribute("data-group"), Array.from(set)); render(); }; });

    // list
    var q = S.q.trim().toLowerCase();
    var rows = visible.filter(function (j) {
      return (j.type === "event" || S.heat.has(heatOf(j))) &&
        (!S.companies.size || S.companies.has(j.company)) &&
        (!S.cities.size || S.cities.has(cityOf(j) || "其他")) &&
        (!S.types.size || S.types.has(j.type)) &&
        (!S.onlyNew || isNew(j)) &&
        (!S.onlyApplied || S.applied[j.id]) &&
        (S.onlyApplied || !S.hideApplied || !S.applied[j.id]) &&
        (!q || (j.title + " " + j.company + " " + j.location + " " + (j.division || "") + " " + (j.snippet || "")).toLowerCase().indexOf(q) >= 0);
    });
    rows.sort(function (a, b) { return (b.match.score - a.match.score) || ((b.postedAt || b.firstSeen) > (a.postedAt || a.firstSeen) ? 1 : -1); });
    var shown = S.expanded ? rows : rows.slice(0, PAGE);
    $("rl-list").innerHTML = shown.length ? shown.map(card).join("") : '<div class="rl-empty">没有符合筛选条件的岗位。</div>';
    $("rl-more").hidden = rows.length <= PAGE;
    $("rl-morebtn").textContent = S.expanded ? "收起" : "展开全部 " + rows.length + " 条";
    $("rl-morebtn").onclick = function () { S.expanded = !S.expanded; render(); };
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live [data-hide]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-hide"); S.hidden.has(id) ? S.hidden.delete(id) : S.hidden.add(id); LS.set("hidden", Array.from(S.hidden)); render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll("#radar-live [data-apply]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-apply"); if (S.applied[id]) delete S.applied[id]; else S.applied[id] = new Date().toISOString().slice(0, 10); LS.set("applied", S.applied); render(); }; });
    var c = d.counts || {};
    $("rl-foot").innerHTML = '本次显示 ' + rows.length + ' / ' + visible.length + ' 条（官网共抓到 ' + (c.fetched != null ? c.fetched : "?") + ' 条，规则剔除 ' + (c.dropped != null ? c.dropped : "?") + ' 条，其中实习类已全部过滤）。分数 = 级别 + 届别 + 城市 + 方向 + 优先公司；AI 评语只对新岗位生成。数据生成于 ' + esc((d.generatedAt || "").replace("T", " ").slice(0, 16)) + ' UTC。';
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
    var ddl = j.closesAt ? '<div class="ddl' + (new Date(j.closesAt) - Date.now() < 14 * 86400000 ? " hot" : "") + '">截止 ' + esc(j.closesAt) + '</div>'
      : j.postedAt ? '<div class="ddl">发布 ' + esc(j.postedAt) + '</div>' : '<div class="ddl">首次出现 ' + esc((j.firstSeen || "").slice(0, 10)) + '</div>';
    var ai = j.ai;
    var fit = ai ? '<p class="fit"><span class="v ' + esc(ai.verdict) + '">' + ({ apply: "建议投", consider: "可考虑", skip: "可跳过" }[ai.verdict] || ai.verdict) + ' · AI ' + ai.fit + '/10</span>' + esc(ai.reason_en) + '<span class="zh">' + esc(ai.reason_zh) + '</span></p>'
      : '<p class="fit">' + (m.reasons || []).map(reasonZh).join(" · ") + '</p>';
    return '<div class="role h' + h + (dismissed ? " dismissed" : "") + (applied ? " applied" : "") + '" style="--i:' + Math.min(i, 14) + '">' +
      '<div class="role-top"><span class="firm">' + esc(j.company) + '</span><span>' + (isNew(j) ? '<span class="pill new">NEW</span> ' : "") + (applied ? '<span class="pill applied">✓ 已投 ' + esc(applied) + '</span> ' : "") + (j.stale ? '<span class="pill stale">上次数据</span> ' : "") + '<span class="heat"><i></i>' + HEAT[h][0] + ' <span class="s">' + m.score + '</span></span></span></div>' +
      '<h3>' + esc(j.title) + '</h3>' +
      '<div class="meta">' + chips.join("") + '</div>' + ddl + fit +
      '<div class="rl-line"><a href="' + esc(j.url) + '" target="_blank" rel="noopener">官网职位页 →</a><span><span class="rl-bar"><i style="--w:' + Math.max(3, m.score) + '%"></i></span><span class="rl-score">' + m.score + '</span><span class="rl-btns"><button class="rl-b' + (applied ? " on" : "") + '" data-apply="' + esc(j.id) + '">' + (applied ? "已投 ✓" : "标记已投") + '</button><button class="rl-b" data-hide="' + esc(j.id) + '">' + (dismissed ? "恢复" : "忽略") + '</button></span></span></div>' +
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
  }).catch(function (e) {
    $("rl-list").innerHTML = "";
    $("rl-status").innerHTML = '<span><i class="rl-dot bad"></i>暂无数据（' + esc(e.message) + '）。先在 GitHub 上手动跑一次 "DreamCatcher scan"，或在本文件顶部填好 DATA_URL。</span>';
  });
})();
