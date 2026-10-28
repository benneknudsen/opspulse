#!/usr/bin/env python3
"""Regenerate QA renders from reference/vision.html.

Usage: python3 reference/.build-qa.py <variant>
  all      -> one tall sheet with every view stacked (visual QA)
  states   -> the queue-action-states view alone
  danish   -> light theme + Danish + compact (localization/density QA)
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / "reference" / "vision.html"

# The script block that boots the prototype.
INIT = re.compile(
    r"(\{ const h = location\.hash\.slice\(1\)\.split\('/'\); showView\(h\[0\] \|\| 'dashboard', h\[1\]\); \}\s*\n)",
    re.M,
)

QA = """<script>
/* QA harness — surfaces any runtime error instead of failing silently. */
window.addEventListener('error', function (e) {
  var b = document.createElement('div');
  b.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#7a0010;color:#fff;font:13px/1.5 monospace;padding:20px;white-space:pre-wrap;overflow:auto';
  b.textContent = 'RUNTIME ERROR\\n' + (e.message || '') + '\\n' + (e.filename || '') + ':' + (e.lineno || '') + '\\n\\n' + ((e.error && e.error.stack) || '');
  document.body.appendChild(b);
});
</script>
"""


def build(variant: str) -> Path:
    html = SRC.read_text(encoding="utf-8")

    if variant == "all":
        inject = """
try {
  document.querySelectorAll('.view').forEach(v => v.hidden = false);
  document.querySelectorAll('.refbar nav button').forEach(t => t.setAttribute('aria-pressed', 'false'));
  window.scrollTo(0, 0);
} catch (err) { throw err; }
"""
        out = BASE / "reference" / ".qa-all.html"
    elif variant == "states":
        inject = """
try {
  showView('states');
} catch (err) { throw err; }
"""
        out = BASE / "reference" / ".qa-states.html"
    elif variant == "spec":
        inject = """
try {
  showView('spec');
} catch (err) { throw err; }
"""
        out = BASE / "reference" / ".qa-spec.html"
    elif variant == "danish-spec":
        inject = """
try {
  lang = 'da';
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.setAttribute('data-density', 'compact');
  applyI18n();
  showView('spec');
} catch (err) {
  var b = document.createElement('div');
  b.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#7a0010;color:#fff;font:13px/1.5 monospace;padding:20px;white-space:pre-wrap;overflow:auto';
  b.textContent = 'RUNTIME ERROR\\n' + err.message + '\\n' + (err.stack || '');
  document.body.appendChild(b);
}
"""
        out = BASE / "reference" / ".qa-danish-spec.html"
    elif variant == "danish":
        inject = """
try {
  lang = 'da';
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.setAttribute('data-density', 'compact');
  applyI18n();
  showView('states');
} catch (err) {
  var b = document.createElement('div');
  b.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#7a0010;color:#fff;font:13px/1.5 monospace;padding:20px;white-space:pre-wrap;overflow:auto';
  b.textContent = 'RUNTIME ERROR\\n' + err.message + '\\n' + (err.stack || '');
  document.body.appendChild(b);
}
"""
        out = BASE / "reference" / ".qa-danish.html"
    else:
        raise SystemExit(f"unknown variant: {variant}")

    m = INIT.search(html)
    if not m:
        raise SystemExit("could not find the init anchor in vision.html")
    html = html[: m.end()] + "\n" + inject + html[m.end():]

    # Insert the error probe right before the main script block.
    marker = "<script>\n/* ══════════════════════════════════════════════════════════════════════════\n   OpsPulse design reference"
    if marker in html:
        html = html.replace(marker, QA + marker, 1)

    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    variant = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(build(variant))
