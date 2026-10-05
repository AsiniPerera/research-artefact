# -*- coding: utf-8 -*-
"""1. Priorities toggle reads Show more / Show less, nothing else.
   2. The priorities RESET shrinks to match the filters' Clear all.
   3. Rank Salons drops ~1.5cm clear of the list.
   4. The chosen gender changes colour only — no puck, no border.

Idempotent. Re-run after a revert:   python polish-explore8.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
WL = os.path.join(ROOT, 'src', 'components', 'WeightLevels.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ 1. Show more / Show less ════════════════════════════════════
s = io.open(WL, encoding='utf-8').read()
if '"Show more"' in s:
    skipped.append('WeightLevels.jsx')
else:
    OLD = """      {/* Says how many are behind it rather than just "more": the number is
          what tells you whether this is worth opening. */}
      <button
        type="button"
        className="weight-more"
        aria-expanded={showAll}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? "Show fewer" : `See all ${CATEGORIES.length} — ${hidden} more`}
      </button>"""
    assert s.count(OLD) == 1, 'toggle not found'
    s = s.replace(OLD, """      <button
        type="button"
        className="weight-more"
        aria-expanded={showAll}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? "Show less" : "Show more"}
      </button>""")
    # `hidden` counted the rows the old label named; nothing reads it now.
    s = s.replace("""  const hidden = CATEGORIES.length - shown.length;\n""", "")
    assert 'hidden' not in s.split('return (')[0].split('const shown')[1]
    io.open(WL, 'w', encoding='utf-8').write(s)
    done.append('WeightLevels.jsx')

# ══ 2-4. CSS ════════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
MARK = '/* -- rail reset, foot drop, plain gender -- */'
if MARK in s:
    skipped.append('index.css')
else:
    # 3. the foot drops clear of the last slider
    OLD_FOOT = """  margin-top: 1.9rem;
  padding-top: 1.35rem;"""
    assert s.count(OLD_FOOT) == 1, 'sidebar-foot spacing not found'
    s = s.replace(OLD_FOOT, """  /* ~1.5cm of air above the button. At 96dpi that is 3.5rem, and the point
     of it is that the button ENDS the panel rather than continuing the list
     — close to the last slider it read as one more row. */
  margin-top: 3.5rem;
  padding-top: 1.35rem;""")

    # 4. the chosen gender is a colour, not an object
    OLD_SEG = """/* Chosen is a solid white puck riding in the glass, not a beige fill. On a
   translucent pill the one opaque shape is unmistakably the selection, and
   needs no colour of its own to say so. */
.qf-field--seg .segmented button[aria-pressed="true"],
.segmented--sm button[aria-pressed="true"] {
  background: #fff;
  color: var(--ink);
  box-shadow:
    0 1px 2px rgba(22, 21, 15, 0.16),
    0 0 0 1px rgba(22, 21, 15, 0.05);
}"""
    assert s.count(OLD_SEG) == 1, 'segmented selected rule not found'
    s = s.replace(OLD_SEG, MARK + """

/* Chosen is a COLOUR, nothing else. It was a white puck with its own shadow
   and hairline — a second object inside the pill, so the control carried two
   nested shapes for one choice. Weight carries it alongside the hue, because
   colour alone is not a state anyone should have to depend on. */
.qf-field--seg .segmented button[aria-pressed="true"],
.segmented--sm button[aria-pressed="true"] {
  background: none;
  box-shadow: none;
  color: var(--slate);
  font-weight: 700;
}
.qf-field--seg .segmented button[aria-pressed="true"]:hover,
.segmented--sm button[aria-pressed="true"]:hover {
  background: none;
  color: var(--slate-700);
}

/* 2. The rail's RESET, sized like the filters' Clear all. Both undo a set of
   choices rather than making one, and neither should read as loud as the
   controls it clears. */
.priority-panel--rail .priority-panel-head .btn-text {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  padding: 0;
}"""
)
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
