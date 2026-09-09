/* ===== DreamCatcher motion layer — starfield, aurora, card tilt + glow, load sweep, ticker, logo replay ===== */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  var isDark = function () { var t = document.documentElement.getAttribute("data-theme"); return t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches); };

  /* ---------- 1. starfield canvas behind the header (parallax on scroll + mouse) ---------- */
  var sky = document.createElement("canvas");
  sky.id = "dc-sky"; sky.setAttribute("aria-hidden", "true");
  document.body.insertBefore(sky, document.body.firstChild);
  var ctx = sky.getContext("2d"), stars = [], W = 0, H = 0, mx = 0.5, my = 0.3, sy = 0;
  function resize() {
    W = sky.width = innerWidth; H = sky.height = Math.min(innerHeight, 760);
    stars = [];
    var n = Math.round(W * H / 6500);
    for (var i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, p: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 0.8, d: 0.3 + Math.random() * 0.7 });
  }
  resize(); addEventListener("resize", resize);
  addEventListener("mousemove", function (e) { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; }, { passive: true });
  addEventListener("scroll", function () { sy = scrollY; }, { passive: true });
  var t0 = performance.now();
  // shooting stars: one every ~6–14 s, streaking down-left across the top of the sky
  var meteors = [], nextMeteor = t0 + 2500;
  function spawnMeteor(now) {
    meteors.push({ x: W * (0.35 + Math.random() * 0.6), y: Math.random() * H * 0.25, vx: -(520 + Math.random() * 260), vy: 260 + Math.random() * 120, born: now, life: 900 + Math.random() * 500 });
    nextMeteor = now + 6000 + Math.random() * 8000;
  }
  (function draw(now) {
    var t = (now - t0) / 1000, dark = isDark();
    ctx.clearRect(0, 0, W, H);
    var fade = Math.max(0, 1 - sy / 520);
    if (fade > 0) {
      var ox = (mx - 0.5) * 18, oy = (my - 0.5) * 10;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], tw = 0.55 + 0.45 * Math.sin(t * s.s + s.p);
        var a = (dark ? 0.75 : 0.28) * tw * fade;
        ctx.beginPath(); ctx.arc(s.x + ox * s.d, s.y + oy * s.d - sy * 0.15 * s.d, s.r, 0, 6.283);
        ctx.fillStyle = dark ? "rgba(214,224,255," + a + ")" : "rgba(0,47,167," + a + ")";
        ctx.fill();
      }
      if (now > nextMeteor && document.visibilityState === "visible") spawnMeteor(now);
      for (var k = meteors.length - 1; k >= 0; k--) {
        var m = meteors[k], age = (now - m.born) / m.life;
        if (age >= 1) { meteors.splice(k, 1); continue; }
        var px = m.x + m.vx * age * m.life / 1000, py = m.y + m.vy * age * m.life / 1000;
        var len = 140 * Math.sin(age * Math.PI), al = (dark ? 0.9 : 0.55) * Math.sin(age * Math.PI) * fade;
        var lg = ctx.createLinearGradient(px, py, px - m.vx / 800 * len, py - m.vy / 800 * len);
        lg.addColorStop(0, (dark ? "rgba(255,244,214," : "rgba(0,47,167,") + al + ")");
        lg.addColorStop(1, (dark ? "rgba(255,244,214,0)" : "rgba(0,47,167,0)"));
        ctx.strokeStyle = lg; ctx.lineWidth = dark ? 1.6 : 1.3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - m.vx / 800 * len, py - m.vy / 800 * len); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 6.283); ctx.fillStyle = (dark ? "rgba(255,250,235," : "rgba(0,47,167,") + al + ")"; ctx.fill();
      }
      // soft moon glow in the top-right
      var g = ctx.createRadialGradient(W * 0.86 + ox, 110 + oy, 0, W * 0.86 + ox, 110 + oy, 260);
      g.addColorStop(0, dark ? "rgba(245,214,122," + 0.16 * fade + ")" : "rgba(245,214,122," + 0.22 * fade + ")");
      g.addColorStop(1, "rgba(245,214,122,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(draw);
  })(t0);

  /* ---------- 2. aurora blobs (dark mode only, pure CSS via injected nodes) ---------- */
  var aur = document.createElement("div"); aur.id = "dc-aurora"; aur.setAttribute("aria-hidden", "true");
  aur.innerHTML = "<i></i><i></i><i></i>";
  document.body.insertBefore(aur, document.body.firstChild);

  /* ---------- 3. pointer tilt + glow on every card (.role, .tick, .rl-tile) ---------- */
  var tilting = null;
  document.addEventListener("pointermove", function (e) {
    var card = e.target.closest && e.target.closest(".role, .tick, .rl-tile");
    if (tilting && tilting !== card) { tilting.style.transform = ""; tilting.style.removeProperty("--gx"); tilting.style.removeProperty("--gy"); tilting.classList.remove("tilt"); tilting = null; }
    if (!card) return;
    var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    var rx = (0.5 - py) * 6, ry = (px - 0.5) * 8;
    card.classList.add("tilt");
    card.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-3px)";
    card.style.setProperty("--gx", (px * 100).toFixed(1) + "%"); card.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    tilting = card;
  }, { passive: true });
  document.addEventListener("pointerleave", function () { if (tilting) { tilting.style.transform = ""; tilting.classList.remove("tilt"); tilting = null; } }, true);
  document.addEventListener("pointerout", function (e) { if (tilting && !tilting.contains(e.relatedTarget)) { tilting.style.transform = ""; tilting.classList.remove("tilt"); tilting = null; } }, { passive: true });

  /* ---------- 4. section headline underline + list sweep when the feed (re)renders ---------- */
  var list = document.getElementById("rl-list");
  if (list && "MutationObserver" in window) {
    var last = 0;
    new MutationObserver(function () {
      var now = Date.now(); if (now - last < 400) return; last = now;
      var sw = document.createElement("div"); sw.className = "rl-sweep"; list.appendChild(sw);
      setTimeout(function () { sw.remove(); }, 1300);
    }).observe(list, { childList: true });
  }

  /* ---------- 5. header logo: hover intensifies, click replays the boot ---------- */
  var brand = document.getElementById("dc-brand-logo");
  if (brand) {
    brand.style.cursor = "pointer"; brand.title = "重放开机动画";
    brand.addEventListener("click", function () {
      if (document.getElementById("dc-boot") || !window.dcBootPlay) return;
      window.scrollTo({ top: 0, behavior: "instant" });   // so the logo can fly back onto the header
      window.dcBootPlay("full");
    });
  }

  /* ---------- 6. "上次抓取" relative-time ticker ---------- */
  setInterval(function () {
    var b = document.querySelector("#rl-status b"); if (!b || !window.__dcGeneratedAt) return;
    var m = Math.round((Date.now() - new Date(window.__dcGeneratedAt).getTime()) / 60000);
    b.textContent = m < 1 ? "刚刚" : m < 60 ? m + " 分钟前" : Math.round(m / 60) < 48 ? Math.round(m / 60) + " 小时前" : Math.round(m / 1440) + " 天前";
  }, 30000);
})();
