"""
Build the Artifact-tool-ready version: body content only (no doctype/html/
head/body — the Artifact tool wraps the page in its own skeleton), with a
<title> and a <style> block, everything else inlined exactly like
build_artifact.py's dist/artifact.html. Same source-of-truth src/ files.
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).parent

def b64_data_uri(path: Path) -> str:
    mime = "image/png" if path.suffix == ".png" else "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"

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
main_js = main_js.replace(
    "function assetUrl(path) {\n  return `assets/${path}`;\n}",
    f"const ASSET_MAP = {asset_map_js};\nfunction assetUrl(path) {{ return ASSET_MAP[path]; }}",
)

bundled_script = "\n\n".join([
    "// ---- input layer ----", input_js,
    "// ---- logic layer ----", logic_js,
    "// ---- output layer ----", output_js,
    "// ---- wiring + simulated feed ----", main_js,
])

css = """
:root {
  --bg: #0e1512;
  --bg-raised: #141f1b;
  --ink: #eafffb;
  --ink-dim: rgba(234,255,251,0.6);
  --line: rgba(255,255,255,0.08);
  --accent: #3f8f8a;
  --accent-soft: rgba(63,143,138,0.18);
}
/* Deliberately single dark world -- a night, waterfall, breathing-break
   aesthetic is the whole point of this tool, so it stays dark in both
   system themes rather than inverting to a stark white "focus break". */
* { box-sizing: border-box; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  padding-inline: 16px;
}
header {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 10;
  margin-inline: -16px;
  padding: 14px 16px;
  background: rgba(14, 21, 18, 0.92);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
header h1 {
  font-size: 15px;
  margin: 0;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--ink);
}
header .sub {
  font-size: 12px;
  color: var(--ink-dim);
  margin-top: 2px;
}
#feed {
  max-width: 480px;
  margin: 0 auto;
  padding: 12px 0 200px;
}
.post {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.post-avatar {
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #1e433f);
}
.post-name {
  font-size: 13px;
  font-weight: 600;
  color: #cdece6;
  margin-bottom: 4px;
}
.post-text {
  font-size: 14px;
  line-height: 1.45;
  color: rgba(234,255,251,0.85);
}
"""

html = f"""<title>Tate Break Mechanics</title>
<style>
{css}
</style>
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
"""

out = ROOT / "dist" / "for_artifact_tool.html"
out.write_text(html)
print(f"wrote {out} ({out.stat().st_size:,} bytes)")
