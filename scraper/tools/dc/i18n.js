/* ===== DreamCatcher language switch (中文 / EN) =====
   Static text (Caesar's curated sections, header, live-section labels) is swapped node-by-node from the
   zh→en table that build.py embeds as window.__DC_CURATED_EN; the live feed re-renders itself through
   dcT() (strings table below). The choice is kept in localStorage (dc.lang); "dc:lang" fires on change. */
(function () {
  var MAP = window.__DC_CURATED_EN || {};
  var lang = "zh";
  try { lang = localStorage.getItem("dc.lang") === "en" ? "en" : "zh"; } catch (e) {}

  // ---- strings the live feed / boot use (zh, en)
  var STR = {
    "boot.tagline": ["梦捕手 · 2027 求职雷达", "Dream Catcher · 2027 Job Radar"],
    "ago.now": ["刚刚", "just now"], "ago.m": [" 分钟前", " min ago"], "ago.h": [" 小时前", " h ago"], "ago.d": [" 天前", " d ago"],
    "heat": [[["极高", "值得立刻投"], ["高", "优先投"], ["中高", "核实后投"], ["中", "看情况"], ["偏低", "备用"], ["低", "参考"]],
             [["Top", "apply now"], ["High", "apply first"], ["Mid-high", "verify first"], ["Mid", "depends"], ["Lowish", "backup"], ["Low", "reference"]]],
    "type": [{ graduate: "全职 / 毕业生项目", campus: "校招", experienced: "社招 · 入门级", event: "活动", unknown: "其他" },
             { graduate: "Full-time / graduate program", campus: "Campus", experienced: "Experienced · entry level", event: "Event", unknown: "Other" }],
    "reason": [{ "program": "校招项目", "entry-level": "入门级", "senior": "资深岗", "senior-analyst": "资深分析师", "mba-track": "MBA 通道", "associate": "Associate 级", "level-unknown": "级别未标", "old-cycle": "往届", "location-open": "地点不限", "other-city": "非目标城市", "event": "活动", "excluded-term": "排除词", "priority-firm": "优先公司" },
               { "program": "campus program", "entry-level": "entry level", "senior": "senior", "senior-analyst": "senior analyst", "mba-track": "MBA track", "associate": "associate level", "level-unknown": "level not stated", "old-cycle": "past cycle", "location-open": "location open", "other-city": "other city", "event": "event", "excluded-term": "excluded term", "priority-firm": "priority firm" }],
    "reason.domain": ["方向 ", "area "], "reason.neg": ["扣分 ", "penalty "], "reason.senior": ["资深岗 ", "senior: "],
    "status.last": ["上次抓取 ", "Last scan "], "status.sources": [" 个来源正常", " sources OK"],
    "status.failed": ["（{n} 个失败，沿用上次数据）", " ({n} failed, showing their last data)"],
    "status.show": ["查看来源", "Sources"], "status.hide": ["收起来源", "Hide sources"],
    "src.count": [" 条 · ", " postings · "], "src.failed": ["失败 ", "failed "], "src.lastok": [" · 上次成功 ", " · last OK "],
    "tile.new": ["新增（极高–中高）", "New (Top – Mid-high)"], "tile.filtering": [" · 筛选中", " · filtering"],
    "tile.applied": ["已投递", "Applied"], "tile.collapsed": [" · 已收起，点击查看", " · collapsed, click to view"],
    "tile.events": ["校园活动 · 案例赛", "Campus events · case comps"],
    "city.other": ["其他", "Other"],
    "list.empty": ["没有符合筛选条件的岗位。", "No postings match the current filters."],
    "more.collapse": ["收起", "Collapse"], "more.expand": ["展开全部 {n} 条", "Show all {n}"],
    "foot": ["本次显示 {shown} / {visible} 条（官网共抓到 {fetched} 条，规则剔除 {dropped} 条，其中实习类已全部过滤）。分数 = 级别 + 届别 + 城市 + 方向 + 优先公司；AI 评语只对新岗位生成。数据生成于 {at} UTC。",
             "Showing {shown} of {visible} postings ({fetched} fetched from the career sites, {dropped} removed by the rules — every internship filtered out). Score = level + class year + city + area + priority firm; AI notes are written for new postings only. Data generated {at} UTC."],
    "card.closes": ["截止 ", "Closes "], "card.posted": ["发布 ", "Posted "], "card.firstseen": ["首次出现 ", "First seen "],
    "verdict": [{ apply: "建议投", consider: "可考虑", skip: "可跳过" }, { apply: "Apply", consider: "Consider", skip: "Skip" }],
    "card.applied": ["✓ 已投 ", "✓ Applied "], "card.stale": ["上次数据", "last run"], "card.link": ["官网职位页 →", "Official posting →"],
    "btn.applied": ["已投 ✓", "Applied ✓"], "btn.apply": ["标记已投", "Mark applied"], "btn.restore": ["恢复", "Restore"], "btn.hide": ["忽略", "Hide"],
    "load.error": ["暂无数据（{msg}）。先在 GitHub 上手动跑一次 \"DreamCatcher scan\"，或在本文件顶部填好 DATA_URL。", "No data yet ({msg}). Run \"DreamCatcher scan\" once on GitHub, or set DATA_URL at the top of this file."],
    "lang.title": ["Switch to English", "切换到中文"]
  };
  function T(key, vars) {
    var v = STR[key]; if (!v) return key;
    var s = v[lang === "en" ? 1 : 0];
    if (typeof s === "string" && vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  window.dcT = T;
  window.dcLang = function () { return lang; };

  // ---- static text: swap every text node (and placeholder / title attributes) that has a translation
  var SKIP = { SCRIPT: 1, STYLE: 1, CANVAS: 1, SVG: 1 };
  function walk(root, fn) {
    var it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      var p = n.parentNode; if (!p || SKIP[p.nodeName.toUpperCase()] || p.closest("#rl-list, #rl-status, #rl-sources, #rl-heat, #rl-meta, #rl-companies, #rl-cities, #rl-types, #rl-more, #rl-foot, #dc-lang")) return NodeFilter.FILTER_REJECT;
      return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; } });
    var n, list = []; while ((n = it.nextNode())) list.push(n); list.forEach(fn);
  }
  function apply(root) {
    root = root || document.body;
    walk(root, function (n) {
      if (n.__zh == null) n.__zh = n.nodeValue;
      var raw = n.__zh, key = raw.trim();
      if (lang === "en") { var en = MAP[key]; if (en != null) { var lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0]; n.nodeValue = lead + en + tail; } }
      else n.nodeValue = raw;
    });
    Array.prototype.forEach.call(root.querySelectorAll("[placeholder], [title]"), function (el) {
      ["placeholder", "title"].forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        var k = "__zh_" + a; if (el[k] == null) el[k] = el.getAttribute(a);
        var en = MAP[el[k].trim()];
        el.setAttribute(a, lang === "en" && en != null ? en : el[k]);
      });
    });
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    if (document.__zhTitle == null) document.__zhTitle = document.title;
    document.title = lang === "en" ? (MAP[document.__zhTitle] || document.__zhTitle) : document.__zhTitle;
    var btn = document.getElementById("dc-lang");
    if (btn) { Array.prototype.forEach.call(btn.querySelectorAll("button"), function (b) { b.classList.toggle("on", b.getAttribute("data-lang") === lang); }); btn.title = T("lang.title"); }
  }
  window.dcApplyLang = apply;

  function setLang(l) {
    if (l === lang) return;
    lang = l; try { localStorage.setItem("dc.lang", l); } catch (e) {}
    apply(document.body);
    window.dispatchEvent(new Event("dc:lang"));
  }
  window.dcSetLang = setLang;

  // ---- the switch, top-right
  function mount() {
    var box = document.createElement("div"); box.id = "dc-lang"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Language");
    box.innerHTML = '<button type="button" data-lang="zh">中文</button><button type="button" data-lang="en">EN</button>';
    box.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setLang(b.getAttribute("data-lang")); });
    document.body.appendChild(box);
    apply(document.body);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
