// app.js — state, the derived model, rendering, events and the start-up sequence.
// What you do on the page (applied, dismissed, pipeline stage, work authorization, theme, language) is kept in this browser's
// localStorage under the same "dc.*" keys the earlier versions used; nothing is sent anywhere.
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem('dc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dc.' + k, JSON.stringify(v)); } catch (e) { /* private window: keep going in memory */ } },
  raw(k) { try { return localStorage.getItem('dc.' + k); } catch (e) { return null; } },
  setRaw(k, v) { try { localStorage.setItem('dc.' + k, v); } catch (e) { /* same */ } },
};
const QS = new URLSearchParams(location.search), DATA_URL = QS.get('data') || 'data/radar.json', REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const today = () => new Date().toLocaleDateString('en-CA');
const S = {
  lang: LS.raw('lang') === 'en' ? 'en' : 'zh',
  theme: (() => { const v = LS.raw('theme'); return v === 'light' || v === '"light"' ? 'light' : v ? 'dark' : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; })(),
  route: 'today', open: null, sel: null, data: null, played: false, mini: innerWidth < 640, tReg: '', fq: '', pal: null,
  applied: LS.get('applied', {}) || {}, hidden: new Set(LS.get('hidden', []) || []), pipe: LS.get('pipe', {}) || {}, auth: LS.get('auth', {}) || {},
  rf: { group: 'region', region: '', grp: '', cos: [], sector: '', onlyNew: false, stretch: true, sort: 'pr', ...(LS.get('rolesView', {}) || {}), q: '', hidden: false, moreCo: false },
};
let M = { pool: [], core: [], stretch: [], hid: [], focus: [], fresh: [], blocked: [], cool: [], pipeN: 0 };

/* ---------- the model: what the scan found, minus what you already dealt with ---------- */
function model() {
  const D = S.data, now = Date.now();
  const cool = Object.values(S.pipe).filter((p) => p.s === 'no' && p.key && p.at).map((p) => ({ key: p.key, s: p.sec, co: p.co, at: p.at, until: (ymd(p.at) || new Date()).getTime() + 365 * 864e5 })).filter((c) => c.until > now);
  const pool = [], hid = [], mine = [];
  for (const r of D.roles) {
    if (S.pipe[r.id]) continue;
    if (S.auth[r.region] === false) { mine.push({ id: r.id, k: r.key, co: r.co, t: r.t, url: r.url, region: r.region, g: 4, n: ['auth'] }); continue; }
    const cd = cool.find((c) => c.key === r.key && c.s === r.s);
    if (cd) { mine.push({ id: r.id, k: r.key, co: r.co, t: r.t, url: r.url, region: r.region, g: 8, n: ['cool', tr().md(ymd(cd.at) || new Date()), tr().mdy(new Date(cd.until))] }); continue; }
    (S.hidden.has(r.id) ? hid : pool).push(r);
  }
  pool.forEach((r, i) => { r.rank = i + 1; });
  const core = pool.filter((r) => !r.st);
  if (!Array.isArray(S.rf.cos)) S.rf.cos = [];
  M = { pool, core, stretch: pool.filter((r) => r.st), hid, focus: core.filter((r) => r.pr >= D.focusMin), fresh: core.filter((r) => r.fresh), blocked: [...mine, ...D.blocked], cool, pipeN: Object.keys(S.pipe).length };
}
const roleById = (id) => S.data.roles.find((r) => r.id === id);
const handAngle = () => Math.max(4, Math.min(356, (Date.now() - new Date(S.data.generatedAt).getTime()) / (3 * 36e5) * 360));
function savePipe() { LS.set('pipe', S.pipe); LS.set('applied', S.applied); }
/* applications marked in earlier versions only stored an id and a date: carry them into the pipeline, naming what can still be named */
function migrate() {
  let changed = false; const unknown = [];
  for (const [id, at] of Object.entries(S.applied)) { if (S.pipe[id]) continue; const r = roleById(id); S.pipe[id] = r ? { s: 'sent', at: String(at).slice(0, 10), co: r.co, key: r.key, t: r.t, url: r.url, region: r.region, sec: r.s } : { s: 'sent', at: String(at).slice(0, 10), key: id.split(':')[0] }; if (!r) unknown.push(id); changed = true; }
  if (changed) LS.set('pipe', S.pipe);
  const need = Object.entries(S.pipe).filter(([, p]) => !p.t).map(([id]) => id);
  if (need.length && /radar\.json/.test(DATA_URL)) fetch(DATA_URL.replace('radar.json', 'jobs.json')).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!j) return; let hit = false; for (const id of need) { const x = (j.jobs || []).find((y) => y.id === id); if (x) { Object.assign(S.pipe[id], { co: x.company, key: x.companyKey, t: x.title, url: x.url }); hit = true; } } if (hit) { LS.set('pipe', S.pipe); render(); } }).catch(() => {});
}

/* ---------- theme ---------- */
function applyTheme() { const Th = THEMES[S.theme], h = document.documentElement; h.dataset.theme = S.theme; h.lang = S.lang === 'en' ? 'en' : 'zh-Hans'; for (const [k, v] of Object.entries(Th.vars)) h.style.setProperty('--' + k, v); const m = $('meta[name=theme-color]'); if (m) m.content = Th.vars.base; document.title = STR[S.lang].title; }

/* ---------- render ---------- */
const VIEWS = { today: vToday, roles: vRoles, pipe: vPipe, engine: vEngine };
function render() {
  if (!S.data) return;
  model(); applyTheme();
  $('#nav').innerHTML = navHTML();
  $('#main').innerHTML = VIEWS[S.route]() + footHTML();
  drawDrawer(); afterRender();
}
function afterRender() {
  fitDial();
  const box = $('.dialbox');
  if (box) {
    const target = handAngle();
    if (S.played || REDUCED) box.style.setProperty('--sw', target + 'deg');
    else { S.played = true; const t0 = performance.now(), dur = 2200, from = target - 360; box.style.setProperty('--sw', from + 'deg');
      const tick = (t) => { const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3); box.style.setProperty('--sw', (from + 360 * e) + 'deg'); if (u < 1 && box.isConnected) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      $$('[data-count]').forEach((el) => { const n = +el.dataset.count, c0 = performance.now(); const step = (t) => { const u = Math.min(1, (t - c0) / 900); el.textContent = Math.round(n * (1 - Math.pow(1 - u, 3))); if (u < 1 && el.isConnected) requestAnimationFrame(step); }; if (n > 3) requestAnimationFrame(step); }); }
  }
  if (S.sel && !$(`.row[data-id="${CSS.escape(S.sel)}"]`)) S.sel = null;
}
/* the dial's scale is known before it is drawn (so it is never painted at the wrong size), then checked against the real box */
function dialK() { const vw = document.documentElement.clientWidth, wrapW = Math.min(1280, vw - 2 * (matchMedia('(max-width:820px)').matches ? 16 : 32)), col = matchMedia('(max-width:1040px)').matches ? Math.min(wrapW, 860) : wrapW - 420; return f(Math.max(.2, Math.min(1, col / (860 - (S.mini ? 192 : 0))))); }
function fitDial() { const w = $('.dialwrap'); if (!w) return; const k = f(Math.max(.2, Math.min(1, w.clientWidth / (860 - (S.mini ? 192 : 0))))); if (String(k) !== w.dataset.k) { w.style.setProperty('--k', k); w.dataset.k = k; } w.style.setProperty('--ox', S.mini ? 96 : 0); }
function drawDrawer() {
  let host = $('#drawer'); const r = S.open ? roleById(S.open) : null;
  if (!r) { if (host.innerHTML) { host.innerHTML = ''; document.body.style.overflow = ''; if (S.lastFocus && S.lastFocus.isConnected) S.lastFocus.focus({ preventScroll: true }); } return; }
  const was = !!host.innerHTML; host.innerHTML = dossierHTML(r); document.body.style.overflow = 'hidden';
  if (was) { const d = $('.drawer', host); d.style.animation = 'none'; $('.scrim', host).style.animation = 'none'; }
  const c = $('.drawer [data-act=close]', host); if (c && !was) c.focus({ preventScroll: true });
}

/* ---------- routing: #/screen or #/screen/<role id> ---------- */
function parseHash() { const p = location.hash.replace(/^#\/?/, '').split('/'), r = ROUTES.includes(p[0]) ? p[0] : p[0] === 'pipeline' ? 'pipe' : 'today', open = p[1] ? decodeURIComponent(p.slice(1).join('/')) : null; return { r, open }; }
function onHash() { const { r, open } = parseHash(), moved = r !== S.route; S.route = r; S.open = open && S.data && roleById(open) ? open : null; if (moved) { S.sel = null; render(); scrollTo(0, 0); } else drawDrawer(); if (moved || !open) $$('.nav-words a, .tabbar a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#/' + S.route)); }
const go = (r) => { location.hash = '#/' + r; };
function openRole(id) { if (!roleById(id)) return; S.lastFocus = document.activeElement; S.sel = id; markSel(); location.hash = '#/' + S.route + '/' + encodeURIComponent(id); }
function closeRole() { if (S.open) location.hash = '#/' + S.route; }

/* ---------- actions ---------- */
let toastTimer = 0;
function toast(text, undo) { let el = $('.toast'); if (el) el.remove(); el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.innerHTML = `<span>${esc(text)}</span>${undo ? `<button type="button">${tr().undo}</button>` : ''}`; document.body.appendChild(el); if (undo) $('button', el).onclick = () => { undo(); el.remove(); }; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 5200); }
function nextSel(id) { const rows = $$('.row[data-id]'), i = rows.findIndex((r) => r.dataset.id === id), n = rows[i + 1] || rows[i - 1]; return n ? n.dataset.id : null; }
function apply(id) { const r = roleById(id); if (!r || S.pipe[id]) return; const nx = nextSel(id), at = today(); S.pipe[id] = { s: 'sent', at, co: r.co, key: r.key, t: r.t, url: r.url, region: r.region, sec: r.s }; S.applied[id] = at; savePipe(); S.sel = nx; if (S.open === id) closeRole(); render(); toast(tr().tApplied(r.co), () => { delete S.pipe[id]; delete S.applied[id]; savePipe(); render(); }); }
function hide(id, on = true) { const r = roleById(id); if (!r) return; const nx = nextSel(id); if (on) S.hidden.add(id); else S.hidden.delete(id); LS.set('hidden', [...S.hidden]); S.sel = on ? nx : id; if (S.open === id && on) closeRole(); render(); toast(on ? tr().tHidden(r.co) : tr().tBack, on ? () => hide(id, false) : null); }
function setRf(patch) { Object.assign(S.rf, patch); const { q, hidden, moreCo, ...keep } = S.rf; LS.set('rolesView', keep); }
/* the Roles filters redraw themselves without touching the search box while it is being typed in */
function drawRoles(keepFilters) { if (S.route !== 'roles') return render(); if (!keepFilters) $('#rfilters').innerHTML = filtersHTML(); $('#rlist').innerHTML = rolesList(); const h = $('.head h1'); if (h) h.textContent = tr().rolesH(M.core.length, M.stretch.length); markSel(); }
function act(name, el, ev) {
  const v = el.dataset.v, row = el.closest('.row[data-id]'), id = el.dataset.id || (row && row.dataset.id) || S.open;
  switch (name) {
    case 'pal': openPal(); break;
    case 'palclose': closePal(); break;
    case 'theme': if (v !== S.theme) { S.theme = v; LS.setRaw('theme', v); render(); } break;
    case 'lang': if (v !== S.lang) { S.lang = v; LS.setRaw('lang', v); render(); } break;
    case 'apply': ev.stopPropagation(); apply(id); break;
    case 'hide': ev.stopPropagation(); hide(id, true); break;
    case 'unhide': ev.stopPropagation(); hide(id, false); break;
    case 'close': closeRole(); break;
    case 'copy': { const r = roleById(S.open); if (r && navigator.clipboard) navigator.clipboard.writeText(r.url).then(() => toast(tr().copied), () => {}); break; }
    case 'reg': setRf({ region: v, grp: '', cos: [] }); go('roles'); break;
    case 'treg': S.tReg = v; render(); break;
    case 'find': ev.preventDefault(); S.fq = el.dataset.q || ''; if (S.route !== 'engine') go('engine'); else render(); setTimeout(() => { const f0 = $('#find'); if (f0) { f0.scrollIntoView({ block: 'start' }); const i = $('input', f0); if (i && !el.dataset.q) i.focus({ preventScroll: true }); } }, 60); break;
    case 'rgroup': setRf({ group: v }); drawRoles(); break;
    case 'rreg': setRf({ region: v }); drawRoles(); break;
    case 'rgrp': setRf({ grp: v, cos: [] }); drawRoles(); break;
    case 'rco': { const ks = v ? v.split(',') : [], on = ks.length && ks.every((k) => S.rf.cos.includes(k)); setRf({ cos: !ks.length ? [] : on ? S.rf.cos.filter((k) => !ks.includes(k)) : [...new Set([...S.rf.cos, ...ks])] }); drawRoles(); break; }
    case 'rmore': S.rf.moreCo = !S.rf.moreCo; drawRoles(); break;
    case 'rstretch': setRf({ stretch: !S.rf.stretch }); drawRoles(); break;
    case 'rnew': setRf({ onlyNew: !S.rf.onlyNew }); drawRoles(); break;
    case 'rhid': S.rf.hidden = !S.rf.hidden; drawRoles(); break;
    case 'rclear': setRf({ region: '', grp: '', cos: [], sector: '', onlyNew: false, q: '', hidden: false }); drawRoles(); break;
    case 'stage': { const p = S.pipe[el.dataset.id]; if (p) { p.s = v; if (v === 'no' && !p.no) p.no = today(); savePipe(); render(); toast(tr().tStage(tr().stages[v])); } break; }
    case 'prm': { const pid = el.dataset.id, old = S.pipe[pid]; delete S.pipe[pid]; delete S.applied[pid]; savePipe(); render(); toast(tr().tRemoved, () => { S.pipe[pid] = old; savePipe(); render(); }); break; }
    case 'auth': { const k = el.dataset.k; if (v === 'un') delete S.auth[k]; else S.auth[k] = v === 'yes'; LS.set('auth', S.auth); render(); break; }
    default: break;
  }
}

/* ---------- command palette ---------- */
function openPal() { if (S.pal) return; S.pal = { on: 0, items: [] }; const host = $('#pal'); host.innerHTML = palHTML(); const q = $('#palq'); const draw = () => { S.pal.items = palItems(q.value); S.pal.on = Math.min(S.pal.on, Math.max(0, S.pal.items.filter((x) => !x.cap).length - 1)); $('#pall').innerHTML = palListHTML(S.pal.items, S.pal.on); const on = $('#pall .on'); if (on) on.scrollIntoView({ block: 'nearest' }); }; q.oninput = () => { S.pal.on = 0; draw(); }; S.pal.draw = draw; draw(); q.focus(); }
function closePal() { S.pal = null; $('#pal').innerHTML = ''; }
function runPal(i) { const x = S.pal.items.filter((y) => !y.cap)[i]; if (!x) return; closePal(); if (x.k === 'role') openRole(x.v); else if (x.k === 'go') go(x.v); else if (x.k === 'theme') act('theme', { dataset: { v: S.theme === 'dark' ? 'light' : 'dark' }, closest: () => null }, null); else if (x.k === 'lang') act('lang', { dataset: { v: S.lang === 'zh' ? 'en' : 'zh' }, closest: () => null }, null); else if (x.k === 'find' || x.k === 'blocked') { S.fq = x.k === 'blocked' ? x.v : ''; if (S.route !== 'engine') go('engine'); else render(); setTimeout(() => { const f0 = $('#find'); if (f0) f0.scrollIntoView({ block: 'start' }); }, 80); } }

/* ---------- selection and keyboard ---------- */
function markSel() { $$('.row.sel').forEach((r) => r.classList.remove('sel')); if (!S.sel) return; const r = $(`.row[data-id="${CSS.escape(S.sel)}"]`); if (r) r.classList.add('sel'); }
function moveSel(d) { const rows = $$('.row[data-id]'); if (!rows.length) return; let i = rows.findIndex((r) => r.dataset.id === S.sel); i = i < 0 ? (d > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + d)); S.sel = rows[i].dataset.id; markSel(); rows[i].scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' }); if (S.open) openRole(S.sel); hot(S.sel); }
function hot(id) { $$('.dialbox .m.hot').forEach((m) => m.classList.remove('hot')); if (!id) return; const m = $(`.dialbox .m[data-id="${CSS.escape(id)}"]`); if (m) m.classList.add('hot'); }
function onKey(e) {
  const k = e.key, typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
  if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === 'k') { e.preventDefault(); S.pal ? closePal() : openPal(); return; }
  if (S.pal) { const n = S.pal.items.filter((x) => !x.cap).length; if (k === 'Escape') { e.preventDefault(); closePal(); } else if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); S.pal.on = (S.pal.on + (k === 'ArrowDown' ? 1 : -1) + n) % Math.max(1, n); S.pal.draw(); } else if (k === 'Enter') { e.preventDefault(); runPal(S.pal.on); } return; }
  if (k === 'Escape') { if (S.open) { e.preventDefault(); closeRole(); } else if (typing) e.target.blur(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const lk = k.toLowerCase();
  if (lk === 'j' || k === 'ArrowDown') { e.preventDefault(); moveSel(1); } else if (lk === 'k' || k === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
  else if (k === 'Enter' && S.sel && !e.target.closest('a,button')) { e.preventDefault(); S.open ? window.open(roleById(S.sel).url, '_blank', 'noopener') : openRole(S.sel); }
  else if (lk === 'a' && (S.open || S.sel)) { e.preventDefault(); apply(S.open || S.sel); } else if (lk === 'x' && (S.open || S.sel)) { e.preventDefault(); hide(S.open || S.sel, !S.hidden.has(S.open || S.sel)); }
  else if (k === '/') { e.preventDefault(); openPal(); } else if (/^[1-4]$/.test(k)) go(ROUTES[+k - 1]); else if (lk === 't') act('theme', { dataset: { v: S.theme === 'dark' ? 'light' : 'dark' }, closest: () => null }, null);
}

/* ---------- events ---------- */
function wire() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]'); if (a) { act(a.dataset.act, a, e); return; }
    const pl = e.target.closest('#pall li[data-i]'); if (pl) { runPal(+pl.dataset.i); return; }
    const m = e.target.closest('.dialbox .m'); if (m) { openRole(m.dataset.id); return; }
    const th = e.target.closest('.dialbox .th'); if (th) { const k = th.dataset.go; if (k === 'focus') { const el = $('#focus'); if (el) el.scrollIntoView({ block: 'start' }); } else go(k === 'pipe' ? 'pipe' : 'roles'); return; }
    const sn = e.target.closest('.dialbox .sn'); if (sn) { setRf({ sector: sn.dataset.sector, region: '', grp: '', cos: [] }); go('roles'); return; }
    const row = e.target.closest('.row[data-id]'); if (row && !e.target.closest('a,button')) openRole(row.dataset.id);
  });
  document.addEventListener('input', (e) => { const k = e.target.dataset.inp; if (k === 'rq') { S.rf.q = e.target.value; drawRoles(true); } else if (k === 'fq') { S.fq = e.target.value; $('#flist').innerHTML = findList(); } });
  document.addEventListener('change', (e) => { const k = e.target.dataset.chg; if (k === 'rsector') { setRf({ sector: e.target.value }); drawRoles(); } else if (k === 'rsort') { setRf({ sort: e.target.value }); drawRoles(); } });
  document.addEventListener('submit', (e) => { const fm = e.target.closest('[data-form=padd]'); if (!fm) return; e.preventDefault(); const d = Object.fromEntries(new FormData(fm)), src = S.data.sources.find((s) => s.name === d.co) || S.data.roles.find((r) => r.co === d.co) || {}; if (!d.co.trim() || !d.t.trim()) return; S.pipe['manual:' + Date.now()] = { s: d.s, at: d.at || today(), co: d.co.trim(), key: src.key || d.co.trim().toLowerCase(), t: d.t.trim(), sec: d.sec, manual: true }; savePipe(); render(); toast(tr().tApplied(d.co.trim())); });
  document.addEventListener('keydown', onKey);
  // the dial: a card follows the pointer over a moon, and hovering a row lights its moon
  const tipFor = (m) => { const tip = $('.tip'), w = $('.dialwrap'); if (!tip || !w) return; if (!m) { tip.classList.remove('on'); return; } const r = roleById(m.dataset.id); if (!r) return; const c = m.querySelector('circle:last-child'), k = +w.dataset.k || 1, ox = S.mini ? 96 : 0, x = (+c.getAttribute('cx') - ox) * k, y = +c.getAttribute('cy') * k;
    tip.innerHTML = `<b>${esc(r.t)}</b><span>${esc(r.co)} · ${esc(place(r))}</span><i><span>${pad2(r.rank)}</span><span>${tr().fit} ${r.fit}</span><span>${r.lo}–${r.hi}%</span><span>${heatName(r.heat)}</span></i>`;
    const tw = Math.min(300, Math.max(220, tip.offsetWidth)); tip.style.left = Math.max(0, Math.min(w.clientWidth - tw, x - tw / 2)) + 'px'; tip.style.top = (y + 18 * k + 8) + 'px'; tip.classList.add('on'); };
  document.addEventListener('mouseover', (e) => { const m = e.target.closest && e.target.closest('.dialbox .m'); if (m) { tipFor(m); return; } const row = e.target.closest && e.target.closest('.row[data-id]'); if (row) hot(row.dataset.id); });
  document.addEventListener('mouseout', (e) => { const m = e.target.closest && e.target.closest('.dialbox .m'); if (m && !(e.relatedTarget && m.contains(e.relatedTarget))) tipFor(null); const row = e.target.closest && e.target.closest('.row[data-id]'); if (row && !(e.relatedTarget && row.contains(e.relatedTarget))) hot(null); });
  addEventListener('hashchange', onHash);
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const mini = innerWidth < 640; if (mini !== S.mini) { S.mini = mini; render(); } else fitDial(); }, 80); });
  addEventListener('pagehide', () => LS.set('lastVisit', new Date().toISOString()));
}

/* ---------- data ---------- */
async function fetchData(first) {
  try { const r = await fetch(DATA_URL + (DATA_URL.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 6e4), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (!j || j.version !== 6 || !Array.isArray(j.roles)) throw new Error('not a v6 radar file'); return j; }
  catch (e) { const el = $('#dc-data'); if (first && el && el.textContent.trim().length > 2) return JSON.parse(el.textContent); throw e; }
}
async function start() {
  applyTheme(); wire();
  const main = $('#main'); main.innerHTML = `<div class="wrap"><div class="empty" style="padding:120px 0">${tr().loading}</div></div>`;
  try { S.data = await fetchData(true); } catch (e) { main.innerHTML = `<div class="wrap"><div class="empty" style="padding:120px 0"><b>${tr().loadFail[0]}</b>${tr().loadFail[1]}<div style="margin-top:18px"><button class="btn btn--secondary btn--sm" onclick="location.reload()">${tr().retry}</button></div></div></div>`; return; }
  const h = parseHash(); S.route = h.r; migrate(); S.open = h.open && roleById(h.open) ? h.open : null; render();
  // keep the hand moving with the clock, and pick up a new scan when one lands
  setInterval(() => { const box = $('.dialbox'); if (box && S.played) box.style.setProperty('--sw', handAngle() + 'deg'); }, 30000);
  const refresh = async () => { if (document.hidden) return; try { const j = await fetchData(false); if (j.generatedAt !== S.data.generatedAt) { S.data = j; render(); toast(tr().tData); } } catch (e) { /* offline: keep what we have */ } };
  setInterval(refresh, 5 * 6e4); document.addEventListener('visibilitychange', refresh);
}
start();
