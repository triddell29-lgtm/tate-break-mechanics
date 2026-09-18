"""
Build a single self-contained HTML file for deployment (e.g. via a
publish-as-hosted-page tool that blocks external resource loads and
requires everything inlined). Reads the same modular source files used for
the GitHub repo / local-dev version and inlines:
  - style.css into a <style> tag
  - main.js + the three src/ modules concatenated into one <script type=module>
    (import/export statements stripped since it's now one file)
  - every PNG/JPG asset as a base64 data: URI, keyed by its relative path

This script is a build step, not a second copy of the logic: the modular
files in src/ remain the single source of truth: this only repackages them.
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).parent

def b64_data_uri(path: Path) -> str:
    mime = "image/png" if path.suffix == ".png" else "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"

# Build an asset map: relative path (as used by assetUrl in the source) -> data URI
asset_map = {}
for p in (ROOT / "assets").rglob("*"):
    if p.is_file():
        rel = str(p.relative_to(ROOT / "assets"))
        asset_map[rel] = b64_data_uri(p)

asset_map_js = "{\n" + ",\n".join(
    f"  {rel!r}: {uri!r}" for rel, uri in sorted(asset_map.items())
) + "\n}"

def strip_module_syntax(src: str) -> str:
    src = re.sub(r"^\s*import\s+\{[^}]*\}\s+from\s+['\"][^'\"]+['\"];?\s*$", "", src, flags=re.M)
    src = re.sub(r"^\s*export\s+function", "function", src, flags=re.M)
    src = re.sub(r"^\s*export\s+\{[^}]*\};?\s*$", "", src, flags=re.M)
    return src

input_js = strip_module_syntax((ROOT / "src/input/scrollInput.js").read_text())
logic_js = strip_module_syntax((ROOT / "src/logic/breakEngine.js").read_text())
output_js = strip_module_syntax((ROOT / "src/output/tateRenderer.js").read_text())
main_js = strip_module_syntax((ROOT / "main.js").read_text())
# main.js calls assetUrl(path) -> `assets/${path}`; swap for a lookup into
# the inlined ASSET_MAP so the bundled file needs no network/file access.
main_js = main_js.replace(
    "function assetUrl(path) {\n  return `assets/${path}`;\n}",
    f"const ASSET_MAP = {asset_map_js};\nfunction assetUrl(path) {{ return ASSET_MAP[path]; }}",
)

css = (ROOT / "style.css").read_text()

bundled_script = "\n\n".join([
    "// ---- input layer ----", input_js,
    "// ---- logic layer ----", logic_js,
    "// ---- output layer ----", output_js,
    "// ---- wiring + simulated feed ----", main_js,
])

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tate Break — mechanics prototype</title>
<style>
{css}
</style>
</head>
<body>
<header>
  <div>
    <h1>a normal feed</h1>
    <div class="sub">Tate Break mechanics prototype &mdash; scroll to test it</div>
  </div>
</header>
<main id="feed"></main>
<script>
{bundled_script}
</script>
</body>
</html>
"""

out = ROOT / "dist" / "artifact.html"
out.write_text(html)
print(f"wrote {out} ({out.stat().st_size:,} bytes)")
