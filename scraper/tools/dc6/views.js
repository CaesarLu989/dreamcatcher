// views.js — the screens as HTML strings: navigation, Today, Roles, Pipeline, Engine, the role dossier and the command palette.
// They read the state `S` and the derived model `M` (both live in app.js) and never touch the DOM themselves.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), escAttr = esc;
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? esc(u) : '#');
Object.assign(ic, {
  check: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8.5l3.2 3.2L13 5"/></svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
  ext: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9"/></svg>`,
  copy: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M10.5 5.5V3.7a1.2 1.2 0 00-1.2-1.2H3.7a1.2 1.2 0 00-1.2 1.2v5.6a1.2 1.2 0 001.2 1.2h1.8"/></svg>`,
  back: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 8H3M7 4L3 8l4 4"/></svg>`,
  q: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.2 4.4a1.9 1.9 0 113 1.5c-.7.5-1.2.9-1.2 1.7M6 9.6v.2"/></svg>`,
  ok: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2.5 6.4l2.3 2.3L9.5 3.8"/></svg>`,
  stop: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8"/></svg>`,
});
const ROUTES = ['today', 'roles', 'pipe', 'engine'], STAGES = ['sent', 'test', 'talk', 'offer', 'no'];
const CITY_EN = { 深圳: 'Shenzhen', 北京: 'Beijing', 上海: 'Shanghai', 广州: 'Guangzhou', 杭州: 'Hangzhou', 南京: 'Nanjing', 成都: 'Chengdu', 武汉: 'Wuhan', 全国: 'Nationwide' };
const ymd = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const hm = (d) => pad2(d.getHours()) + ':' + pad2(d.getMinutes());
const phaseIdx = (a) => Math.round((((a % 360) + 360) % 360) / 45) % 8;
const moonAt = (ms, size = 16) => `<i class="mn"${phaseAngle(ms) > 180 ? ' style="transform:scaleX(-1)"' : ''}>${moon(size, litNow(ms), T().c.moonS)}</i>`;

const tr = () => STR[S.lang], T = () => THEMES[S.theme];
const regionName = (k) => tr().regions[k] || k, sectorName = (k) => tr().sectors[k] || k, heatName = (h) => (S.lang === 'en' ? ((S.data.heat.find((x) => x.key === h) || {}).en || h) : h);
const archName = (k) => { const a = S.data.archetypes[k] || {}; return S.lang === 'en' ? a.en || a.name || k : a.name || k; };
const place = (r) => { const base = regionName(r.region); if (!r.city) return base; const c = S.lang === 'en' ? CITY_EN[r.city] || r.city : r.city; return (r.region === '内地' ? c : `${c}, ${base}`) + (r.more ? ' ' + tr().cities(r.more + 1) : ''); };
const whyOf = (r) => (r.why || []).map((w) => { const W = tr().why; switch (w[0]) { case 'stretch': return W.stretch[w[1]] || ''; case 'edge': return S.lang === 'en' ? w[2] : w[1]; case 'soon': return W.soon(tr().md(ymd(w[1]) || new Date()), w[2]); case 'fresh': return W.fresh; case 'prog': return W.prog; case 'hits': return W.hits(w[1].map(tagName)); case 'stale': return W.stale(w[1]); default: return ''; } }).filter(Boolean);
const tagName = (x) => (S.lang === 'en' ? S.data.tags[x] || x : x);
const whenOf = (r) => { const W = tr().when; if (r.left != null) return [W.left(r.left), W.dl(tr().md(ymd(r.closes) || new Date())), r.soon ? ' soon' : '']; if (r.stale) return [W.up(r.age), W.verify, '']; if (r.age != null) return [r.age === 0 ? W.today : W.days(r.age), W.noDl, r.fresh ? ' new' : '']; if (r.first) return [W.seen(Math.max(0, Math.round((new Date(S.data.generatedAt) - new Date(r.first)) / 864e5))), W.noDl, r.fresh ? ' new' : '']; return [W.unknown, W.noDl, '']; };
const blockNote = (b) => { const N = tr().bNote, n = b.n || [], x = N[n[0]]; return typeof x === 'function' ? x(n[0] === 'fam' ? tr().fam[n[1]] || n[1] : n[1], n[2]) : x || ''; };
const chips = (r, max = 2) => [r.st && ['st', tr().tagStretch], r.fresh && ['new', tr().tagNew], r.soon && ['soon', tr().tagSoon], r.stale && ['stale', tr().tagStale], r.old && ['old', tr().tagOld]].filter(Boolean).slice(0, max).map(([c, x]) => `<span class="chip ${c}">${x}</span>`).join('');

/* ---------- navigation ---------- */
function navHTML() {
  const t = tr(), Th = T(), gen = S.data ? new Date(S.data.generatedAt) : null, late = gen ? (Date.now() - gen) / 36e5 : 0;
  const words = ROUTES.map((r) => `<a href="#/${r}" class="${S.route === r ? 'on' : ''}"${S.route === r ? ' aria-current="page"' : ''}>${t.nav[r]}</a>`).join('');
  return `<a class="skip" href="#main">${t.skip}</a><header class="nav"><div class="wrap">
    <a class="brand" href="#/today" aria-label="DreamCatcher">${mark({ size: 30, bare: true, tight: true, tiny: true, tone: Th.tone, accent: Th.moon })}<span>DreamCatcher</span></a>
    <nav class="nav-words" aria-label="${t.nav.today}">${words}</nav>
    <div class="nav-right">
      <button class="cmdk" data-act="pal" aria-label="${t.search}">${ic.search}<span>${t.search}</span><kbd>⌘K</kbd></button>
      ${gen ? `<div class="scan${late > 7 ? ' late' : ''}" title="${esc(gen.toLocaleString())}"><i class="dot"></i><span>${late > 7 ? t.scanLate(Math.round(late)) : t.scanned(hm(gen))}</span></div>` : ''}
      <div class="seg" role="group"><button data-act="theme" data-v="dark" class="${S.theme === 'dark' ? 'on' : ''}" aria-pressed="${S.theme === 'dark'}">${ic.moon}<span class="tx">${t.dark}</span></button><button data-act="theme" data-v="light" class="${S.theme === 'light' ? 'on' : ''}" aria-pressed="${S.theme === 'light'}">${ic.sun}<span class="tx">${t.light}</span></button></div>
      <div class="seg lang" role="group"><button data-act="lang" data-v="zh" class="${S.lang === 'zh' ? 'on' : ''}">中</button><button data-act="lang" data-v="en" class="${S.lang === 'en' ? 'on' : ''}">EN</button></div>
    </div></div></header><nav class="tabbar">${words}</nav>`;
}
function footHTML() { const t = tr(), D = S.data, gen = new Date(D.generatedAt); return `<div class="wrap"><div class="foot"><span>${t.foot(gen.toLocaleDateString(S.lang === 'en' ? 'en-CA' : 'zh-CN') + ' ' + hm(gen), D.counts.sourceErrors, D.counts.sourceEmpty)}</span><span>${t.footR} · <a href="https://github.com/CaesarLu989/dreamcatcher" target="_blank" rel="noopener">${t.repo}</a> · v6</span></div></div>`; }

/* ---------- a role as a row ---------- */
function rowHTML(r, o = {}) {
  const t = tr(), w = whenOf(r), why = whyOf(r).slice(0, 2).join(S.lang === 'en' ? '; ' : '；');
  return `<div class="row${S.sel === r.id ? ' sel' : ''}" data-id="${esc(r.id)}" tabindex="-1" role="listitem">
    <span class="rk">${pad2(r.rank)}</span>
    <div class="ht">${moon(30, r.lit, T().c.moon)}<div><b class="metal">${r.pr}</b><em>${heatName(r.heat)}</em></div></div>
    <div class="ti"><b>${esc(r.t)}</b><div class="m"><span>${esc(r.co)} · ${esc(place(r))}</span>${chips(r)}</div><p>${esc(why)}</p></div>
    <div class="mt"><span>${t.fit}</span><div class="bar"><i style="width:${r.fit}%"></i></div><b>${r.fit}</b><span>${t.odds}</span><div class="rng"><i style="left:${f(r.lo / 60 * 100)}%;width:${f(Math.max(2, (r.hi - r.lo) / 60 * 100))}%"></i></div><b>${r.lo}–${r.hi}%</b><span></span><span class="cap">${esc(t.by(t.bands[r.band], archName(r.arch)))}</span></div>
    <div class="wh${w[2]}">${w[0]}<em>${w[1]}</em></div>
    <div class="acts-r">${o.hidden ? `<button class="ib yes" data-act="unhide" title="${t.unhide}" aria-label="${t.unhide}">${ic.back}</button>` : `<button class="ib yes" data-act="apply" title="${t.applied} (A)" aria-label="${t.applied}">${ic.check}</button><button class="ib no" data-act="hide" title="${t.hide} (X)" aria-label="${t.hide}">${ic.x}</button>`}<a class="ib go" href="${safeUrl(r.url)}" target="_blank" rel="noopener" title="${t.open}" aria-label="${t.open}">${ic.arrow}</a></div></div>`;
}

/* ---------- charts ---------- */
function funnelSVG() {
  const t = tr(), c = T().c, F = S.data.funnel, id = nid('fn'), W = 792, H = 244, xs = F.map((_, i) => 8 + i * (W - 16) / (F.length - 1)), hh = F.map((s) => Math.max(5, Math.sqrt(s.n) * 1.5)), cy = 130;
  let top = `M${xs[0]},${f(cy - hh[0] / 2)}`, bot = '';
  for (let i = 1; i < xs.length; i++) { const mx = (xs[i - 1] + xs[i]) / 2; top += `C${f(mx)},${f(cy - hh[i - 1] / 2)} ${f(mx)},${f(cy - hh[i] / 2)} ${xs[i]},${f(cy - hh[i] / 2)}`; }
  for (let i = xs.length - 1; i > 0; i--) { const mx = (xs[i - 1] + xs[i]) / 2; bot += `C${f(mx)},${f(cy + hh[i] / 2)} ${f(mx)},${f(cy + hh[i - 1] / 2)} ${xs[i - 1]},${f(cy + hh[i - 1] / 2)}`; }
  const shape = `${top}L${xs[xs.length - 1]},${f(cy + hh[hh.length - 1] / 2)}${bot}Z`, cjk = "Outfit, 'PingFang SC', 'Noto Sans CJK SC', sans-serif";
  let s = `<svg class="fn" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t.funnel}"><defs><linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.bezel[3]}"/><stop offset=".3" stop-color="${c.bezel[1]}"/><stop offset=".62" stop-color="${c.B[0]}"/><stop offset="1" stop-color="${c.B[1]}"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${S.theme === 'dark' ? .55 : .9}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${S.theme === 'dark' ? .35 : .18}"/></linearGradient></defs><path d="${shape}" fill="url(#${id}a)"/><path d="${shape}" fill="url(#${id}s)"/>`;
  F.forEach((st, i) => { const x = xs[i], anchor = i === 0 ? 'start' : i === F.length - 1 ? 'end' : 'middle';
    s += `<rect x="${f(x - 2.5)}" y="${f(cy - hh[i] / 2 - 3)}" width="5" height="${f(hh[i] + 6)}" rx="2.5" fill="${c.ink}"/><text x="${x}" y="22" text-anchor="${anchor}" font-family="Outfit" font-weight="300" font-size="26" letter-spacing="-.5" fill="${c.ink}">${st.n.toLocaleString('en-US')}</text><text x="${x}" y="42" text-anchor="${anchor}" font-family="${cjk}" font-size="13" fill="${c.muted}">${t.fl[i]}</text>`;
    if (st.drop != null && i) { const mx = (xs[i - 1] + xs[i]) / 2; s += `<text x="${f(mx)}" y="${H - 22}" text-anchor="middle" font-family="DM Mono" font-size="13" fill="${c.ink2}">−${st.drop.toLocaleString('en-US')}</text><text x="${f(mx)}" y="${H - 4}" text-anchor="middle" font-family="${cjk}" font-size="13" fill="${c.muted}">${t.fw[i]}</text>`; } });
  return s + '</svg>';
}
/* on a phone the funnel is a list: one bar per step, the drop underneath */
function funnelList() { const t = tr(), F = S.data.funnel, mx = Math.sqrt(F[0].n || 1); return `<div class="kv" style="grid-template-columns:92px 1fr auto">${F.map((st, i) => `<span>${t.fl[i]}</span><div class="bar" style="height:6px"><i style="width:${f(Math.max(2, Math.sqrt(st.n) / mx * 100))}%"></i></div><b>${st.n.toLocaleString('en-US')}</b>${i ? `<span></span><span class="note" style="margin:-4px 0 4px;grid-column:2/4">−${st.drop.toLocaleString('en-US')} · ${t.fw[i]}</span>` : ''}`).join('')}</div>`; }
const pipeCols = () => { const c = T().c; return { sent: c.pipe[0], test: c.pipe[1], talk: c.pipe[2], offer: c.gold[1], no: c.pipe[3] }; };
const pipeCount = () => { const n = Object.fromEntries(STAGES.map((s) => [s, 0])); for (const p of Object.values(S.pipe)) n[STAGES.includes(p.s) ? p.s : 'sent']++; return n; };
function gaugeSVG(size = 176) {
  const t = tr(), c = T().c, id = nid('gg'), cx = size / 2, cy = size / 2, R = size / 2 - 12, n = pipeCount(), total = M.pipeN, col = pipeCols(); let a = 0;
  let s = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;flex:none" role="img" aria-label="${t.sent} ${total}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.num[0]}"/><stop offset="1" stop-color="${c.num[1]}"/></linearGradient></defs><circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="none" stroke="${c.grid}" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c.grid}" stroke-width="13" opacity=".5"/>`;
  if (total) STAGES.forEach((k) => { if (!n[k]) return; const span = n[k] / total * 360; s += span >= 359.9 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${col[k]}" stroke-width="13"/>` : `<path d="${arc(cx, cy, R, a + 1.6, a + span - 1.6)}" fill="none" stroke="${col[k]}" stroke-width="13"/>`; a += span; });
  for (let i = 0; i < 60; i++) { const p0 = polar(cx, cy, R - 12, i * 6), p1 = polar(cx, cy, R - (i % 5 ? 15 : 18), i * 6); s += `<path d="M${f(p0[0])},${f(p0[1])}L${f(p1[0])},${f(p1[1])}" stroke="${c.grid}" stroke-width="1"/>`; }
  return s + `<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="Outfit" font-weight="300" font-size="44" letter-spacing="-1" fill="url(#${id})">${total}</text><text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="Outfit, 'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="13" fill="${c.muted}">${t.sent}</text></svg>`;
}
const pipeCard = () => { const t = tr(), n = pipeCount(), col = pipeCols(), last = Object.values(S.pipe).map((p) => p.at).filter(Boolean).sort().pop();
  return `<div class="card"><h3>${t.pipe}<span>${last ? t.pipeAsOf(tr().md(ymd(last) || new Date())) : t.pipeNone}</span></h3><div class="pipe">${gaugeSVG()}<ul>${STAGES.map((k) => `<li><i style="background:${col[k]}"></i>${t.stages[k]}<b>${n[k]}</b></li>`).join('')}</ul></div><p class="pipe-note">${t.pipeNote} <a class="link" href="#/pipe">${t.pipeGo}</a></p></div>`; };

/* ---------- Today ---------- */
function nextRows() {
  const t = tr(), D = S.data, now = Date.now(), gen = new Date(D.generatedAt).getTime(), rows = [], by = {};
  const due = gen + 3 * 36e5, mins = Math.round((due - now) / 6e4);
  rows.push([hm(new Date(Math.max(due, now))), now, mins > 1 ? t.nextScan(mins) : t.nextScanDue, false]);
  for (const r of M.pool) if (r.closes && r.left != null && r.left >= 0) (by[r.closes + '|' + r.co] ||= []).push(r);
  Object.entries(by).sort().slice(0, 3).forEach(([k, rs]) => { const d = ymd(k.split('|')[0]); rows.push([pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()), d.getTime() + 17 * 36e5, rs.length > 1 ? t.closesN(rs[0].co, rs.length) : t.closes1(rs[0].co, rs[0].t), rs[0].left <= D.soonDays]); });
  for (const e of events(now, now + 32 * 864e5)) { if (rows.length >= 4) break; const d = new Date(e.t); rows.push([pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()), e.t, e.full ? t.fullMoon : t.newMoon, false]); }
  return rows.sort((a, b) => a[1] - b[1]).map(([lab, ms, text, soon]) => `<p class="${soon ? 'soon' : ''}"><b>${lab}</b>${moonAt(ms)}<span title="${esc(text)}">${esc(text)}</span></p>`).join('');
}
function dialHTML(first) {
  const t = tr(), D = S.data, now = Date.now(), L = { ...t.dial, tonight: t.dial.tonight(t.phases[phaseIdx(phaseAngle(now))]) };
  return dial(T(), { roles: M.pool, total: M.core.length, sectors: D.sectors.map(([k]) => [k, sectorName(k)]), focusMin: D.focusMin, pipeN: M.pipeN, now, L }, { mini: S.mini, dur: first ? 2.2 : 0, target: handAngle() });
}
function vToday() {
  const t = tr(), D = S.data, now = Date.now(), ang = phaseAngle(now), reg = (k) => M.core.filter((r) => r.region === k).length, shades = S.theme === 'dark' ? ['#EEF1F6', '#5B8CFF', 'rgba(91,140,255,.45)'] : ['#12151B', '#1F55F0', 'rgba(31,85,240,.4)'];
  const list = M.focus.filter((r) => !S.tReg || r.region === S.tReg), rest = M.core.length - M.focus.length, bl = M.blocked;
  const ex = []; for (const g of [1, 8, 3, 0, 5, 6, 2, 7, 4]) { const b = bl.find((x) => x.g === g && !ex.includes(x) && (g !== 0 || (x.n || [])[0] === 'fam')); if (b) ex.push(b); if (ex.length === 4) break; }
  return `<div class="wrap"><section class="hero">
      <div class="rise">
        <div class="date"><span>${t.date(new Date())}</span><i class="sep"></i>${moonAt(now)}<span>${t.phases[phaseIdx(ang)]}</span></div>
        <h1 class="h1">${t.h1(M.core.length, M.fresh.length)}</h1>
        <p class="lead">${t.lead(D.counts.sources, D.counts.fetched.toLocaleString('en-US'))}${M.stretch.length ? ' ' + t.stretchLead(M.stretch.length) : ''}</p>
        <div class="trio">${D.regions.map((k) => `<button data-act="reg" data-v="${k}"><b class="metal">${reg(k)}</b>${regionName(k)}</button>`).join('')}</div>
        <div class="split">${D.regions.map((k, i) => `<i style="flex:${Math.max(reg(k), .001)};background:${shades[i]}"></i>`).join('')}</div>
        <div class="acts"><a class="btn btn--primary" href="#/roles">${t.seeAll(M.pool.length)} ${ic.arrow}</a><a class="btn btn--secondary" href="#/engine">${t.tune}</a></div>
        <p class="ask">${t.ask}<a class="link" href="#/engine" data-act="find">${t.askLink}</a></p>
        <div class="next"><span class="label">${t.next}</span>${nextRows()}</div>
      </div>
      <div class="dialwrap" style="--k:${dialK()};--ox:${S.mini ? 96 : 0}" data-k="${dialK()}"><div class="dialbox${S.played ? ' still' : ''}">${dialHTML(!S.played)}</div><div class="tip" role="status"></div></div>
    </section>
    <div class="sec" id="focus"><h2>${t.focus}</h2><button class="chip${S.tReg ? '' : ' on'}" data-act="treg" data-v="">${t.all(M.focus.length)}</button>${D.regions.map((k) => `<button class="chip${S.tReg === k ? ' on' : ''}" data-act="treg" data-v="${k}">${regionName(k)} ${M.focus.filter((r) => r.region === k).length}</button>`).join('')}
      <div class="hint"><span>${t.focusNote}</span><span><kbd class="k">J</kbd><kbd class="k">K</kbd>${t.kUpDown}</span><span><kbd class="k">↵</kbd>${t.kOpen}</span><span><kbd class="k">A</kbd>${t.kApply}</span><span><kbd class="k">X</kbd>${t.kHide}</span></div></div>
    <div class="tbl" role="list">${list.length ? list.map((r) => rowHTML(r)).join('') : `<div class="empty"><b>${t.focusEmpty[0]}</b>${t.focusEmpty[1]}</div>`}</div>
    <div class="more"><span>${rest > 0 ? t.rest(rest, D.regions.map((k) => `${regionName(k)} ${reg(k)}`).join(S.lang === 'en' ? ', ' : '，')) : t.restNone}</span><a class="btn btn--secondary btn--sm" href="#/roles">${t.goRoles} ${ic.arrow}</a></div>
    <div class="cards">
      <div class="card"><h3>${t.funnel}<span>${t.funnelNote}</span></h3>${S.mini ? funnelList() : funnelSVG()}</div>
      ${pipeCard()}
    </div>
    ${ex.length ? `<div class="card blk"><h3 class="blk-h">${t.blocked}<span>${t.blockedNote(bl.length)}</span></h3>${ex.map((b) => `<div data-act="find" data-q="${esc(b.t)}"><b>${esc(b.co)} · ${esc(b.t)}</b><p>${ic.lock}<span>${t.bGate[b.g]}${S.lang === 'en' ? ': ' : '：'}${esc(blockNote(b))}</span></p></div>`).join('')}</div>` : ''}
  </div>`;
}

/* ---------- Roles: filter by place, kind of firm and firm, the way the earlier versions did ---------- */
const groupName = (k) => tr().groups[k] || k || tr().groups.tech;
const firmOf = (key) => (S.data.firms || []).find((f) => f.key === key);
/* the roles that pass every filter except the dimensions named in `skip` (so each chip can show its own count) */
function rolesBase(skip = '') {
  const F = S.rf, q = F.q.trim().toLowerCase();
  return (F.hidden ? M.hid : M.pool).filter((r) => (F.stretch || !r.st) && (!F.onlyNew || r.fresh) && (!F.sector || r.s === F.sector) && (!q || (r.co + ' ' + r.t + ' ' + place(r)).toLowerCase().includes(q))
    && (skip.includes('region') || !F.region || r.region === F.region) && (skip.includes('grp') || !F.grp || (r.group || 'tech') === F.grp || (F.grp === 'tech' && !['ib', 'consulting', 'cabank', 'buyside', 'cn'].includes(r.group)))
    && (skip.includes('cos') || !F.cos.length || F.cos.includes(r.key)));
}
function blockedHere() {
  const F = S.rf, q = F.q.trim().toLowerCase(), g = (b) => { const f = firmOf(b.k); return f ? f.group : null; };
  return M.blocked.filter((b) => (!F.region || b.region === F.region) && (!F.cos.length || F.cos.includes(b.k)) && (!F.grp || (g(b) || 'tech') === F.grp || (F.grp === 'tech' && !['ib', 'consulting', 'cabank', 'buyside', 'cn'].includes(g(b)))) && (!q || (b.co + ' ' + b.t).toLowerCase().includes(q)));
}
function filtersHTML() {
  const t = tr(), D = S.data, F = S.rf, n = (xs) => `<b>${xs}</b>`, chip = (act, v, lab, cnt, on, cls = '') => `<button class="chip${on ? ' on' : ''}${cls}" data-act="${act}" data-v="${esc(v)}" aria-pressed="${!!on}">${esc(lab)}${cnt == null ? '' : n(cnt)}</button>`;
  const byR = rolesBase('region'), byG = rolesBase('grp'), byC = rolesBase('cos'), GK = ['ib', 'consulting', 'cabank', 'buyside', 'cn', 'tech'], gOf = (r) => (GK.includes(r.group) ? r.group : 'tech');
  const cnt = {}; for (const r of byC) cnt[r.key] = (cnt[r.key] || 0) + 1;
  // every tracked firm, one chip per name (a firm scanned through two career sites is still one firm); the busiest first.
  // Firms with nothing that qualifies stay reachable under "more", so that "where is Brookfield?" always has an answer.
  const FIN = ['ib', 'consulting', 'cabank', 'buyside', 'cn'], byName = new Map();
  for (const f of D.firms || []) { const g = GK.includes(f.group) ? f.group : 'tech'; if (F.grp && g !== F.grp) continue; const e = byName.get(f.name) || byName.set(f.name, { name: f.name, keys: [], c: 0, n: 0, fin: false, paused: true }).get(f.name); e.keys.push(f.key); e.c += cnt[f.key] || 0; e.n += f.n; e.fin = e.fin || FIN.includes(f.group); e.paused = e.paused && !!f.paused; }
  const isOn = (e) => e.keys.every((k) => F.cos.includes(k)), all = [...byName.values()].filter((e) => e.c || isOn(e) || (e.fin && !e.paused)).sort((a, b) => b.c - a.c || b.n - a.n || a.name.localeCompare(b.name));
  const live = all.filter((e) => e.c), rest = all.filter((e) => !e.c), shown = F.moreCo ? all : [...live.slice(0, 16), ...all.filter((e) => isOn(e) && !live.slice(0, 16).includes(e))], hiddenN = all.length - shown.length;
  return `<div class="filters">
    <div class="frow"><span class="lbl">${t.fLoc}</span><div class="fchips">${chip('rreg', '', t.allPlaces, byR.length, !F.region)}${D.regions.map((k) => chip('rreg', k, regionName(k), byR.filter((r) => r.region === k).length, F.region === k)).join('')}</div></div>
    <div class="frow"><span class="lbl">${t.fType}</span><div class="fchips">${chip('rgrp', '', t.allTypes, byG.length, !F.grp)}${GK.map((k) => { const c = byG.filter((r) => gOf(r) === k).length; return c || F.grp === k ? chip('rgrp', k, groupName(k), c, F.grp === k) : ''; }).join('')}</div></div>
    <div class="frow"><span class="lbl">${t.fCo}</span><div class="fchips">${chip('rco', '', t.allCo, byC.length, !F.cos.length)}${shown.map((e) => chip('rco', e.keys.join(','), e.name, e.c, isOn(e), e.c ? '' : ' zero')).join('')}${hiddenN > 0 || F.moreCo ? `<button class="chip more-co" data-act="rmore">${F.moreCo ? t.lessCo : t.moreCo(hiddenN)}</button>` : ''}</div></div>
    <div class="frow opts"><span class="lbl">${t.fShow}</span><div class="fchips">
      ${M.stretch.length ? chip('rstretch', '', t.withStretch, M.stretch.length, F.stretch) : ''}${chip('rnew', '', t.onlyNew, M.fresh.length, F.onlyNew)}${M.hid.length || F.hidden ? chip('rhid', '', t.showHiddenL, M.hid.length, F.hidden) : ''}
      <select class="chip" data-chg="rsector" aria-label="${t.gSector}"><option value="">${t.allSectors}</option>${D.sectors.map(([k]) => `<option value="${k}"${F.sector === k ? ' selected' : ''}>${sectorName(k)}</option>`).join('')}</select>
      <select class="chip" data-chg="rsort" aria-label="${t.sort}">${[['pr', t.sPr], ['fit', t.sFit], ['odds', t.sOdds], ['new', t.sNew]].map(([k, l]) => `<option value="${k}"${F.sort === k ? ' selected' : ''}>${t.sort}${S.lang === 'en' ? ': ' : '：'}${l}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="${t.groupBy}">${[['region', t.gRegion], ['co', t.gCo], ['sector', t.gSector]].map(([k, lab]) => `<button data-act="rgroup" data-v="${k}" class="${F.group === k ? 'on' : ''}">${lab}</button>`).join('')}</div>
      <label class="find">${ic.search}<input type="search" data-inp="rq" value="${esc(F.q)}" placeholder="${t.filter}" aria-label="${t.filter}"></label></div></div>
  </div>`;
}
function rolesList() {
  const t = tr(), D = S.data, F = S.rf;
  const key = { pr: (r) => -r.pr, fit: (r) => -r.fit, odds: (r) => -(r.lo + r.hi), new: (r) => (r.age ?? 9999) }[F.sort] || ((r) => -r.pr);
  const rs = rolesBase().slice().sort((a, b) => key(a) - key(b) || b.pr - a.pr), bl = F.hidden ? [] : blockedHere(), colon = S.lang === 'en' ? ': ' : '：';
  const blockedBox = bl.length ? `<details class="moreb"${!rs.length && F.cos.length ? ' open' : ''}><summary>${ic.lock}<span>${t.blockedHere(bl.length)}</span></summary><ul class="blist">${bl.slice(0, 120).map((b) => `<li><div><b>${esc(b.t)}</b><span>${esc(b.co)} · ${regionName(b.region)}</span></div><p>${ic.lock}<span>${t.bGate[b.g]}${colon}${esc(blockNote(b))}</span></p><a class="ib go" href="${safeUrl(b.url)}" target="_blank" rel="noopener" aria-label="${t.open}">${ic.ext}</a></li>`).join('')}</ul>${bl.length > 120 ? `<p class="note" style="padding-bottom:14px">${t.blockedCap(120)}</p>` : ''}</details>` : '';
  if (!rs.length) { const names = [...new Set(F.cos.map((k) => (firmOf(k) || {}).name))], only = names.length === 1 ? { ...firmOf(F.cos[0]), bl: F.cos.reduce((q, k) => q + ((firmOf(k) || {}).bl || 0), 0), err: F.cos.every((k) => (firmOf(k) || {}).err), seen: F.cos.every((k) => (firmOf(k) || {}).seen === false) ? false : undefined } : null; return `<div class="tbl"><div class="empty"><b>${only ? esc(t.noFirm(only.name)) : t.rolesEmpty[0]}</b>${only ? (only.err ? t.firmErr : only.seen === false ? t.firmNew : t.firmNone(only.bl)) : t.rolesEmpty[1]}<div style="margin-top:16px"><button class="btn btn--secondary btn--sm" data-act="rclear">${t.clear}</button></div></div></div>${blockedBox}`; }
  const groups = new Map(), gk = F.group === 'co' ? (r) => r.co : F.group === 'sector' ? (r) => r.s : (r) => r.region;
  for (const r of rs) (groups.get(gk(r)) || groups.set(gk(r), []).get(gk(r))).push(r);
  const order = F.group === 'region' ? D.regions.filter((k) => groups.has(k)) : F.group === 'sector' ? D.sectors.map(([k]) => k).filter((k) => groups.has(k)) : [...groups.keys()];
  const name = F.group === 'region' ? regionName : F.group === 'sector' ? sectorName : (k) => k;
  return order.map((k) => `<div class="grp"><h3>${esc(name(k))}</h3><span>${pad2(groups.get(k).length)}</span><i></i></div><div class="tbl" role="list">${groups.get(k).map((r) => rowHTML(r, { hidden: F.hidden })).join('')}</div>`).join('') + blockedBox;
}
function vRoles() {
  const t = tr();
  return `<div class="wrap"><div class="head rise"><div><h1>${t.rolesH(M.core.length, M.stretch.length)}</h1><p>${t.rolesP}</p></div></div>
    <div id="rfilters">${filtersHTML()}</div><div id="rlist">${rolesList()}</div></div>`;
}

/* ---------- Pipeline ---------- */
function vPipe() {
  const t = tr(), col = pipeCols(), items = Object.entries(S.pipe).map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.at || '').localeCompare(a.at || '')), co = [...new Set([...S.data.sources.map((s) => s.name), ...S.data.roles.map((r) => r.co)])].sort();
  const card = (p) => { const live = S.data.roles.some((r) => r.id === p.id); return `<div class="pc"><b>${live ? `<a href="#/pipe/${encodeURIComponent(p.id)}">${esc(p.t || p.id)}</a>` : p.url ? `<a href="${safeUrl(p.url)}" target="_blank" rel="noopener">${esc(p.t || p.id)}</a>` : esc(p.t || p.id)}</b><span>${esc(p.co || t.offline)} · ${p.at ? t.md(ymd(p.at) || new Date()) : ''}${p.region ? ' · ' + regionName(p.region) : ''}</span>
    <div class="mv">${STAGES.filter((s) => s !== p.s).map((s) => `<button data-act="stage" data-id="${esc(p.id)}" data-v="${s}" title="${t.to} ${t.stages[s]}">${t.stages[s].split(/[，,]/)[0]}</button>`).join('')}<button class="x" data-act="prm" data-id="${esc(p.id)}" aria-label="${t.remove}" title="${t.remove}">${t.remove}</button></div></div>`; };
  return `<div class="wrap"><div class="head rise"><div><h1>${t.pipeH(items.length)}</h1><p>${t.pipeP}</p></div></div>
    <div class="pcols">${STAGES.map((s) => { const xs = items.filter((p) => (STAGES.includes(p.s) ? p.s : 'sent') === s); return `<div class="pcol"><h3><i style="background:${col[s]}"></i>${t.stages[s]}<b>${xs.length}</b></h3>${xs.length ? xs.map(card).join('') : `<p class="pnone">${t.pipeEmpty}</p>`}</div>`; }).join('')}</div>
    <div class="eng">
      <div class="card"><h3>${t.addH}</h3><p class="formula" style="margin-top:-12px">${t.addP}</p><form class="form" data-form="padd"><input type="text" name="co" list="dc-co" placeholder="${t.addCo}" aria-label="${t.addCo}" required><datalist id="dc-co">${co.map((c) => `<option value="${esc(c)}">`).join('')}</datalist><input type="text" name="t" placeholder="${t.addT}" aria-label="${t.addT}" required>
        <select name="sec" aria-label="${t.gSector}">${S.data.sectors.map(([k]) => `<option value="${k}">${sectorName(k)}</option>`).join('')}</select><select name="s" aria-label="${t.pipe}">${STAGES.map((s) => `<option value="${s}">${t.stages[s]}</option>`).join('')}</select><input type="date" name="at" value="${new Date().toLocaleDateString('en-CA')}" aria-label="${t.dDates}"><button class="btn btn--secondary btn--sm" type="submit">${t.add}</button></form></div>
      <div class="card"><h3>${t.cool}</h3>${M.cool.length ? `<ul class="why">${M.cool.map((c) => `<li>${esc(t.coolRow(c.co, sectorName(c.s), t.mdy(new Date(c.until))))}</li>`).join('')}</ul>` : `<p class="formula">${t.coolNone}</p>`}</div>
    </div></div>`;
}

/* ---------- Engine ---------- */
function findList() {
  const t = tr(), q = S.fq.trim().toLowerCase(), all = M.blocked, hit = q ? all.filter((b) => q.split(/\s+/).every((w) => (b.co + ' ' + b.t).toLowerCase().includes(w))) : all, show = hit.slice(0, q ? 40 : 8);
  if (!show.length) return `<p class="formula" style="margin-top:14px">${t.findNone}</p>`;
  return `<ul class="blist">${show.map((b) => `<li><div><b>${esc(b.t)}</b><span>${esc(b.co)} · ${regionName(b.region)}</span></div><p>${ic.lock}<span>${t.bGate[b.g]}${S.lang === 'en' ? ': ' : '：'}${esc(blockNote(b))}</span></p><a class="ib go" href="${safeUrl(b.url)}" target="_blank" rel="noopener" aria-label="${t.open}">${ic.ext}</a></li>`).join('')}</ul>${hit.length > show.length ? `<p class="note">${t.findMore(hit.length - show.length)}</p>` : ''}`;
}
function vEngine() {
  const t = tr(), D = S.data, A = D.archetypes, src = D.sources.slice().sort((a, b) => (a.ok === b.ok ? (b.kept - a.kept) || (b.count - a.count) : a.ok ? 1 : -1)), ok = src.filter((s) => s.ok && s.count).length;
  const tri = (k) => { const v = S.auth[k]; return `<div class="seg">${[['yes', true, t.yes], ['no', false, t.no], ['un', null, t.unsure]].map(([c, val, lab]) => `<button data-act="auth" data-k="${k}" data-v="${c}" class="${(v ?? null) === val ? 'on' : ''}">${lab}</button>`).join('')}</div>`; };
  return `<div class="wrap"><div class="head rise"><div><h1>${t.engH}</h1><p>${t.engP}</p></div></div>
    <div class="eng">
      <div class="card wide"><div class="steps">${t.steps.map(([a, b]) => `<div><b>${a}</b><p>${b}</p></div>`).join('')}</div>${S.mini ? funnelList() : funnelSVG()}</div>
      <div class="card"><h3>${t.prH}</h3><p class="formula">${t.prP}</p><div class="heat">${D.heat.slice(0, 5).map((h) => `<div>${moon(22, h.lit, T().c.moon)}<span>${heatName(h.key)}</span><b>${h.min}+</b></div>`).join('')}</div><p class="note">${t.focusLine(D.focusMin)}</p></div>
      <div class="card"><h3>${t.setH}</h3><p class="formula" style="margin-top:-12px;margin-bottom:8px">${t.setP}</p>${D.regions.map((k) => `<div class="set"><div><b>${t.authQ(regionName(k))}</b><span>${t.authHint}</span></div>${tri(k)}</div>`).join('')}</div>
      <div class="card wide"><h3>${t.archH}<span>${t.archP}</span></h3><div class="tscroll"><table class="arch"><thead><tr>${t.archCols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${Object.keys(A).map((k) => `<tr><td>${esc(archName(k))}</td><td class="mono">${A[k].base}%</td>${A[k].w.map((w) => `<td><div class="w"><i style="width:${w * 1.6}px"></i>${w}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
      <div class="card wide" id="find"><h3>${t.findH}<span>${t.findP(M.blocked.length)}</span></h3><label class="find" style="height:44px">${ic.search}<input type="search" data-inp="fq" value="${esc(S.fq)}" placeholder="${t.findPh}" aria-label="${t.findH}"></label><div id="flist">${findList()}</div></div>
      <div class="card wide"><h3>${t.srcH(src.length)}<span>${t.srcP(ok, D.counts.sourceErrors, D.counts.sourceEmpty)}${D.note && D.note.snapshot ? ' ' + t.srcSnap(D.note.firms, t.md(new Date(D.note.read))) : ''}</span></h3><div class="legend"><span><i></i>${t.srcOk}</span><span><i style="background:var(--ember)"></i>${t.srcErr}</span><span><i style="background:none;border:1px solid var(--faint)"></i>${t.srcZero}</span><span><i style="background:none;border:1px solid var(--accent)"></i>${t.srcNew}</span></div>
        <div class="src">${src.map((s) => `<div class="${!s.ok ? 'err' : s.probation && !s.count ? 'new' : !s.count ? 'zero' : ''}" title="${esc(s.error || '')}"><i></i><span>${esc(s.name || s.key)}${s.probation ? ' ·' : ''}</span><b>${s.count}${s.kept ? ' → ' + s.kept : ''}</b></div>`).join('')}</div></div>
    </div></div>`;
}

/* ---------- the role dossier ---------- */
function dossierHTML(r) {
  const t = tr(), D = S.data, A = D.archetypes[r.arch] || { w: [] }, why = whyOf(r), w = whenOf(r), inPipe = !!S.pipe[r.id], hidden = S.hidden.has(r.id), col = S.lang === 'en' ? ': ' : '：';
  const cd = M.cool.find((c) => c.key === r.key && c.s !== r.s), au = S.auth[r.region];
  const gates = r.gates.map((g, i) => { let [st, code, p] = g; if (i === 3) { st = au === true ? 'ok' : au === false ? 'stop' : 'ask'; code = au === true ? 'auth' : au === false ? 'authno' : 'authask'; } if (i === 6 && cd) { st = 'ask'; code = 'coolother'; p = t.md(ymd(cd.at) || new Date()); } const x = t.gate[code], note = typeof x === 'function' ? x(p) : x || ''; return `<li class="${st}"><i class="st">${st === 'ok' ? ic.ok : st === 'ask' ? ic.q : ic.stop}</i><b>${t.gateN[i]}</b><span>${esc(note)}</span></li>`; }).join('');
  const dt = (s) => (s ? t.mdy(ymd(s) || new Date(s)) : t.none);
  return `<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(r.t)}">
    <div class="dw-top"><span class="chip">${sectorName(r.s)}</span>${chips(r, 3)}${r.prog ? `<span class="chip">${t.tagProg}</span>` : ''}<span class="sp"></span><button class="ib" data-act="copy" title="${t.copy}" aria-label="${t.copy}">${ic.copy}</button><button class="ib" data-act="close" title="${t.close} (Esc)" aria-label="${t.close}">${ic.x}</button></div>
    <div class="dw-body">
      <h2>${esc(r.t)}</h2><div class="dw-co"><b style="font-weight:500;color:var(--ink)">${esc(r.co)}</b><span>·</span><span>${esc(place(r))}</span><span>·</span><span>${w[0]}${col}${w[1]}</span></div>
      <div class="dw-hero">${moon(72, r.lit, T().c.moon)}<div><span class="big metal">${r.pr}</span><em>${t.heatOf(heatName(r.heat), r.pr)} · ${t.rankOf(r.rank, M.pool.length)}</em><p>${t.prF(r.fit, r.lo, r.hi)}</p></div></div>
      <div class="dw-sec"><div class="kv"><span>${t.fit}</span><div class="bar"><i style="width:${r.fit}%"></i></div><b>${r.fit}</b><span>${t.odds}</span><div class="rng"><i style="left:${f(r.lo / 60 * 100)}%;width:${f(Math.max(2, (r.hi - r.lo) / 60 * 100))}%"></i></div><b>${r.lo}–${r.hi}%</b></div><p class="note">${esc(t.by(t.bands[r.band], archName(r.arch)))}</p></div>
      ${why.length ? `<div class="dw-sec"><h4>${t.dWhy}</h4><ul class="why">${why.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${r.hits && r.hits.length ? `<div class="dw-sec"><h4>${t.dHits}</h4><div class="tags">${r.hits.map((h) => `<span class="chip">${esc(tagName(h))}</span>`).join('')}</div></div>` : ''}
      <div class="dw-sec"><h4>${t.dGates}</h4><ul class="gates">${gates}</ul></div>
      <div class="dw-sec"><h4>${t.dSig}<span>${esc(t.dSigNote(archName(r.arch)))}</span></h4><div class="sig"><span class="hd">${t.dSigHd[0]}</span><span></span><i>${t.dSigHd[2]}</i><i>${t.dSigHd[3]}</i>${t.sigs.map((n, i) => `<span>${n}</span><div class="bar"><i style="width:${r.sig[i]}%"></i></div><b>${r.sig[i]}</b><i>${A.w[i] ?? ''}%</i>`).join('')}</div></div>
      <div class="dw-sec"><h4>${t.dDates}</h4><div class="kv" style="grid-template-columns:96px 1fr"><span>${t.posted}</span><span style="color:var(--ink)">${dt(r.posted)}</span><span>${t.firstSeen}</span><span style="color:var(--ink)">${dt(r.first)}</span><span>${t.deadline}</span><span style="color:var(--ink)">${dt(r.closes)}</span></div></div>
      ${r.ai ? `<div class="dw-sec"><h4>${t.dAi}</h4><p class="formula">${esc(r.ai)}</p></div>` : ''}
    </div>
    <div class="dw-foot"><a class="btn btn--primary" href="${safeUrl(r.url)}" target="_blank" rel="noopener">${t.open} ${ic.arrow}</a>${inPipe ? '' : `<button class="btn btn--secondary" data-act="apply" data-id="${esc(r.id)}">${t.applied}</button>`}${inPipe ? '' : hidden ? `<button class="btn btn--ghost" data-act="unhide" data-id="${esc(r.id)}">${t.unhide}</button>` : `<button class="btn btn--ghost" data-act="hide" data-id="${esc(r.id)}">${t.hide}</button>`}</div></aside>`;
}

/* ---------- command palette ---------- */
function palItems(q) {
  const t = tr(), w = q.trim().toLowerCase().split(/\s+/).filter(Boolean), has = (s) => w.every((x) => s.toLowerCase().includes(x));
  const cmds = [...ROUTES.map((r) => ({ k: 'go', v: r, b: t.cmdGo(t.nav[r]), i: ic.arrow })), { k: 'theme', b: t.cmdTheme, i: S.theme === 'dark' ? ic.sun : ic.moon }, { k: 'lang', b: t.cmdLang, i: ic.arrow }, { k: 'find', b: t.cmdFind, i: ic.lock }].filter((c) => !w.length || has(c.b));
  const roles = (w.length ? [...M.pool, ...M.hid].filter((r) => has(r.co + ' ' + r.t)) : M.focus).slice(0, 8).map((r) => ({ k: 'role', v: r.id, b: r.t, s: `${r.co} · ${place(r)}`, e: String(r.pr), i: moon(22, r.lit, T().c.moon) }));
  const blocked = w.length ? M.blocked.filter((b) => has(b.co + ' ' + b.t)).slice(0, 5).map((b) => ({ k: 'blocked', v: b.t, b: b.t, s: `${b.co} · ${t.bGate[b.g]}${S.lang === 'en' ? ': ' : '：'}${blockNote(b)}`, i: `<span class="lock">${ic.lock}</span>` })) : [];
  return [roles.length && { cap: t.palRoles }, ...roles, blocked.length && { cap: t.palBlocked }, ...blocked, cmds.length && { cap: t.palCmd }, ...cmds].filter(Boolean);
}
function palListHTML(items, on) { let i = -1; return items.length ? items.map((x) => (x.cap ? `<li class="cap" role="presentation">${x.cap}</li>` : `<li class="${++i === on ? 'on' : ''}" data-i="${i}" role="option"><span>${x.i || ''}</span><div><b>${esc(x.b)}</b>${x.s ? `<span>${esc(x.s)}</span>` : ''}</div><em>${x.e || ''}</em></li>`)).join('') : `<li class="cap">${tr().palNone}</li>`; }
function palHTML() { return `<div class="scrim" data-act="palclose"></div><div class="pal" role="dialog" aria-modal="true" aria-label="${tr().search}"><div class="q">${ic.search}<input type="text" id="palq" placeholder="${tr().search}" autocomplete="off" spellcheck="false"><kbd class="k">Esc</kbd></div><ul id="pall" role="listbox"></ul></div>`; }
