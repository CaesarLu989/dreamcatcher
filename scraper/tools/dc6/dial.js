// dial.js — the Compass「晕」. A fluted silver bezel with two gold lines, a dark sunburst dial, and a deep-blue ring of light
// around it. Every role is a moon: sector = role family, distance from the centre = fit, size and lit fraction = priority.
// Blue-lit moons are the ones to look at first, silver-lit ones are the rest. Tonight's real moon rides the bezel as the hand.
// The artboard is 860 x 812 with the dial centred at (430, 330); the page scales the whole box.
const DG = { W: 860, H: 812, cx: 430, cy: 330, Rd: 252, Ri: 260, Ro: 286 }, DEG = Math.PI / 180;
const rOf = (fit) => 236 - (Math.max(56, Math.min(100, fit)) - 60) / 40 * 196, pad2 = (n) => String(n).padStart(2, '0'), P2 = (p) => `${f(p[0])},${f(p[1])}`;
const dotR = (pr) => (pr >= 90 ? 11 : pr >= 78 ? 9.5 : pr >= 66 ? 8 : pr >= 52 ? 5.6 : 4.6);

/* polar positions, relaxed in 2-D so that moons (and their rings) do not touch. roles: [{ s, fit, pr, fresh, soon }], sectors: [[key, name]] */
function dialLayout(roles, sectors, focusMin) {
  const P = [], k = Math.max(.62, Math.min(1, Math.sqrt(64 / Math.max(1, roles.length))));
  sectors.forEach(([key], i) => {
    const rs = roles.filter((r) => r.s === key).sort((a, b) => b.fit - a.fit || b.pr - a.pr), c = i * 45 + 22.5;
    rs.forEach((r, j) => { const dot = dotR(r.pr) * k, rad = rOf(r.fit); P.push({ r, c, rad0: rad, rad, a: c + (((j * .618 + .31) % 1) - .5) * 33, dot, z: dot + (r.pr >= focusMin || r.fresh || r.soon ? 5.5 * k : 0) }); });
  });
  const clamp = (p) => { p.rad = Math.max(Math.max(58 + p.z, p.rad0 - 14), Math.min(Math.min(241 - p.z, p.rad0 + 14), p.rad)); const w = Math.asin(Math.min(1, (p.z + 3) / p.rad)) / DEG, w2 = Math.asin(Math.min(1, 12 / p.rad)) / DEG; p.a = Math.max(p.c - 22.5 + w + (p.c < 45 ? w2 : 0), Math.min(p.c + 22.5 - w - (p.c > 315 ? w2 : 0), p.a)); };
  P.forEach(clamp);
  for (let it = 0; it < 320; it++) for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const p = P[i], q = P[j]; if (p.c !== q.c && Math.abs(p.c - q.c) !== 45 && Math.abs(p.c - q.c) !== 315) continue;
    const a = polar(0, 0, p.rad, p.a), b = polar(0, 0, q.rad, q.a); let dx = a[0] - b[0], dy = a[1] - b[1], d = Math.hypot(dx, dy); const need = p.z + q.z + 4;
    if (d < need) { if (d < .01) { dx = (i % 2 ? 1 : -1); dy = .3; d = 1; } const m = (need - d) / 2 / d * .6;
      for (const [pt, xy, sg] of [[p, a, 1], [q, b, -1]]) { const x = xy[0] + sg * dx * m, y = xy[1] + sg * dy * m; pt.rad = Math.hypot(x, y); pt.a = ((Math.atan2(x, -y) / DEG) + 360) % 360; clamp(pt); } }
  }
  return P;
}

const lgr = (gid, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((s, i) => `<stop offset="${f(i / (stops.length - 1))}" stop-color="${s}"/>`).join('')}</linearGradient>`;
const ringMask = (r0, r1) => `radial-gradient(circle at center, transparent ${f(r0 - .7)}px, #000 ${f(r0)}px, #000 ${f(r1 - .7)}px, transparent ${f(r1)}px)`;
const ringDiv = (r0, r1, bg, extra = '') => `<div style="left:${f(DG.cx - r1)}px;top:${f(DG.cy - r1)}px;width:${f(2 * r1)}px;height:${f(2 * r1)}px;border-radius:50%;background:${bg};-webkit-mask:${ringMask(r0, r1)};mask:${ringMask(r0, r1)};${extra}"></div>`;
const discDiv = (r, bg, extra = '') => `<div style="left:${DG.cx - r}px;top:${DG.cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:${bg};${extra}"></div>`;
const svgOpen = (cls = '') => `<svg class="${cls}" width="${DG.W}" height="${DG.H}" viewBox="0 0 ${DG.W} ${DG.H}" style="left:0;top:0;overflow:visible">`;
const conicGold = (g, from = 315) => `conic-gradient(from ${from}deg, ${g[0]}, ${g[2]} 11%, ${g[4]} 24%, ${g[1]} 37%, ${g[0]} 50%, ${g[2]} 61%, ${g[4]} 74%, ${g[1]} 88%, ${g[0]})`;
const sunburst = (s, dark) => `repeating-conic-gradient(${dark ? 'rgba(255,255,255,.04)' : 'rgba(60,70,90,.035)'} 0deg .35deg, rgba(255,255,255,0) .35deg .9deg), radial-gradient(circle, rgba(0,0,0,0) 40%, ${dark ? 'rgba(0,0,0,.36)' : 'rgba(110,120,140,.2)'} 100%), conic-gradient(from 18deg, ${s[0]} 0%, ${s[2]} 8%, ${s[1]} 17%, ${s[2]} 25%, ${s[0]} 33%, ${s[2]} 44%, ${s[1]} 54%, ${s[2]} 66%, ${s[0]} 75%, ${s[2]} 87%, ${s[0]} 100%)`;
/* a moon as a mark: `lit` 0…1 of the disc is bright, tilted like the real one */
const moonG = (x, y, R, lit, fill, body, edge, rot = -22) => { const k = Math.abs(1 - 2 * lit) * R, d = lit >= .995 ? `M${f(x - R)},${f(y)}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0` : `M${f(x)},${f(y - R)}A${R},${R} 0 0,1 ${f(x)},${f(y + R)}A${f(k)},${R} 0 0,${lit > .5 ? 1 : 0} ${f(x)},${f(y - R)}Z`;
  return `<g transform="rotate(${rot} ${f(x)} ${f(y)})"><circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="${body}" stroke="${edge}" stroke-width=".9"/><path d="${d}" fill="${fill}"/></g>`; };
const glint = (x, y, s, col, op = 1) => `<path d="M${f(x)},${f(y - s)}Q${f(x)},${f(y)} ${f(x + s)},${f(y)}Q${f(x)},${f(y)} ${f(x)},${f(y + s)}Q${f(x)},${f(y)} ${f(x - s)},${f(y)}Q${f(x)},${f(y)} ${f(x)},${f(y - s)}Z" fill="${col}" opacity="${op}"/>`;
/* a cut stone seen from above: four facets around the centre. m = [light, mid, mid-dark, dark] */
const gem = (x, y, w, h, m, rot = 0) => `<g${rot ? ` transform="rotate(${f(rot)} ${f(x)} ${f(y)})"` : ''}><path d="M${f(x)},${f(y - h)}L${f(x - w)},${f(y)}L${f(x)},${f(y)}Z" fill="${m[0]}"/><path d="M${f(x)},${f(y - h)}L${f(x + w)},${f(y)}L${f(x)},${f(y)}Z" fill="${m[1]}"/><path d="M${f(x)},${f(y + h)}L${f(x - w)},${f(y)}L${f(x)},${f(y)}Z" fill="${m[2]}"/><path d="M${f(x)},${f(y + h)}L${f(x + w)},${f(y)}L${f(x)},${f(y)}Z" fill="${m[3]}"/></g>`;
const litNow = (t) => (1 - Math.cos(phaseAngle(t) * DEG)) / 2;

/* dial(T, M, o) → HTML for the inside of .dialbox.
   M: { roles, sectors, focusMin, pipeN, now, L: { focus, total, sent, n(count), blue, silver, full, fresh, soon, tonight } }
   o: { mini (no sector names, no legend), sweepFrom (degrees the hand starts from; the page animates --sw), dur (seconds of the opening turn) }
   Everything that turns with the hand is drawn pointing at 12 o'clock inside <g class="rot"> and rotated by the CSS variable --sw. */
function dial(T, M, o = {}) {
  const c = T.c, id = nid('cy'), dark = T.name === 'dark', big = o.mini ? 1.6 : 1, { cx, cy, Rd, Ri, Ro } = DG, g = c.gold, sv = c.silver, bl = c.blue, L = M.L, fm = M.focusMin;
  const pts = dialLayout(M.roles, M.sectors, fm).map((p) => ({ ...p, xy: polar(cx, cy, p.rad, p.a) })), focusN = M.roles.filter((r) => r.pr >= fm).length;
  // when the hand passes each moon on its opening turn (seconds); 0 when there is no opening turn
  const dur = o.dur || 0, target = o.target ?? 0, tOf = (a) => { if (!dur) return 0; const a1 = a <= target ? a : a - 360, p = Math.max(0, Math.min(1, (a1 - (target - 360)) / 360)); return f((1 - Math.cbrt(1 - p)) * dur + .05); };
  const defs = lgr(id + 'au', [g[0], g[1], g[2], g[3]]) + lgr(id + 'ag', [sv[0], sv[1], sv[2], sv[3]]) + lgr(id + 'n', c.num, 0, 0, 0, 1) + lgr(id + 'mf', c.litF) + lgr(id + 'mo', c.litO)
    + `<radialGradient id="${id}g2"><stop offset="0" stop-color="${c.halo}"/><stop offset="1" stop-color="${c.halo}" stop-opacity="0"/></radialGradient><clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${Rd}"/></clipPath>
      <filter id="${id}sh" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="16"/></filter><filter id="${id}b4"><feGaussianBlur stdDeviation="4"/></filter>`;
  const facets = dark ? [sv[0], sv[2], sv[1], sv[3]] : [sv[1], sv[3], sv[2], sv[4]], gfac = [g[0], g[2], g[1], g[3]];

  /* ---- behind the bezel: the ring of light. A deep-blue corona, fine rays, and a brighter arc that follows the hand ---- */
  const R0 = Ro + 1.5, R = rnd(31), k0 = R0 / (R0 + 104);
  let cor = `<radialGradient id="${id}co"><stop offset="${f(k0 - .025)}" stop-color="${c.cor[0]}" stop-opacity="0"/><stop offset="${f(k0)}" stop-color="${c.cor[0]}" stop-opacity="${c.corOp[0]}"/><stop offset="${f(k0 + .09)}" stop-color="${c.cor[1]}" stop-opacity="${c.corOp[1]}"/><stop offset="${f(k0 + .32)}" stop-color="${c.cor[2]}" stop-opacity="${c.corOp[2]}"/><stop offset="1" stop-color="${c.cor[2]}" stop-opacity="0"/></radialGradient><circle class="glow" cx="${cx}" cy="${cy}" r="${R0 + 104}" fill="url(#${id}co)"/><g class="rays">`;
  for (let i = 0; i < 180; i++) { const a = i * 2 + (R() - .5) * 1.5, eq = Math.pow(Math.abs(Math.sin(a * DEG)), 1.5), len = 5 + 22 * eq * R() + 9 * R(), op = (dark ? .26 : .3) + .5 * R();
    for (let q = 0; q < 3; q++) { const p0 = polar(cx, cy, R0 + 1.5 + len * q / 3, a), p1 = polar(cx, cy, R0 + 1.5 + len * (q + 1) / 3, a); cor += `<path d="M${P2(p0)}L${P2(p1)}" stroke="${c.ray[q]}" stroke-width="${f(1.5 - q * .35)}" opacity="${f(op * (1 - q * .3))}"/>`; } }
  cor += `</g><circle cx="${cx}" cy="${cy}" r="${R0 + .8}" fill="none" stroke="${c.ray[dark ? 0 : 1]}" stroke-width="1.4" opacity=".85"/><g class="rot">`;
  for (let k = 0; k < 120; k++) { const a1 = -k, u = k / 120, p0 = polar(cx, cy, R0 + 1.5, a1 - 1.3), p1 = polar(cx, cy, R0 + 1.5, a1); cor += `<path d="M${P2(p0)}A${R0 + 1.5},${R0 + 1.5} 0 0,1 ${P2(p1)}" fill="none" stroke="${dark ? mix('#FFFFFF', c.ray[1], u) : mix(c.ray[0], c.ray[2], u)}" stroke-width="${f(5.5 * (1 - u) + 1)}" opacity="${f(.95 * Math.pow(1 - u, 1.3))}"/>`; }
  cor += '</g>';
  const back = svgOpen('back') + `<defs>${defs}</defs>` + cor + `<circle cx="${cx}" cy="${cy + 20}" r="${Ro - 8}" fill="${c.shadow}" filter="url(#${id}sh)"/></svg>`;
  const veil = `<div class="veil" style="left:150px;top:-40px;width:520px;height:150px;border-radius:50%;background:radial-gradient(closest-side, ${c.veil[0]}, rgba(0,0,0,0));filter:blur(24px);opacity:.7"></div><div class="veil v2" style="left:300px;top:-56px;width:440px;height:170px;border-radius:50%;background:radial-gradient(closest-side, ${c.veil[1]}, rgba(0,0,0,0));filter:blur(26px);opacity:.7"></div>`;

  /* ---- the bezel: silver flutes with a sheen, a gold line inside and outside ---- */
  const flutes = ringDiv(Ri, Ro - 2, `repeating-conic-gradient(from 0deg, ${sv[0]} 0deg, ${sv[2]} .8deg, ${sv[4]} 1.45deg, ${sv[3]} 2.1deg, ${sv[0]} 3deg)`) + ringDiv(Ri, Ro - 2, `conic-gradient(from 315deg, rgba(255,255,255,.3), rgba(0,0,0,${dark ? .55 : .3}) 24%, rgba(255,255,255,.14) 49%, rgba(0,0,0,${dark ? .6 : .34}) 74%, rgba(255,255,255,.3))`, 'animation:sheen 14s linear infinite');
  const rings = flutes + ringDiv(Rd, Ri + .6, conicGold(g)) + ringDiv(Ro - 2.6, Ro + 1.2, conicGold(g, 135));
  const face = discDiv(Rd, sunburst(c.sun, dark), `box-shadow:inset 0 0 0 1.5px ${c.faceEdge}`);

  /* ---- on the dial ---- */
  let s = svgOpen('front') + `<defs>${defs}</defs>`;
  // spokes between the eight sectors, and the fit rings 60 / 75 / 90 as soft blue halos
  for (let i = 0; i < 8; i++) { const p0 = polar(cx, cy, 47, i * 45), p1 = polar(cx, cy, Rd - 3, i * 45); s += `<path d="M${P2(p0)}L${P2(p1)}" stroke="${c.haloC}" stroke-width=".8" opacity=".2"/>`; }
  const ringCol = bl[dark ? 1 : 2];
  [60, 75, 90].forEach((v) => { const r = rOf(v); s += `<circle cx="${cx}" cy="${cy}" r="${f(r)}" fill="none" stroke="${ringCol}" stroke-width="5" opacity="${dark ? .38 : .24}" filter="url(#${id}b4)"/><circle cx="${cx}" cy="${cy}" r="${f(r)}" fill="none" stroke="${ringCol}" stroke-width="1" opacity="${dark ? .8 : .65}"/><text x="${cx}" y="${f(cy - r + 4.6 * big)}" text-anchor="middle" font-family="DM Mono" font-size="${13 * big}" fill="${c.ink2}" stroke="${c.sun[1]}" stroke-width="5" paint-order="stroke">${v}</text>`; });
  // the hand: a faint wedge of light behind it, a short blue trace along the rim, a silver line
  let hand = '';
  for (let k = 0; k < 80; k++) { const a1 = -k * .5, p0 = polar(cx, cy, Rd, a1 - .62), p1 = polar(cx, cy, Rd, a1); hand += `<path d="M${cx},${cy}L${P2(p0)}A${Rd},${Rd} 0 0,1 ${P2(p1)}Z" fill="${bl[2]}" opacity="${f((dark ? .12 : .08) * Math.pow(1 - k / 80, 1.7))}"/>`; }
  hand = `<g clip-path="url(#${id}c)">${hand}</g>`;
  for (let k = 0; k < 80; k++) { const a1 = -k, u = k / 80, p0 = polar(cx, cy, Rd - 7, a1 - 1.25), p1 = polar(cx, cy, Rd - 7, a1); hand += `<path d="M${P2(p0)}A${Rd - 7},${Rd - 7} 0 0,1 ${P2(p1)}" fill="none" stroke="${mix(c.trace[0], c.trace[1], u)}" stroke-width="${f(6 * (1 - u * .6))}" opacity="${f((dark ? .42 : .3) * Math.pow(1 - u, 1.5))}"/>`; }
  const tip = polar(cx, cy, Rd - 2, 0);
  hand += `<path d="M${cx},${cy}L${P2(tip)}" stroke="url(#${id}ag)" stroke-width="1.8"/><path d="M${cx},${cy}L${P2(tip)}" stroke="${sv[0]}" stroke-width=".6" opacity=".8"/>`;
  s += `<g class="rot">${hand}</g>`;
  // the moons, least urgent first so the ones to look at sit on top
  pts.slice().sort((p, q) => p.r.pr - q.r.pr).forEach((p) => { const [x, y] = p.xy, r = p.r, z = p.dot + 1, fo = r.pr >= fm, X = f(x), Y = f(y);
    if (r.st) { s += `<g class="m st" data-id="${escAttr(r.id)}" style="--t:${tOf(p.a)}"><g class="mi"><circle cx="${X}" cy="${Y}" r="${f(Math.max(3.4, z * .8))}" fill="${c.moonBody}" fill-opacity=".5" stroke="${c.moonEdge}" stroke-width="1" stroke-dasharray="2.2 2"/></g><circle cx="${X}" cy="${Y}" r="10" fill="transparent"/></g>`; return; }
    let m = r.band === 'A' ? `<circle cx="${X}" cy="${Y}" r="${f(z + 11)}" fill="url(#${id}g2)"/>` : '';
    m += `<g${r.band === 'D' ? ' opacity=".55"' : !fo && r.band === 'C' ? ' opacity=".82"' : ''}>${moonG(x, y, f(z), r.lit, `url(#${id}${fo ? 'mf' : 'mo'})`, c.moonBody, fo ? c.moonEdgeF : c.moonEdge)}</g>`;
    m += r.soon ? `<circle class="em" cx="${X}" cy="${Y}" r="${f(z + 5)}" fill="none" stroke="${c.ember}" stroke-width="1.7"/>` : r.fresh ? `<circle cx="${X}" cy="${Y}" r="${f(z + 4.6)}" fill="none" stroke="${c.fresh}" stroke-width="1.1" opacity=".9"/><circle class="pg" cx="${X}" cy="${Y}" r="${f(z + 9)}" fill="none" stroke="${c.fresh}" stroke-width=".9" opacity=".34"/>` : '';
    s += `<g class="m${fo ? ' fo' : ''}" data-id="${escAttr(r.id)}" style="--t:${tOf(p.a)}"><g class="mi">${m}</g><circle cx="${X}" cy="${Y}" r="${f(Math.max(z + 5, 11))}" fill="transparent"/></g>`; });
  // rank numbers next to the ones to look at first, placed where they collide with nothing
  { const placed = [60, 75, 90].map((v) => [cx - 12, cy - rOf(v) - 8, 24, 16]);
    pts.filter((p) => p.r.pr >= fm).sort((a, b) => a.r.rank - b.r.rank).slice(0, 24).forEach((p) => { const [x, y] = p.xy, gg = p.z + 4, w = 17 * big, h = 12 * big, out = x >= cx ? 1 : -1, cand = [[x + out * gg, y, out > 0 ? 'start' : 'end'], [x - out * gg, y, out > 0 ? 'end' : 'start'], [x, y + gg + 8, 'middle'], [x, y - gg - 6, 'middle']];
      const box = ([lx, ly, an]) => [an === 'start' ? lx : an === 'end' ? lx - w : lx - w / 2, ly - h / 2, w, h];
      const bad = (bx) => pts.some((q) => q !== p && bx[0] < q.xy[0] + q.z + 2 && bx[0] + bx[2] > q.xy[0] - q.z - 2 && bx[1] < q.xy[1] + q.z + 2 && bx[1] + bx[3] > q.xy[1] - q.z - 2) || (Math.hypot(Math.max(bx[0], Math.min(cx, bx[0] + bx[2])) - cx, Math.max(bx[1], Math.min(cy, bx[1] + bx[3])) - cy) < 47) || Math.hypot(bx[0] + bx[2] / 2 - cx, bx[1] + bx[3] / 2 - cy) > Rd - 12 || placed.some((q) => bx[0] < q[0] + q[2] + 2 && bx[0] + bx[2] > q[0] - 2 && bx[1] < q[1] + q[3] + 2 && bx[1] + bx[3] > q[1] - 2);
      const pick = cand.find((q) => !bad(box(q))); if (!pick) return; placed.push(box(pick));
      s += `<text class="lb" style="--t:${tOf(p.a)}" x="${f(pick[0])}" y="${f(pick[1] + 4.6 * big)}" text-anchor="${pick[2]}" font-family="DM Mono" font-weight="500" font-size="${f(13 * big)}" fill="${c.lab}" stroke="${c.sun[1]}" stroke-width="3" paint-order="stroke">${pad2(p.r.rank)}</text>`; }); }
  // the hub: the mark inside a gold ring
  s += `<circle cx="${cx}" cy="${cy}" r="45.5" fill="none" stroke="${g[2]}" stroke-width=".8" opacity=".6"/><circle cx="${cx}" cy="${cy}" r="41" fill="${c.hub}"/><circle cx="${cx}" cy="${cy}" r="41" fill="none" stroke="url(#${id}au)" stroke-width="2.5"/><g transform="translate(${cx - 31} ${cy - 31})">${mark({ size: 62, bare: true, tight: true, tone: c.hub === '#FFFFFF' ? 'steel' : 'silver', accent: T.moon, inline: false }).replace('<svg ', '<svg overflow="visible" ')}</g>`;
  // eight cut gold studs on the bezel, at the sector boundaries
  for (let i = 0; i < 8; i++) { const [x, y] = polar(cx, cy, (Ri + Ro) / 2 - 1, i * 45); s += gem(x, y, 4.6, 7.5, gfac, i * 45); }
  // tonight's moon rides the inner gold line; it stays upright while the hand turns
  { const rm = Ri - 1, Rm = 13.5, mx = cx, my = cy - rm, lit = litNow(M.now), waning = phaseAngle(M.now) > 180;
    s += `<g class="rot"><circle cx="${mx}" cy="${f(my)}" r="${Rm * 2}" fill="url(#${id}g2)"/><g class="unrot" style="transform-origin:${mx}px ${f(my)}px"><g${waning ? ` transform="translate(${2 * mx} 0) scale(-1 1)"` : ''}>${moonG(mx, my, Rm, lit, c.win[1] || `url(#${id}ag)`, c.win[0], g[dark ? 1 : 2])}</g>${glint(mx + Rm * .9, my - Rm * .85, 8, '#FFFFFF', .9)}</g></g>`; }
  // sector names outside the bezel
  if (!o.mini) s += M.sectors.map(([key, name], i) => { const a = i * 45 + 22.5, [x, y] = polar(cx, cy, Ro + 50, a), an = a < 180 ? 'start' : 'end', n = M.roles.filter((r) => r.s === key && !r.st).length;
    return `<g class="sn" data-sector="${key}"><text x="${f(x)}" y="${f(y)}" text-anchor="${an}" font-family="Outfit, 'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-weight="500" font-size="14" fill="${c.ink}">${name}</text><text x="${f(x)}" y="${f(y + 18)}" text-anchor="${an}" font-family="'DM Mono', 'PingFang SC', 'Noto Sans CJK SC', monospace" font-size="13" fill="${c.muted}">${L.n(n)}</text></g>`; }).join('');
  // the three threads of the dreamcatcher, each carrying one number
  s += [[o.mini ? -118 : -74, 60, focusN, L.focus, 'focus'], [0, 112, M.total ?? M.roles.length, L.total, 'all'], [o.mini ? 118 : 74, 60, M.pipeN, L.sent, 'pipe']].map(([dx, len, num, cap, k]) => { const x = cx + dx, y0 = cy + Math.sqrt((Ro + 1) ** 2 - dx * dx), y1 = y0 + len;
    return `<g class="th" data-go="${k}"><path d="M${x},${f(y0)}V${f(y1)}" stroke="${sv[3]}" stroke-width="2.6"/><path d="M${x - .5},${f(y0)}V${f(y1)}" stroke="${sv[1]}" stroke-width="1"/>${gem(x, y1, 8.5, 9.5, facets)}
      <text x="${x}" y="${f(y1 + (o.mini ? 58 : 45))}" text-anchor="middle" font-family="Outfit" font-weight="300" font-size="${o.mini ? 42 : 30}" letter-spacing="-.5" fill="url(#${id}n)">${num}</text><text x="${x}" y="${f(y1 + (o.mini ? 86 : 65))}" text-anchor="middle" font-family="Outfit, 'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="${o.mini ? 22 : 13}" fill="${c.muted}">${cap}</text><rect x="${x - 44}" y="${f(y0)}" width="88" height="${f(len + 74)}" fill="transparent"/></g>`; }).join('');
  if (!o.mini) { const mg = (lit, fill, edge) => moonG(8, 0, 7.5, lit, fill, c.moonBody, edge), row = (x, y, [gl, tx]) => `<g transform="translate(${x} ${y})">${gl}<text x="24" y="4.6" font-family="Outfit, 'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="13" fill="${c.ink2}">${tx}</text></g>`;
    const left = [[mg(.74, `url(#${id}mf)`, c.moonEdgeF), L.blue(focusN)], [mg(.34, `url(#${id}mo)`, c.moonEdge), L.silver((M.total ?? M.roles.length) - focusN)], [mg(1, `url(#${id}mf)`, c.moonEdgeF), L.full]];
    const nSt = M.roles.filter((r) => r.st).length; if (nSt) left.push([`<circle cx="8" r="6" fill="${c.moonBody}" fill-opacity=".5" stroke="${c.moonEdge}" stroke-width="1" stroke-dasharray="2.2 2"/>`, L.hollow(nSt)]);
    const right = [[`<circle cx="8" r="5" fill="none" stroke="${c.ink}" stroke-width="1.1"/><circle cx="8" r="9" fill="none" stroke="${c.ink}" stroke-width=".9" opacity=".4"/>`, L.fresh(M.roles.filter((r) => r.fresh && !r.st).length)], [`<circle cx="8" r="7" fill="none" stroke="${c.ember}" stroke-width="1.7"/>`, L.soon(M.roles.filter((r) => r.soon && !r.st).length)], [moonG(8, 0, 7.5, litNow(M.now), c.win[1] || `url(#${id}ag)`, c.win[0], g[dark ? 1 : 2]), L.tonight]];
    s += `<g class="lg">` + left.map((e, i) => row(40, (left.length > 3 ? 724 : 738) + i * 22, e)).join('') + right.map((e, i) => row(604, 738 + i * 22, e)).join('') + '</g>'; }
  return veil + back + rings + face + s + '</svg>';
}
