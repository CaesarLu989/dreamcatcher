// core.js — drawing helpers shared by the page and the icon: the wolf outline, the DreamCatcher mark, the white desktop
// icon, real moon phases (Meeus), the moon-phase glyph, small maths. Plain script: build.mjs concatenates the parts in one scope.
const f = (n) => Math.round(n * 100) / 100;
let _uid = 0;
const nid = (p) => p + (++_uid);

/* ---- the howling wolf, drawn with a pen: smooth runs where the skin is tight, corners where the form turns. Nose tip at (546, 0) ---- */
/* nodes: [x, y, 's' smooth | 'c' corner] in drawing order, starting at the top of the nose and going back along the head */
function nodes(o = {}) {
  const fang = o.fang !== false, locks = o.locks !== false, ear = o.ear ?? 1;   // ear: 0 = as traced (blunt), 1 = drawn to a point
  const tipEar = ear ? [[84, 284, 's'], [67 - 3 * ear, 316, 'c'], [80, 346, 's'], [96, 364, 's']] : [[80, 284, 's'], [72, 300, 's'], [75, 336, 's'], [90, 360, 's']];
  // locks of fur: each one runs along the flow of the coat to a point, then cuts back under itself
  const T = [-.66, .75], NO = [-.75, -.66], B = d => [106 + d * T[0], 378 + d * T[1]];          // nape: the line from the notch under the ear, and its outward normal
  const napeLock = (d, out = 5, back = 7, inn = 8) => { const t = B(d), u = B(d - back); return [[t[0] + out * NO[0], t[1] + out * NO[1], 'c'], [u[0] - inn * NO[0], u[1] - inn * NO[1], 'c']]; };
  const ns = o.napeStart ?? 34;   // how far down the nape the first lock sits (the hoop usually cuts the nape before that)
  const nape = locks ? [[106, 378, 'c'], ...napeLock(ns, 4), ...napeLock(ns + 58), ...napeLock(ns + 124), ...napeLock(ns + 198), ...napeLock(ns + 278)]
                     : [[106, 378, 'c'], [84, 398, 's'], [56, 440, 's'], [24, 484, 's'], [-10, 530, 's'], [-60, 590, 's']];
  const chestUp = locks   // from below, upward. Each lock: the cut-back, the tip of the lock above it, then a point on that lock's outer edge
    ? [[504, 652, 'c'], [519, 660, 'c'], [522, 624, 's'], [517, 596, 'c'], [533, 604, 'c'], [536, 567, 's'], [530, 540, 'c'], [546, 548, 'c'], [548, 514, 's'], [542, 485, 'c'], [559, 494, 'c'], [559, 462, 's'], [553, 437, 'c'], [568, 444, 'c'], [567, 421, 's'], [560, 402, 'c'], [574, 408, 'c'], [562, 388, 's'], [547, 362, 's']]
    : [[505, 655, 's'], [518, 598, 's'], [527, 545, 's'], [542, 490, 's'], [555, 450, 's'], [566, 412, 's'], [562, 388, 's'], [547, 362, 's']];
  const mouth = fang ? [[613, 132, 'c'], [596, 112, 'c'], [591, 136, 'c'], [574, 139, 'c']] : [[610, 133, 's'], [590, 137, 's'], [574, 139, 'c']];
  return [
    [546, 0, 's'], [500, 34, 's'], [430, 101, 's'], [400, 119, 's'], [378, 119, 's'], [340, 128, 's'], [312, 136, 's'], [286, 157, 's'], [262, 186, 's'], [219, 217, 's'], [160, 246, 's'], [106, 272, 's'],
    ...tipEar, ...nape,
    [-200, 720, 'c'], [-420, 900, 'c'], [-420, 1300, 'c'], [470, 1300, 'c'],
    ...chestUp,
    [540, 338, 's'], [547, 306, 's'], [568, 274, 's'], [582, 247, 's'], [612, 218, 's'], [638, 191, 's'], [649, 172, 's'], [651, 157, 's'], [647, 140, 's'], [634, 130, 's'],
    ...mouth,
    [574, 120, 's'], [584, 84, 's'], [592, 64, 's'], [585, 50, 's'], [571, 37, 'c'], [566, 20, 's'], [556, 5, 's'],
  ];
}
/* pen path through nodes: smooth nodes get a continuous tangent, corner nodes do not */
function penPath(N, tension = .34) {
  const n = N.length, P = i => N[(i + n) % n], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]) || 1;
  const tan = i => { const v = sub(P(i + 1), P(i - 1)), l = len(v); return [v[0] / l, v[1] / l]; };
  let d = `M${f(P(0)[0])},${f(P(0)[1])}`;
  for (let i = 0; i < n; i++) { const a = P(i), b = P(i + 1), L = len(sub(b, a));
    const c1 = a[2] === 's' ? [a[0] + tan(i)[0] * L * tension, a[1] + tan(i)[1] * L * tension] : [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3];
    const c2 = b[2] === 's' ? [b[0] - tan(i + 1)[0] * L * tension, b[1] - tan(i + 1)[1] * L * tension] : [b[0] - (b[0] - a[0]) / 3, b[1] - (b[1] - a[1]) / 3];
    d += (a[2] === 'c' && b[2] === 'c') ? `L${f(b[0])},${f(b[1])}` : `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(b[0])},${f(b[1])}`; }
  return d + 'Z';
}
/* the wolf placed in the artboard: scale k, nose tip at (nx, ny) */
const NOSE = [546, 0];
const placed = (k, nx, ny, o) => nodes(o).map(([x, y, t]) => [nx + k * (x - NOSE[0]), ny + k * (y - NOSE[1]), t]);
const wolfPath = (k, nx, ny, o) => penPath(placed(k, nx, ny, o));

/* ---- the mark: wolf, hoop and three threads in one metal (silver on dark, steel on light); the crescent carries Klein blue.
   Artboard 400 x 448 with threads (48 / 84 / 48 long), 400 x 400 without. Hoop: centre (200, 192), r 144 ---- */
const GEO = { k: .30, nx: 228, ny: 156, mx: 262, my: 112, mr: 30, ri: .86, di: .42, ma: 33.7, hoop: 5, thread: 3.5, napeStart: 80 };
const TINY = { k: .34, nx: 225.6, ny: 133, mx: 262, my: 112, mr: 33, hoop: 15 };
const TONE = {
  silver: { wolf: [[0, '#FFFFFF'], [.2, '#F3F6F9'], [.44, '#C6CDD7'], [.58, '#97A1AF'], [.66, '#E1E6EC'], [.84, '#B3BBC7'], [1, '#8B95A4']], rim: '#FFFFFF',
            hoop: [[0, '#FFFFFF'], [.2, '#BFC7D2'], [.36, '#F6F8FA'], [.55, '#8C96A5'], [.72, '#E9EDF2'], [1, '#A4ADBA']], bead: ['#F6F8FA', '#9EA7B5'] },
  steel:  { wolf: [[0, '#7B8493'], [.2, '#4A515D'], [.44, '#20242C'], [.58, '#0E1116'], [.66, '#4E5562'], [.84, '#262B34'], [1, '#12151A']], rim: '#AEB6C2',
            hoop: [[0, '#3C434E'], [.2, '#8D96A4'], [.36, '#2A2F38'], [.55, '#737B89'], [.72, '#1F232A'], [1, '#5A616D']], bead: ['#6A7280', '#1B1F26'] },
};
const ACCENT = { klein: ['#7FA8FF', '#1F55F0', '#0A2FA8'], aurora: ['#3CE0BA', '#3BA7FF', '#3F5BFF'], gold: ['#F7E4A8', '#DDB75E', '#9A7626'] };
const stops = a => a.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
/* mark(o): size, bare (no threads), tight (crop to the hoop; needs bare), tiny (≤ 48 px: no fur detail, heavy hoop, larger crescent),
   tone 'silver' | 'steel', accent (three stops), flat (one colour for everything), disc (fill inside the hoop), part 1–4 (opening animation), inline */
function mark(o = {}) {
  const g = { ...GEO, ...(o.tiny ? TINY : {}) }, t = TONE[o.tone || 'silver'], ac = o.accent || ACCENT.klein, id = 'lg' + (++_uid), bare = !!o.bare, TL = o.threads || [48, 84, 48], H = bare ? 400 : 364 + TL[1];
  const vb = bare && o.tight ? '44 44 312 312' : `0 0 400 ${H}`, ratio = bare ? 1 : H / 400, flat = o.flat, part = o.part || 4, CX = 200, CY = 192, R = 144;
  const wolfD = wolfPath(g.k, g.nx, g.ny, { fang: !o.tiny, locks: !o.tiny, napeStart: g.napeStart });
  const a = g.ma * Math.PI / 180, cx2 = g.mx + g.di * g.mr * Math.cos(a), cy2 = g.my - g.di * g.mr * Math.sin(a);
  const defs = flat ? '' : `<linearGradient id="${id}w" gradientUnits="userSpaceOnUse" x1="268" y1="112" x2="92" y2="336">${stops(t.wolf)}</linearGradient>
<linearGradient id="${id}h" gradientUnits="userSpaceOnUse" x1="70" y1="62" x2="330" y2="322">${stops(t.hoop)}</linearGradient>
<linearGradient id="${id}t" gradientUnits="userSpaceOnUse" x1="0" y1="330" x2="0" y2="${336 + TL[1]}">${stops([[0, t.hoop[2][1]], [.5, t.hoop[3][1]], [1, t.hoop[4][1]]])}</linearGradient>
<linearGradient id="${id}k" gradientUnits="userSpaceOnUse" x1="${f(g.mx - g.mr)}" y1="${f(g.my - g.mr)}" x2="${f(g.mx + g.mr)}" y2="${f(g.my + g.mr)}">${stops([[0, ac[0]], [.55, ac[1]], [1, ac[2]]])}</linearGradient>`;
  const disc = o.disc ? `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${o.disc}"/>` : '';
  const moon = part < 2 ? '' : `<mask id="${id}c"><rect x="0" y="0" width="400" height="470" fill="#fff"/><circle cx="${f(cx2)}" cy="${f(cy2)}" r="${f(g.ri * g.mr)}" fill="#000"/></mask><circle cx="${g.mx}" cy="${g.my}" r="${g.mr}" fill="${flat || `url(#${id}k)`}" mask="url(#${id}c)"/>`;
  // the wolf: a light copy underneath, the metal on top nudged down-right, so the upper edge catches the light
  const body = part < 3 ? '' : `<clipPath id="${id}p"><circle cx="${CX}" cy="${CY}" r="${R - 2}"/></clipPath><clipPath id="${id}q"><path d="${wolfD}"/></clipPath>
    <g clip-path="url(#${id}p)"${part === 3 ? ' transform="translate(-14 46)"' : ''}>${flat ? `<path d="${wolfD}" fill="${flat}"/>` : `<path d="${wolfD}" fill="${t.rim}"/><g clip-path="url(#${id}q)"><path d="${wolfD}" fill="url(#${id}w)" transform="translate(${o.tiny ? '0 0' : '1.1 1.5'})"/></g>`}</g>`;
  const hoop = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${flat || (part === 1 ? t.hoop[3][1] : `url(#${id}h)`)}" stroke-width="${g.hoop}"/>`;
  const threads = bare || part < 4 ? '' : [-48, 0, 48].map((dx, i) => { const x = CX + dx, y0 = CY + Math.sqrt(R * R - dx * dx), y1 = y0 + TL[i];
    return `<path d="M${x},${f(y0)}V${f(y1)}" stroke="${flat || `url(#${id}t)`}" stroke-width="${g.thread}"/>` + (flat ? `<rect x="${x - 6}" y="${f(y1 - 6)}" width="12" height="12" transform="rotate(45 ${x} ${f(y1)})" fill="${flat}"/>`
      : `<path d="M${x},${f(y1 - 8.5)}L${x - 8.5},${f(y1)}L${x},${f(y1 + 8.5)}Z" fill="${t.bead[0]}"/><path d="M${x},${f(y1 - 8.5)}L${x + 8.5},${f(y1)}L${x},${f(y1 + 8.5)}Z" fill="${t.bead[1]}"/>`); }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${o.size ? ` width="${o.size}" height="${f(o.size * ratio)}"` : ''} role="img" aria-label="DreamCatcher"${o.inline === false ? '' : ' style="display:block;overflow:visible;flex:none"'}><defs>${defs}</defs><g${bare ? ' transform="translate(0 8)"' : ''}>${disc}${moon}${body}${hoop}${threads}</g></svg>`;
}
/* the desktop icon: a white tile, the whole mark (threads included) in steel. o.canvas: macOS margins (tile = 824 / 1024 of the canvas) */
function appIcon(size = 1024, o = {}) {
  const id = 'ic' + (++_uid), tile = o.canvas ? size * 824 / 1024 : size, off = (size - tile) / 2, r = tile * .2237, small = size <= 64;
  const mw = tile * (small ? .78 : .6), inner = small ? mark({ size: f(mw), bare: true, tight: true, tiny: true, tone: 'steel', accent: o.accent, inline: false }) : mark({ size: f(mw), tone: 'steel', accent: o.accent, inline: false });
  const mh = small ? mw : mw * 448 / 400, px = off + (tile - mw) / 2, py = off + (tile - mh) / 2 + (small ? 0 : tile * .012);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"${o.inline === false ? '' : ' style="display:block;flex:none"'}><defs>
<linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#F4F6F9"/><stop offset="1" stop-color="#DCE1E8"/></linearGradient>
<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>
<rect x="${f(off)}" y="${f(off)}" width="${f(tile)}" height="${f(tile)}" rx="${f(r)}" fill="url(#${id}a)"/><rect x="${f(off)}" y="${f(off)}" width="${f(tile)}" height="${f(tile * .5)}" rx="${f(r)}" fill="url(#${id}b)"/>
<rect x="${f(off + tile * .003)}" y="${f(off + tile * .003)}" width="${f(tile * .994)}" height="${f(tile * .994)}" rx="${f(r * .99)}" fill="none" stroke="rgba(12,16,24,.14)" stroke-width="${f(tile * .006)}"/>
<g transform="translate(${f(px)} ${f(py)})">${inner}</g></svg>`;
}


/* ---- new and full moons after Meeus, "Astronomical Algorithms", ch. 49 (good to a few minutes) ---- */
const RAD = Math.PI / 180;
function lunation(k) {   // integer k = new moon, k + .5 = full moon; k = 0 is the new moon of 2000-01-06
  const T = k / 1236.85, full = Math.abs(k % 1) > .25, E = 1 - .002516 * T - .0000074 * T * T;
  const M = (2.5534 + 29.1053567 * k - .0000014 * T * T) * RAD, Mp = (201.5643 + 385.81693528 * k + .0107582 * T * T + .00001238 * T ** 3) * RAD, F = (160.7108 + 390.67050284 * k - .0016118 * T * T - .00000227 * T ** 3) * RAD, Om = (124.7746 - 1.56375588 * k + .0020672 * T * T) * RAD;
  const c = full ? [-.40614, .17302, .01614, .01043, .00734, -.00515, .00209] : [-.4072, .17241, .01608, .01039, .00739, -.00514, .00208];
  let jde = 2451550.09766 + 29.530588861 * k + .00015437 * T * T - .00000015 * T ** 3
    + c[0] * Math.sin(Mp) + c[1] * E * Math.sin(M) + c[2] * Math.sin(2 * Mp) + c[3] * Math.sin(2 * F) + c[4] * E * Math.sin(Mp - M) + c[5] * E * Math.sin(Mp + M) + c[6] * E * E * Math.sin(2 * M)
    - .00111 * Math.sin(Mp - 2 * F) - .00057 * Math.sin(Mp + 2 * F) + .00056 * E * Math.sin(2 * Mp + M) - .00042 * Math.sin(3 * Mp) + .00042 * E * Math.sin(M + 2 * F) + .00038 * E * Math.sin(M - 2 * F) - .00024 * E * Math.sin(2 * Mp - M) - .00017 * Math.sin(Om);
  return (jde - 2440587.5) * 864e5 - 72e3;   // ms since 1970, UTC (ΔT ≈ 72 s in 2026)
}
/* phase angle in degrees (0 = new, 180 = full) at time t (ms), by interpolating between the neighbouring new and full moons */
function phaseAngle(t) { let k = Math.floor((t - lunation(0)) / (29.530588861 * 864e5)) - 1; const ev = []; for (let i = 0; i < 8; i++) ev.push([lunation(k + i / 2), (i % 2) * 180]);
  for (let i = 0; i < ev.length - 1; i++) if (t >= ev[i][0] && t < ev[i + 1][0]) return ev[i][1] + (t - ev[i][0]) / (ev[i + 1][0] - ev[i][0]) * 180; return 0; }
function events(t0, t1) { let k = Math.floor((t0 - lunation(0)) / (29.530588861 * 864e5)) - 1; const out = []; for (let i = 0; i < 12; i++) { const kk = k + i / 2, t = lunation(kk); if (t >= t0 && t <= t1) out.push({ t, full: i % 2 === 1 }); } return out; }

/* ---- icons, the moon-phase glyph, polar helpers ---- */
const ic = {
  arrow: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2L13.5 13.5"/></svg>`,
  lock: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7"/></svg>`,
  moon: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.2 10.1A5.9 5.9 0 015.9 2.8a5.9 5.9 0 107.3 7.3z"/></svg>`,
  sun: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2.8"/><path d="M8 1.6v1.6M8 12.8v1.6M1.6 8h1.6M12.8 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M3.5 12.5l1.1-1.1M11.4 4.6l1.1-1.1"/></svg>`,
};
/* moon-phase glyph: `lit` 0…1 of the disc is bright. c = { body, edge, lit: [c0, c1] } */
function moon(size, lit, c) {
  const id = nid('mn'), R = size / 2 - 1, cx = size / 2, cy = size / 2, k = Math.abs(1 - 2 * lit) * R;
  let d = '';
  if (lit >= .999) d = `M${cx - R},${cy}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0`;
  else if (lit > .001) d = `M${cx},${cy - R}A${R},${R} 0 0,1 ${cx},${cy + R}A${f(k)},${R} 0 0,${lit > .5 ? 1 : 0} ${cx},${cy - R}Z`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;flex:none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.lit[0]}"/><stop offset="1" stop-color="${c.lit[1]}"/></linearGradient></defs>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="${c.body}" stroke="${c.edge}" stroke-width="1"/>${d ? `<path d="${d}" fill="url(#${id})"/>` : ''}</svg>`;
}
/* polar helper: angle in degrees clockwise from 12 o'clock */
const polar = (cx, cy, r, deg) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];
const arc = (cx, cy, r, a0, a1) => { const p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1); return `M${f(p0[0])},${f(p0[1])}A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0},${a1 > a0 ? 1 : 0} ${f(p1[0])},${f(p1[1])}`; };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
const rnd = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
