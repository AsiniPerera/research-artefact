# -*- coding: utf-8 -*-
"""Your Priorities opens on four categories, with See all revealing ten.

Idempotent. Re-run after a revert:   python polish-explore3.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'components', 'WeightLevels.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ── WeightLevels: preview four, disclose ten ──────────────────────
s = io.open(JSX, encoding='utf-8').read()
if 'PREVIEW_COUNT' in s:
    skipped.append('WeightLevels.jsx')
else:
    assert 'const CATEGORIES = [' in s, 'categories missing'
    assert 'export function WeightLevels' in s, 'component missing'

    # React import
    if not s.lstrip().startswith('import'):
        s = 'import { useState } from "react";\n\n' + s
    elif 'useState' not in s.split('\n')[0]:
        s = 'import { useState } from "react";\n' + s

    s = s.replace("""const DEFAULT_LEVEL = 2;""",
                  """/* Four, then the rest. Ten categories in a 340px rail is a column of
   sliders taller than the viewport, and the first thing the page asks of
   someone becomes a scroll. Four is enough to show what the control IS —
   a label, a track, a named level — and to make clear there are more. */
const PREVIEW_COUNT = 4;

const DEFAULT_LEVEL = 2;""")

    s = s.replace("""export function WeightLevels({ weights, onChange }) {
  return (
    <ul className="weight-list">
      {CATEGORIES.map(({ key, label, tag, validationOnly }) => {""",
                  """export function WeightLevels({ weights, onChange }) {
  const [showAll, setShowAll] = useState(false);
  /* Collapsed rows are UNMOUNTED, not hidden. The weights live in the page
     above, so nothing set is lost by folding them away — and six range
     inputs left in the tree would keep taking tab stops from a control the
     visitor has put away. */
  const shown = showAll ? CATEGORIES : CATEGORIES.slice(0, PREVIEW_COUNT);
  const hidden = CATEGORIES.length - shown.length;

  return (
    <>
      <ul className="weight-list">
        {shown.map(({ key, label, tag, validationOnly }) => {""")

    # close the list and add the toggle
    old_tail = """        );
      })}
    </ul>
  );
}"""
    new_tail = """          );
        })}
      </ul>

      {/* Says how many are behind it rather than just "more": the number is
          what tells you whether this is worth opening. */}
      <button
        type="button"
        className="weight-more"
        aria-expanded={showAll}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? "Show fewer" : `See all ${CATEGORIES.length} — ${hidden} more`}
      </button>
    </>
  );
}"""
    assert s.count(old_tail) == 1, 'render tail not found'
    s = s.replace(old_tail, new_tail)

    # everything inside the map is one level deeper now
    start = s.index('        {shown.map(')
    end = s.index('          );\n        })}')
    body = s[start:end]
    s = s[:start] + '\n'.join(
        ('  ' + ln if ln.strip() else ln) for ln in body.split('\n')
    ).lstrip('\n').rjust(0) + s[end:]
    # re-fix the map opener which the reindent also shifted
    s = s.replace('          {shown.map(', '        {shown.map(')

    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('WeightLevels.jsx')

# ── The toggle ────────────────────────────────────────────────────
s = io.open(CSS, encoding='utf-8').read()
if '.weight-more' in s:
    skipped.append('index.css')
else:
    anchor = '/* -- explore polish -- */'
    add = """/* Full width and rule-topped, so it reads as the end of the list rather
   than a control floating after it. */
.weight-more {
  width: 100%;
  margin-top: 0.9rem;
  padding: 0.6rem 0.5rem;
  background: none;
  border: 0;
  border-top: 1px solid var(--line-soft);
  border-radius: 0;
  cursor: pointer;
  font: inherit;
  font-size: 0.73rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--gold);
  transition: color 0.15s var(--ease);
}
.weight-more:hover { color: var(--gold-600); }

"""
    if anchor in s:
        s = s.replace(anchor, add + anchor)
    else:
        btn = "/* ── Buttons ───"
        assert s.count(btn) == 1
        s = s.replace(btn, add + btn)
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
