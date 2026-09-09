#!/usr/bin/env python3
"""Build DreamCatcher.app — a one-click macOS launcher with the moon-logo icon.

    python3 scraper/tools/dc/build_app.py [--site-url URL] [--data-url URL] [--out DIR]

What it does
  1. renders scraper/tools/dc/icon.html (the DreamCatcher logo on a Klein-blue squircle) to a 1024 px PNG
     with headless Chromium (Playwright) and converts it to Resources/AppIcon.icns (Pillow) + PWA PNGs;
  2. assembles the bundle:
        DreamCatcher.app/Contents/Info.plist
        DreamCatcher.app/Contents/MacOS/DreamCatcher      (bash launcher)
        DreamCatcher.app/Contents/Resources/AppIcon.icns
        DreamCatcher.app/Contents/Resources/DreamCatcher.html   (self-contained page, data embedded)
        DreamCatcher.app/Contents/Resources/config.sh     (SITE_URL / DATA_URL — edit to point at the live site)
  3. zips it (zip keeps the executable bit, so the .app survives any transfer).

The launcher opens the page in Chrome's app mode (chromeless window, own profile) when Chrome is installed,
otherwise in the default browser. If config.sh sets SITE_URL the app opens the hosted site instead of the
embedded page; if it sets DATA_URL the embedded page fetches fresh data/jobs.json from that URL.
"""
import argparse, json, os, pathlib, plistlib, shutil, subprocess, sys, zipfile

here = pathlib.Path(__file__).parent
root = here.parent.parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("--site-url", default="")
ap.add_argument("--data-url", default="")
ap.add_argument("--out", default=str(root / "dist"))
ap.add_argument("--version", default="1.0")
args = ap.parse_args()

out = pathlib.Path(args.out); out.mkdir(parents=True, exist_ok=True)
icon_png = out / "DreamCatcher_icon_1024.png"

# ---------- 1. icon ----------
def render_icon():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1024, "height": 1024}, device_scale_factor=1)
        pg.goto((here / "icon.html").resolve().as_uri(), wait_until="load")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(icon_png), omit_background=True)
        b.close()
    print("icon:", icon_png)

def make_icns(png, icns):
    from PIL import Image
    im = Image.open(png).convert("RGBA")
    assert im.size == (1024, 1024), im.size
    # Pillow writes every macOS size (16…512 @1x/@2x) from this master image
    im.save(icns, format="ICNS")
    (root / "assets").mkdir(exist_ok=True)
    for s in (512, 192, 64):
        im.resize((s, s), Image.LANCZOS).save(root / "assets" / f"icon-{s}.png")   # PWA manifest + favicon
    (root / "manifest.webmanifest").write_text(json.dumps({
        "name": "DreamCatcher · 2027 求职雷达", "short_name": "DreamCatcher", "start_url": "./index.html",
        "display": "standalone", "background_color": "#070C1F", "theme_color": "#002FA7", "lang": "zh-CN",
        "icons": [{"src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]
    }, ensure_ascii=False, indent=2))
    print("icns:", icns, os.path.getsize(icns), "bytes")

render_icon()

# ---------- 2. bundle ----------
app = out / "DreamCatcher.app"
if app.exists(): shutil.rmtree(app)
(contents := app / "Contents").mkdir(parents=True)
(macos := contents / "MacOS").mkdir()
(res := contents / "Resources").mkdir()

make_icns(icon_png, res / "AppIcon.icns")

plist = {
    "CFBundleName": "DreamCatcher",
    "CFBundleDisplayName": "DreamCatcher",
    "CFBundleIdentifier": "com.caesar.dreamcatcher",
    "CFBundleVersion": args.version,
    "CFBundleShortVersionString": args.version,
    "CFBundlePackageType": "APPL",
    "CFBundleSignature": "????",
    "CFBundleExecutable": "DreamCatcher",
    "CFBundleIconFile": "AppIcon",
    "CFBundleInfoDictionaryVersion": "6.0",
    "CFBundleDevelopmentRegion": "zh_CN",
    "LSMinimumSystemVersion": "11.0",
    "LSUIElement": True,              # no Dock bounce: the launcher hands off to the browser and exits
    "NSHighResolutionCapable": True,
    "NSHumanReadableCopyright": "DreamCatcher · 梦捕手 · 2027 求职雷达",
}
with open(contents / "Info.plist", "wb") as f:
    plistlib.dump(plist, f)
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
  open -n -a "$CHROME" --args --app="$TARGET" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check --window-size=1280,900
else
  open "$TARGET"
fi
'''
(macos / "DreamCatcher").write_text(launcher)
os.chmod(macos / "DreamCatcher", 0o755)

(res / "config.sh").write_text(f'''# DreamCatcher.app settings — edit and save; the next launch picks it up.
# SITE_URL: open the hosted site instead of the built-in page (e.g. https://<you>.github.io/dreamcatcher/).
SITE_URL="{args.site_url}"
# DATA_URL: keep the built-in page but fetch fresh data from here every launch
# (e.g. https://raw.githubusercontent.com/<you>/dreamcatcher/main/data/jobs.json).
DATA_URL="{args.data_url}"
''')

# the self-contained page with the latest captured data embedded
subprocess.run([sys.executable, str(here / "build.py"), "--embed"], check=True, cwd=root)
shutil.copy(root / "DreamCatcher_PREVIEW.html", res / "DreamCatcher.html")

# ---------- 3. checks + zip ----------
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
