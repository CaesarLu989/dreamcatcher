/* DreamCatcher logo — crescent moon inside a woven dream-catcher hoop, three feathers.
   dcLogo(size, idp, {animate}) returns an SVG string. All ids are prefixed (idp) so the logo can
   appear twice on one page (boot overlay + header). Every path carries pathLength="1" so the
   self-draw animation is plain CSS (stroke-dasharray / stroke-dashoffset in 0–1 units). */
function dcLogo(size, idp, opts) {
  opts = opts || {};
  var W = 200, H = 236, cx = 100, cy = 100, R = 76;
  var P = function (r, deg) { var a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  var f = function (n) { return Math.round(n * 100) / 100; };

  // ---- the web: rows of inward-bowing arcs; each row starts at the midpoints of the row above
  var web = [], spokes = [];
  var n = 8, r = 64, angles = [];
  for (var i = 0; i < n; i++) angles.push(i * 360 / n);
  // hoop → first ring attachment lines
  for (var s = 0; s < n; s++) { var a = P(R, angles[s]), b = P(r, angles[s]); spokes.push("M" + f(a[0]) + "," + f(a[1]) + "L" + f(b[0]) + "," + f(b[1])); }
  var row = 0;
  while (r > 14 && row < 6) {
    var pull = 0.80, rc = r * pull, next = [];
    for (var k = 0; k < n; k++) {
      var a1 = angles[k], a2 = angles[(k + 1) % n] + (k === n - 1 ? 360 : 0), am = (a1 + a2) / 2;
      var p1 = P(r, a1), p2 = P(r, a2), c = P(rc * 0.82, am);
      web.push({ d: "M" + f(p1[0]) + "," + f(p1[1]) + "Q" + f(c[0]) + "," + f(c[1]) + " " + f(p2[0]) + "," + f(p2[1]), row: row });
      next.push(am % 360);
    }
    angles = next; r = rc * 0.92; row++;
  }
  var webSvg = web.map(function (w, i) {
    return '<path class="dc-web" pathLength="1" style="--i:' + i + ';--row:' + w.row + '" d="' + w.d + '"/>';
  }).join("");
  var spokeSvg = spokes.map(function (d, i) { return '<path class="dc-spoke" pathLength="1" style="--i:' + i + '" d="' + d + '"/>'; }).join("");

  // ---- feathers: string from hoop, two beads, a leaf-shaped feather with a vein
  function feather(deg, len, scale, cls, dur) {
    var p = P(R, deg);
    var x = f(p[0]), y = f(p[1]);
    var stringLen = len;
    // outer <g> positions (SVG attribute), inner <g> animates (CSS transform) — CSS would otherwise override the attribute
    return '<g transform="translate(' + x + ',' + y + ')"><g class="dc-feather ' + cls + '" style="--dur:' + dur + 's">' +
      '<path class="dc-string" pathLength="1" d="M0,0 L0,' + stringLen + '"/>' +
      '<circle class="dc-bead" cx="0" cy="' + f(stringLen * 0.35) + '" r="2.4"/>' +
      '<circle class="dc-bead" cx="0" cy="' + f(stringLen * 0.62) + '" r="2"/>' +
      '<g transform="translate(0,' + stringLen + ') scale(' + scale + ')">' +
      '<path class="dc-plume" pathLength="1" fill="url(#' + idp + '-plume)" d="M0,0 C7,9 8.5,26 0,48 C-8.5,26 -7,9 0,0 Z"/>' +
      '<path class="dc-vein" pathLength="1" d="M0,3 L0,45"/>' +
      '<path class="dc-barbs" pathLength="1" d="M0,12 L4.5,16 M0,12 L-4.5,16 M0,20 L5.5,25 M0,20 L-5.5,25 M0,28 L5,34 M0,28 L-5,34 M0,36 L3.6,41 M0,36 L-3.6,41"/>' +
      '</g></g></g>';
  }

  // ---- stars
  var star = function (x, y, s, delay) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')"><path class="dc-star" style="--d:' + delay + 's" d="M0,-6 C0.6,-1.6 1.6,-0.6 6,0 C1.6,0.6 0.6,1.6 0,6 C-0.6,1.6 -1.6,0.6 -6,0 C-1.6,-0.6 -0.6,-1.6 0,-6 Z"/></g>';
  };

  return '<svg class="dc-logo' + (opts.animate ? ' dc-animate' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" width="' + size + '" height="' + f(size * H / W) + '" role="img" aria-label="DreamCatcher">' +
    '<defs>' +
    '<linearGradient id="' + idp + '-hoop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1C2"/><stop offset=".5" stop-color="#E9C46A"/><stop offset="1" stop-color="#C8973A"/></linearGradient>' +
    '<radialGradient id="' + idp + '-moon" cx=".38" cy=".35" r=".8"><stop offset="0" stop-color="#FFFBEA"/><stop offset=".55" stop-color="#FFE9A3"/><stop offset="1" stop-color="#E8B84A"/></radialGradient>' +
    '<linearGradient id="' + idp + '-plume" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF3FF"/><stop offset="1" stop-color="#8FA7FF"/></linearGradient>' +
    '<filter id="' + idp + '-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<mask id="' + idp + '-cres"><rect x="0" y="0" width="200" height="200" fill="#fff"/><circle cx="112" cy="88" r="23" fill="#000"/></mask>' +
    '</defs>' +
    '<g class="dc-hoopwrap">' +
    '<circle class="dc-hoop" pathLength="1" cx="' + cx + '" cy="' + cy + '" r="' + R + '" stroke="url(#' + idp + '-hoop)"/>' +
    '<circle class="dc-wrap" pathLength="1" cx="' + cx + '" cy="' + cy + '" r="' + R + '"/>' +
    '</g>' +
    '<g class="dc-webwrap">' + spokeSvg + webSvg + '<circle class="dc-eye" cx="' + cx + '" cy="' + cy + '" r="5"/></g>' +
    // boot-only extras: a spark that traces the hoop while it is drawn, two halo ripples when the moon rises
    (opts.animate ? '<g class="dc-sparkwrap"><circle class="dc-spark-glow" cx="' + (cx + R) + '" cy="' + cy + '" r="7"/><circle class="dc-spark" cx="' + (cx + R) + '" cy="' + cy + '" r="2.6"/></g>' +
      '<circle class="dc-ring r1" cx="' + cx + '" cy="' + (cy - 4) + '" r="27"/><circle class="dc-ring r2" cx="' + cx + '" cy="' + (cy - 4) + '" r="27"/>' : '') +
    '<g class="dc-moonwrap" filter="url(#' + idp + '-glow)"><circle class="dc-moon" cx="' + cx + '" cy="' + (cy - 4) + '" r="27" fill="url(#' + idp + '-moon)" mask="url(#' + idp + '-cres)"/></g>' +
    star(146, 58, 1, 0) + star(56, 66, 0.75, 0.9) + star(150, 132, 0.6, 1.7) + star(64, 140, 0.55, 0.4) +
    feather(158, 24, 0.9, 'dc-f1', 5.2) + feather(180, 30, 1.15, 'dc-f2', 6.1) + feather(202, 24, 0.9, 'dc-f3', 5.6) +
    '</svg>';
}
