/* ===== DreamCatcher boot sequence + header logo + scroll reveal =====
   Full sequence (once a day, ~8.5 s): night sky fades up from black, the stars drift, a meteor crosses,
   a spark traces the hoop, the web is woven ring by ring, the moon rises with two halo ripples, stars and
   feathers arrive, fireflies drift, the wordmark rises with a gold hairline — then the logo flies into the
   header and the page reveals beneath it. Short sequence (~2 s) the rest of the day; skip always available. */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var brand = document.getElementById("dc-brand-logo");
  if (brand) brand.innerHTML = dcLogo(104, "dcH", { animate: false });

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function fill(boot, mode) {
    boot.className = mode === "short" ? "short" : "";
    boot.innerHTML = '<div class="bg"></div><div class="aurora"><i></i><i></i></div><div class="stars"></div><div class="meteors"></div>' +
      '<div class="veil"></div><div class="halo"></div><div class="fireflies"></div><div class="logo"></div>' +
      '<div class="word"><div class="w"></div><div class="line"></div><div class="t">梦捕手 · 2027 求职雷达</div></div>' +
      '<button class="skip" type="button">跳过 SKIP</button>';
    // star field: 110 stars, each with its own twinkle phase; a few bigger ones glow
    var stars = boot.querySelector(".stars"), frag = document.createDocumentFragment();
    for (var i = 0; i < 110; i++) {
      var s = document.createElement("i");
      s.style.left = rnd(0, 100) + "%"; s.style.top = rnd(0, 100) + "%";
      s.style.setProperty("--d", rnd(0, 3.6).toFixed(2) + "s"); s.style.setProperty("--o", rnd(0.35, 1).toFixed(2));
      s.style.setProperty("--in", rnd(0, 1.6).toFixed(2) + "s");
      if (Math.random() < 0.16) s.className = "big";
      frag.appendChild(s);
    }
    stars.appendChild(frag);
    // meteors: three in the full sequence, one in the short one
    var met = boot.querySelector(".meteors"), delays = mode === "short" ? [0.35] : [1.05, 4.9, 7.1];
    delays.forEach(function (d, k) {
      var m = document.createElement("i");
      m.style.left = rnd(45, 88) + "%"; m.style.top = rnd(6, 28) + "%";
      m.style.setProperty("--d", d + "s"); m.style.setProperty("--len", Math.round(rnd(110, 190)) + "px");
      met.appendChild(m);
    });
    // fireflies drifting up around the logo
    var ff = boot.querySelector(".fireflies");
    for (var f = 0; f < 10; f++) {
      var e = document.createElement("i");
      e.style.setProperty("--x", rnd(34, 66).toFixed(1) + "%"); e.style.setProperty("--y", rnd(32, 70).toFixed(1) + "%");
      e.style.setProperty("--dx", rnd(-28, 28).toFixed(0) + "px"); e.style.setProperty("--t", rnd(4.5, 7.5).toFixed(2) + "s");
      e.style.setProperty("--d", (mode === "short" ? rnd(0.3, 1.2) : rnd(5.2, 7.4)).toFixed(2) + "s");
      ff.appendChild(e);
    }
    boot.querySelector(".logo").innerHTML = dcLogo(mode === "short" ? 150 : 210, "dcB", { animate: mode === "full" });
    boot.querySelector(".w").innerHTML = "DreamCatcher".split("").map(function (ch, i) { return '<span style="--i:' + i + '">' + ch + '</span>'; }).join("");
  }

  /* play(mode) — mode: "full" | "short". Resolves through onDone when the overlay starts handing off. */
  function play(mode, onDone) {
    var boot = document.getElementById("dc-boot");
    if (!boot) { boot = document.createElement("div"); boot.id = "dc-boot"; boot.setAttribute("aria-hidden", "true"); document.body.appendChild(boot); }
    fill(boot, mode);
    document.body.classList.add("dc-booting");
    if (brand) brand.style.visibility = "hidden";        // the boot logo lands exactly on it, then it takes over
    var done = false;
    function finish(fast) {
      if (done) return; done = true;
      var bl = boot.querySelector(".logo svg"), hl = brand && brand.querySelector("svg"), wait = 700;
      var a = bl && bl.getBoundingClientRect(), h = hl && hl.getBoundingClientRect();
      if (!fast && a && h && h.width > 0 && a.width > 0) {
        // FLIP: fly the boot logo onto the header logo while the sky dissolves
        var s = h.width / a.width, dx = (h.left + h.width / 2) - (a.left + a.width / 2), dy = (h.top + h.height / 2) - (a.top + a.height / 2);
        bl.style.transformOrigin = "50% 50%";
        bl.style.transition = "transform .95s cubic-bezier(.7,0,.22,1)";
        bl.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
        boot.classList.add("fly"); wait = 960;
      } else { boot.classList.add("out"); }
      onDone && onDone();
      setTimeout(function () { boot.remove(); if (brand) brand.style.visibility = ""; document.body.classList.remove("dc-booting"); }, wait);
    }
    boot.querySelector(".skip").onclick = function () { finish(true); };
    boot.addEventListener("click", function (e) { if (e.target === boot || e.target.className === "bg") finish(true); });
    setTimeout(function () { finish(false); }, mode === "short" ? 2050 : 8350);
    return finish;
  }
  window.dcBootPlay = play;

  // ---- first boot: full once a day, short afterwards, none under reduced motion
  var today = new Date().toISOString().slice(0, 10), seenToday = false;
  try { seenToday = localStorage.getItem("dc.bootDate") === today; localStorage.setItem("dc.bootDate", today); } catch (e) {}
  var mode = reduced ? "none" : seenToday ? "short" : "full";
  function bootDone() { if (window.__dcBootDone) return; window.__dcBootDone = true; window.dispatchEvent(new Event("dc:boot-done")); }
  if (mode === "none") {
    var b0 = document.getElementById("dc-boot"); if (b0) b0.remove();
    document.body.classList.remove("dc-booting"); bootDone();
  } else {
    play(mode, bootDone);
  }

  // ---- scroll reveal for every section
  var sections = document.querySelectorAll("section");
  if (reduced || !("IntersectionObserver" in window)) { document.body.classList.add("dc-nomotion"); }
  else {
    var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    sections.forEach(function (s) { io.observe(s); });
    // whatever is already on screen when the boot ends
    var revealNow = function () { sections.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top < innerHeight) s.classList.add("in"); }); };
    if (window.__dcBootDone) revealNow(); else window.addEventListener("dc:boot-done", revealNow, { once: true });
  }
})();
