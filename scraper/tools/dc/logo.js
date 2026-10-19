/* DreamCatcher logo v3 — a machined hoop, a twelve-chord star web, a Klein-blue crescent hanging on the rim,
   three hairline threads. Nothing curved except the circle and the moon.
   dcLogo(size, idp, {animate}) returns an SVG string. All ids are prefixed (idp) so the logo can appear twice
   on one page (boot overlay + header). Strokes carry pathLength="1" so the boot self-draw is plain CSS. */
function dcLogo(size, idp, opts) {
  opts = opts || {};
  var W = 200, H = 218, cx = 100, cy = 96, R = 70;
  var P = function (r, deg) { var a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  var f = function (n) { return Math.round(n * 100) / 100; };

  // ---- the web: a {12/5} star polygon — twelve straight chords, each joining a point on the rim to the fifth point on
  //      (the chords weave into a twelve-point star with a small open centre: the "net")
  var N = 12, step = 5, chords = [];
  for (var i = 0; i < N; i++) {
    var a = P(R - 2.2, i * 30), b = P(R - 2.2, ((i + step) % N) * 30);
    chords.push('<path class="dc-web" pathLength="1" style="--i:' + i + '" d="M' + f(a[0]) + ',' + f(a[1]) + 'L' + f(b[0]) + ',' + f(b[1]) + '"/>');
  }
  // ---- threads: three hairlines from the rim, each ending in a small diamond
  function thread(deg, len, cls, dur) {
    var p = P(R, deg), x = f(p[0]), y = f(p[1]);
    return '<g transform="translate(' + x + ',' + y + ')"><g class="dc-thread ' + cls + '" style="--dur:' + dur + 's">' +
      '<path class="dc-string" pathLength="1" d="M0,0 L0,' + len + '"/>' +
      '<rect class="dc-bead" x="-1.7" y="' + f(len - 1.7) + '" width="3.4" height="3.4" transform="rotate(45 0 ' + len + ')"/>' +
      '</g></g>';
  }

  var mx = 133, my = 119, mr = 31;   // crescent: hangs on the lower-right rim (its edge crosses the hoop by ~1 px)
  return '<svg class="dc-logo' + (opts.animate ? ' dc-animate' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" width="' + size + '" height="' + f(size * H / W) + '" role="img" aria-label="DreamCatcher">' +
    '<defs>' +
    '<linearGradient id="' + idp + '-hoop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E6ECFF"/><stop offset=".45" stop-color="#6F93FF"/><stop offset="1" stop-color="#002FA7"/></linearGradient>' +
    '<linearGradient id="' + idp + '-web" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9DB6FF"/><stop offset="1" stop-color="#3D6BFF"/></linearGradient>' +
    '<linearGradient id="' + idp + '-moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FAEFF"/><stop offset=".45" stop-color="#2F5BFF"/><stop offset="1" stop-color="#002FA7"/></linearGradient>' +
    '<linearGradient id="' + idp + '-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3D6BFF" stop-opacity="0"/><stop offset="1" stop-color="#8FAEFF" stop-opacity=".5"/></linearGradient>' +
    '<filter id="' + idp + '-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<mask id="' + idp + '-cres"><rect x="0" y="0" width="200" height="218" fill="#fff"/><circle cx="' + (mx + 10.5) + '" cy="' + (my - 9) + '" r="27" fill="#000"/></mask>' +
    '<clipPath id="' + idp + '-in"><circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 1.2) + '"/></clipPath>' +
    '</defs>' +
    // hoop: a machined double line (main ring + inner hairline)
    '<g class="dc-hoopwrap"><circle class="dc-hoop" pathLength="1" cx="' + cx + '" cy="' + cy + '" r="' + R + '" stroke="url(#' + idp + '-hoop)"/>' +
    '<circle class="dc-hoop-in" pathLength="1" cx="' + cx + '" cy="' + cy + '" r="' + (R - 3.6) + '"/></g>' +
    // the net (rotates very slowly) + the radar sweep (clipped to the hoop) + centre point
    '<g class="dc-webwrap" stroke="url(#' + idp + '-web)">' + chords.join("") + '</g>' +
    '<g clip-path="url(#' + idp + '-in)"><g class="dc-sweepwrap"><path class="dc-sweep" fill="url(#' + idp + '-sweep)" d="M' + cx + ',' + cy + ' L' + cx + ',' + f(cy - R) + ' A' + R + ',' + R + ' 0 0 1 ' + f(P(R, 32)[0]) + ',' + f(P(R, 32)[1]) + ' Z"/></g></g>' +
    '<circle class="dc-eye" cx="' + cx + '" cy="' + cy + '" r="1.7"/>' +
    // boot-only: a spark that rides the hoop while it is drawn
    (opts.animate ? '<g class="dc-sparkwrap"><circle class="dc-spark-glow" cx="' + cx + '" cy="' + (cy - R) + '" r="5.5"/><circle class="dc-spark" cx="' + cx + '" cy="' + (cy - R) + '" r="2"/></g>' : '') +
    // the crescent
    '<g class="dc-moonwrap" filter="url(#' + idp + '-glow)"><circle class="dc-moon" cx="' + mx + '" cy="' + my + '" r="' + mr + '" fill="url(#' + idp + '-moon)" mask="url(#' + idp + '-cres)"/>' +
    '<circle class="dc-moon-edge" cx="' + mx + '" cy="' + my + '" r="' + mr + '" mask="url(#' + idp + '-cres)"/></g>' +
    thread(166, 24, "dc-t1", 5.4) + thread(180, 36, "dc-t2", 6.3) + thread(194, 24, "dc-t3", 5.8) +
    '</svg>';
}
