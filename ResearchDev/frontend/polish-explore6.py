# -*- coding: utf-8 -*-
"""1. Rank Salons sits a little lower, clear of the list above it.
   2. Clear all moves ABOVE the filter pills and gets smaller.

Idempotent. Re-run after a revert:   python polish-explore6.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
QF = os.path.join(ROOT, 'src', 'components', 'QuickFilters.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ 1. QuickFilters: Clear all onto its own line, above ═════════
s = io.open(QF, encoding='utf-8').read()
if 'qf-row' in s:
    skipped.append('QuickFilters.jsx')
else:
    lines = s.split('\n')

    # lift the whole Clear all block out
    a = next(i for i, l in enumerate(lines) if 'Always rendered' in l)
    b = next(i for i, l in enumerate(lines) if i > a and l.strip() == ')}')
    clear_block = lines[a:b + 1]
    del lines[a:b + 2]                      # and the blank line after it

    # open a row around the pills, just after <div className="quick-filters">
    c = next(i for i, l in enumerate(lines) if 'className="quick-filters"' in l)
    # close it before the container's own closing </div>
    d = max(i for i, l in enumerate(lines) if l.strip() == '</div>')

    body = lines[c + 1:d]
    body = ['  ' + l if l.strip() else l for l in body]

    clear_block = ['  ' + l if l.strip() else l for l in clear_block]

    new = (lines[:c + 1]
           + clear_block
           + ['', '      <div className="qf-row">']
           + body
           + ['      </div>']
           + lines[d:])
    s = '\n'.join(new)

    s = s.replace("""      {/* Always rendered, so the row never changes width. It used to mount
          only when something was non-default, which meant the first click on
          a gender pushed every filter sideways to make room for it. Hidden
          rather than absent: the space stays reserved, and the control is
          taken out of the tab order and off the accessibility tree while
          there is nothing to clear. */}""",
                  """      {/* Above the pills, on its own line. It is not a filter, so standing in
            the row with them made it read as a fourth one — and mounting only
            when something was non-default pushed every pill sideways the
            first time you touched a gender.

            Still always rendered, hidden rather than absent: the line keeps
            its height so nothing below it moves, and the control leaves the
            tab order and the accessibility tree while there is nothing to
            clear. */}""")

    assert s.count('qf-row') == 1 and s.count('qf-clear') >= 1
    assert s.index('qf-clear') < s.index('qf-row'), 'clear must come first'
    io.open(QF, 'w', encoding='utf-8').write(s)
    done.append('QuickFilters.jsx')

# ══ 2. CSS ══════════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
changed = False

OLD_QF = """.quick-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem 0.9rem;
  margin-bottom: 1.25rem;
}"""
if OLD_QF in s:
    s = s.replace(OLD_QF, """/* A column now: the reset above, the pills below. */
.quick-filters {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
}
.qf-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem 0.9rem;
}""")
    changed = True

OLD_CLEAR = """.qf-clear { margin-left: 0.25rem; align-self: center; flex-shrink: 0; }"""
if OLD_CLEAR in s:
    s = s.replace(OLD_CLEAR, """/* Smaller than the pills it clears. It is an escape hatch, not a filter,
   and at the same size it competed with the controls for attention. */
.qf-clear {
  align-self: flex-end;
  flex-shrink: 0;
  margin: 0 0.25rem 0 0;
  padding: 0;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}""")
    changed = True

OLD_FOOT = """.sidebar-foot {
  flex-shrink: 0;               /* always visible — the filters scroll, not this */
  margin-top: 1.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--line-soft);
}"""
if OLD_FOOT in s:
    s = s.replace(OLD_FOOT, """.sidebar-foot {
  flex-shrink: 0;               /* always visible — the filters scroll, not this */
  /* Set down off the list. The button ends the panel rather than continuing
     it, and at 1.25rem it sat close enough to the last slider to read as one
     more row of the same group. */
  margin-top: 1.9rem;
  padding-top: 1.35rem;
  border-top: 1px solid var(--line-soft);
}""")
    changed = True

if changed:
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')
else:
    skipped.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
