/* ===== DreamCatcher boot sequence + header logo + scroll reveal =====
   Full sequence (once a day, ≈4.2 s): a scan line crosses the black screen, the hoop is drawn by a spark, the
   radar web assembles spoke by spoke and ring by ring, the sweep makes its first turn, the Klein crescent snaps
   in, the threads drop, the wordmark is revealed left-to-right behind a cursor and tightens — then the logo
   flies into the header and the page appears beneath it. Short sequence (≈1.7 s) the rest of the day; skip always available. */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var brand = document.getElementById("dc-brand-logo");
  if (brand) brand.innerHTML = dcLogo(96, "dcH", { animate: false });

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function fill(boot, mode) {
    boot.className = mode === "short" ? "short" : "";
    boot.innerHTML = '<div class="bg"></div><div class="stars"></div><div class="meteors"></div><div class="scan"></div>' +
      '<i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>' +
      '<div class="logo"></div>' +
      '<div class="word"><div class="w">Dream<b>Catcher</b><i class="cursor"></i></div><div class="line"></div></div>' +
      '<button class="skip" type="button">SKIP</button>';
    // sparse star field: 44 points, a few brighter
    var stars = boot.querySelector(".stars"), frag = document.createDocumentFragment();
    for (var i = 0; i < 44; i++) {
      var s = document.createElement("i");
      s.style.left = rnd(0, 100) + "%"; s.style.top = rnd(0, 100) + "%";
      s.style.setProperty("--d", rnd(0, 3.6).toFixed(2) + "s"); s.style.setProperty("--o", rnd(0.3, 0.9).toFixed(2));
      s.style.setProperty("--in", rnd(0, 1.4).toFixed(2) + "s");
      if (Math.random() < 0.18) s.className = "big";
      frag.appendChild(s);
    }
    stars.appendChild(frag);
    // one thin meteor in the full sequence
    var met = boot.querySelector(".meteors"), delays = mode === "short" ? [] : [1.9];
    delays.forEach(function (d) {
      var m = document.createElement("i");
      m.style.left = rnd(55, 85) + "%"; m.style.top = rnd(10, 26) + "%";
      m.style.setProperty("--d", d + "s"); m.style.setProperty("--len", Math.round(rnd(120, 200)) + "px");
      met.appendChild(m);
    });
    boot.querySelector(".logo").innerHTML = dcLogo(mode === "short" ? 150 : 200, "dcB", { animate: mode === "full" });
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
        bl.style.transition = "transform .8s cubic-bezier(.7,0,.22,1)";
        bl.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
        boot.classList.add("fly"); wait = 820;
      } else { boot.classList.add("out"); }
      onDone && onDone();
      setTimeout(function () { boot.remove(); if (brand) brand.style.visibility = ""; document.body.classList.remove("dc-booting"); }, wait);
    }
    boot.querySelector(".skip").onclick = function () { finish(true); };
    boot.addEventListener("click", function (e) { if (e.target === boot || e.target.className === "bg") finish(true); });
    setTimeout(function () { finish(false); }, mode === "short" ? 1750 : 4300);
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
