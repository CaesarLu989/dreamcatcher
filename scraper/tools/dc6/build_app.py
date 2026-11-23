#!/usr/bin/env python3
"""Build the icons and DreamCatcher.app (macOS) for v6.

  python3 scraper/tools/dc6/build_app.py [--out dist] [--version 6.0.0] [--data-url URL] [--site-url URL]

What it does:
  1. builds index.html (node scraper/tools/dc6/build.mjs);
  2. draws the white desktop icon from the same code the page uses (core.js → appIcon) in headless Chromium (Playwright),
     writes assets/icon-512/192/64.png + manifest.webmanifest for the site, and AppIcon.icns for the app (Pillow);
  3. assembles
        DreamCatcher.app/Contents/Info.plist
        DreamCatcher.app/Contents/MacOS/DreamCatcher        (bash launcher)
        DreamCatcher.app/Contents/Resources/AppIcon.icns
        DreamCatcher.app/Contents/Resources/DreamCatcher.html   (the page with the current data inside, so it opens offline)
        DreamCatcher.app/Contents/Resources/config.sh           (SITE_URL / DATA_URL, editable)
  4. zips it (the zip keeps the executable bit, so the app survives any transfer).

The launcher opens the page in a chromeless Chrome / Edge / Brave window with its own profile
(~/Library/Application Support/DreamCatcher — the same one earlier versions used, so what you marked as applied or
dismissed is still there), and falls back to the default browser. Needs: node 22+, python3 with playwright and Pillow.
"""
import argparse, json, os, pathlib, plistlib, shutil, subprocess, sys, zipfile

here = pathlib.Path(__file__).resolve().parent
root = here.parent.parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("--out", default=str(root / "dist"))
ap.add_argument("--version", default="6.0.0")
ap.add_argument("--data-url", default="https://caesarlu989.github.io/dreamcatcher/data/radar.json")
ap.add_argument("--site-url", default="")
args = ap.parse_args()
out = pathlib.Path(args.out); out.mkdir(parents=True, exist_ok=True)

# ---------- 1. page ----------
subprocess.run(["node", str(here / "build.mjs")], check=True, cwd=root)

# ---------- 2. icons ----------
def render_icons():
    from playwright.sync_api import sync_playwright
    core = (here / "core.js").read_text(encoding="utf-8")
    shots = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, size, canvas in (("mac", 1024, True), ("512", 512, False), ("192", 192, False), ("64", 64, False)):
            pg = b.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
            pg.set_content("<!doctype html><html><body style='margin:0;background:transparent'><script>%s\ndocument.body.innerHTML = appIcon(%d, { canvas: %s });</script></body></html>" % (core, size, "true" if canvas else "false"))
            pg.wait_for_timeout(150)
            shots[name] = pg.screenshot(omit_background=True)
            pg.close()
        b.close()
    return shots

shots = render_icons()
(root / "assets").mkdir(exist_ok=True)
for s in ("512", "192", "64"):
    (root / "assets" / f"icon-{s}.png").write_bytes(shots[s])
(root / "manifest.webmanifest").write_text(json.dumps({
    "name": "DreamCatcher · 2027 求职雷达", "short_name": "DreamCatcher", "start_url": "./index.html", "display": "standalone",
    "background_color": "#10141F", "theme_color": "#10141F", "lang": "zh-CN",
    "icons": [{"src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png"}],
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
icon_png = out / "DreamCatcher_icon_1024.png"
icon_png.write_bytes(shots["mac"])
print("icons: assets/icon-512.png, icon-192.png, icon-64.png,", icon_png)

# ---------- 3. bundle ----------
app = out / "DreamCatcher.app"
if app.exists(): shutil.rmtree(app)
(contents := app / "Contents").mkdir(parents=True)
(macos := contents / "MacOS").mkdir()
(res := contents / "Resources").mkdir()

from PIL import Image
im = Image.open(icon_png).convert("RGBA")
assert im.size == (1024, 1024), im.size
im.save(res / "AppIcon.icns", format="ICNS")   # Pillow writes every macOS size from the master image

with open(contents / "Info.plist", "wb") as f:
    plistlib.dump({
        "CFBundleName": "DreamCatcher", "CFBundleDisplayName": "DreamCatcher", "CFBundleIdentifier": "com.caesar.dreamcatcher",
        "CFBundleVersion": args.version, "CFBundleShortVersionString": args.version, "CFBundlePackageType": "APPL", "CFBundleSignature": "????",
        "CFBundleExecutable": "DreamCatcher", "CFBundleIconFile": "AppIcon", "CFBundleInfoDictionaryVersion": "6.0", "CFBundleDevelopmentRegion": "zh_CN",
        "LSMinimumSystemVersion": "11.0", "LSUIElement": True, "NSHighResolutionCapable": True,
        "NSHumanReadableCopyright": "DreamCatcher · 梦捕手 · 2027 求职雷达",
    }, f)
(contents / "PkgInfo").write_text("APPL????")

launcher = r'''#!/bin/bash
# DreamCatcher launcher — opens the radar in a chromeless Chrome window (or the default browser).
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
SITE_URL=""; DATA_URL=""
[ -f "$RES/config.sh" ] && . "$RES/config.sh"

if [ -n "$SITE_URL" ]; then
  TARGET="$SITE_URL"
else
  TARGET="file://$RES/DreamCatcher.html"
  [ -n "$DATA_URL" ] && TARGET="$TARGET?data=$DATA_URL"
fi

CHROME=""
for c in "/Applications/Google Chrome.app" "$HOME/Applications/Google Chrome.app" "/Applications/Microsoft Edge.app" "/Applications/Brave Browser.app" "/Applications/Arc.app"; do
  [ -d "$c" ] && CHROME="$c" && break
done

if [ -n "$CHROME" ] && [ "${DC_APP_MODE:-1}" = "1" ]; then
  # own profile => a separate chromeless window that never collides with the running browser
  PROFILE="$HOME/Library/Application Support/DreamCatcher"
  mkdir -p "$PROFILE"
  open -n -a "$CHROME" --args --app="$TARGET" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check --window-size=1440,960
else
  open "$TARGET"
fi
'''
(macos / "DreamCatcher").write_text(launcher)
os.chmod(macos / "DreamCatcher", 0o755)
(res / "config.sh").write_text(f'''# DreamCatcher.app settings — edit and save; the next launch picks it up.
# SITE_URL: open the hosted site instead of the built-in page (e.g. https://<you>.github.io/dreamcatcher/).
SITE_URL="{args.site_url}"
# DATA_URL: keep the built-in page but fetch fresh data from here on every launch and every few minutes
# (the built-in page carries the data of the day it was built, and shows that when you are offline).
DATA_URL="{args.data_url}"
''')
subprocess.run(["node", str(here / "build.mjs"), "--embed", "--out", str(res / "DreamCatcher.html")], check=True, cwd=root)

# ---------- 4. checks + zip ----------
with open(contents / "Info.plist", "rb") as f: plistlib.load(f)
subprocess.run(["bash", "-n", str(macos / "DreamCatcher")], check=True)
zpath = out / "DreamCatcher.app.zip"
if zpath.exists(): zpath.unlink()
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(app.rglob("*")):
        zi = zipfile.ZipInfo(str(p.relative_to(out)) + ("/" if p.is_dir() else ""))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = ((0o755 if (p.is_dir() or os.access(p, os.X_OK)) else 0o644) | (0o040000 if p.is_dir() else 0o100000)) << 16
        if p.is_dir(): z.writestr(zi, b"")
        else: z.writestr(zi, p.read_bytes())
print("app:", app)
print("zip:", zpath, os.path.getsize(zpath), "bytes")
