#!/usr/bin/env python3
"""Assemble index.html (DreamCatcher) from Caesar's original 2027 求职雷达 + the DreamCatcher layer.

Kept verbatim from the original: the header copy (kicker / sub / asof), the deadline rail, sections ①–④,
策略笔记 and the footer, plus all of the original component CSS (only the colour tokens are re-based).
Added: doctype/meta, Klein-blue tokens, brand header with the moon logo, boot overlay, ⚡ 实时雷达.

Usage:  python3 scraper/tools/dc/build.py            -> index.html
        python3 scraper/tools/dc/build.py --embed     -> also writes DreamCatcher_PREVIEW.html with data/jobs.json inlined
"""
import re, sys, json, pathlib

here = pathlib.Path(__file__).parent
root = here.parent.parent.parent
orig = (here.parent / "original_radar.html").read_text(encoding="utf-8")

# ---- original CSS minus its palette blocks (our tokens replace them) ----
css_all = re.search(r"<style>(.*?)</style>", orig, re.S).group(1)
css_components = css_all[css_all.index("  * { margin: 0; padding: 0; box-sizing: border-box; }"):]
body = orig[orig.index('<div class="wrap">'):]
body = body[: body.rindex("</div>") + len("</div>")]
assert "<h1>2027 求职雷达</h1>" in body

# ---- brand header: logo + wordmark, original copy untouched ----
brand = ('<div class="brand"><div id="dc-brand-logo" aria-hidden="true" title="重放开机动画"></div>'
         '<div><h1>DreamCatcher</h1><div class="sub-title">2027 求职雷达<small>梦捕手 · Job Radar</small></div></div></div>')
body = body.replace("<h1>2027 求职雷达</h1>", brand, 1)

# ---- live section before ① ----
anchor = "<!-- ================= ① ================= -->"
assert anchor in body
body = body.replace(anchor, (here / "live.html").read_text(encoding="utf-8") + "\n" + anchor, 1)

theme_all = (here / "theme.css").read_text(encoding="utf-8")
_marker = "/* ---------- overrides on the curated sections"
theme_tokens, theme_overrides = theme_all.split(_marker, 1)
theme_overrides = _marker + theme_overrides
live_css = (here / "live.css").read_text(encoding="utf-8")
logo_js = (here / "logo.js").read_text(encoding="utf-8")
boot_js = (here / "boot.js").read_text(encoding="utf-8")
live_js = (here / "live.js").read_text(encoding="utf-8")
motion_js = (here / "motion.js").read_text(encoding="utf-8")
i18n_js = (here / "i18n.js").read_text(encoding="utf-8")
_i18n = json.loads((here / "i18n_curated.json").read_text(encoding="utf-8")); _i18n.pop("$comment", None)
i18n_map = "window.__DC_CURATED_EN = " + json.dumps(_i18n, ensure_ascii=False) + ";"

# only the sky is in the markup (covers the page before any script runs); boot.js fills in the rest
boot_html = '''<div id="dc-boot" aria-hidden="true"><div class="bg"></div></div>'''

import base64
_icon64 = root / "assets" / "icon-64.png"
_icon_inline = ("data:image/png;base64," + base64.b64encode(_icon64.read_bytes()).decode()) if _icon64.exists() else ""

def page(embed_json=None):
    embed = ("<script>window.__RADAR_EMBED = " + embed_json + ";</script>\n") if embed_json else ""
    # hosted page: manifest + icon files (assets/); embedded/app page: favicon inlined so it works from file://
    icons = ('<link rel="icon" href="' + _icon_inline + '">\n') if (embed_json and _icon_inline) else (
        '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="assets/icon-64.png">\n'
        '<link rel="apple-touch-icon" href="assets/icon-192.png">\n<meta name="theme-color" content="#002FA7">\n')
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>DreamCatcher · 2027 求职雷达</title>
{icons}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600&family=Cormorant+Garamond:ital,wght@0,600;1,600&display=swap">
<style>
{theme_tokens}
{css_components}
{theme_overrides}
{live_css}
</style>
</head>
<body class="dc-booting">
{boot_html}
{body}
{embed}<script>
{logo_js}
</script>
<script>
{i18n_map}
{i18n_js}
</script>
<script>
{boot_js}
</script>
<script>
{live_js}
</script>
<script>
{motion_js}
</script>
</body>
</html>
'''

out = root / "index.html"
out.write_text(page(), encoding="utf-8")
print("wrote", out, len(out.read_text(encoding="utf-8")), "bytes")

if "--embed" in sys.argv:
    data = json.loads((root / "data" / "jobs.json").read_text(encoding="utf-8"))
    data["$preview"] = "Real postings captured on 2026-09-09 from the live career sites (full-time only); the deployed page reads data/jobs.json refreshed every 3 hours."
    prev = root / "DreamCatcher_PREVIEW.html"
    prev.write_text(page(json.dumps(data, ensure_ascii=False)), encoding="utf-8")
    print("wrote", prev, len(prev.read_text(encoding="utf-8")), "bytes")
