# -*- coding: utf-8 -*-
"""1. All ten categories rank. Customer Trust & Recommendation loses its
      validation-only status and takes a slider like the rest.
   2. Clear all stops shifting the filter row when it appears.

Idempotent. Re-run after a revert:   python polish-explore5.py
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
WL = os.path.join(ROOT, 'src', 'components', 'WeightLevels.jsx')
PR = os.path.join(ROOT, 'src', 'constants', 'presets.js')
QF = os.path.join(ROOT, 'src', 'components', 'QuickFilters.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ 1. WeightLevels: ten weighted ═══════════════════════════════
s = io.open(WL, encoding='utf-8').read()
if 'validationOnly' not in s:
    skipped.append('WeightLevels.jsx')
else:
    s = s.replace("""//
// Ten categories, NINE of them weighted. Customer Trust & Recommendation is
// listed in its own place in the order — it is one of the ten and should be
// visible as one — but it validates a ranking rather than producing one, so
// it carries `validationOnly` and gets no slider. A control that cannot
// change the result must not look like one that can.""",
                  """//
// All ten are weighted. Customer Trust & Recommendation was held out as
// validation-only and shown without a slider; it ranks like the rest now, so
// there is no exception left in this list.""")

    s = s.replace("""  {
    key: "customer_trust_recommendation",
    label: "Customer Trust & Recommendation",
    tag: "repeat & referral",
    validationOnly: true,
  },""",
                  """  { key: "customer_trust_recommendation", label: "Customer Trust & Recommendation", tag: "repeat & referral" },""")

    s = s.replace("""/** The nine keys that actually carry a weight — the single source anything
    building or checking a weight set should read, so nothing has to remember
    which of the ten is the exception. */
export const WEIGHTED_KEYS = CATEGORIES
  .filter((c) => !c.validationOnly)
  .map((c) => c.key);""",
                  """/** Every key that carries a weight — all ten. Kept as its own export so a
    caller never has to derive it from CATEGORIES, and so reintroducing an
    exception later is a change in one place. */
export const WEIGHTED_KEYS = CATEGORIES.map((c) => c.key);""")

    s = s.replace("""        {shown.map(({ key, label, tag, validationOnly }) => {""",
                  """        {shown.map(({ key, label, tag }) => {""")

    # the validation branch goes
    a = s.index("""          /* No level, so no data-level: the colour ramp would imply a setting
             this row does not have. */""")
    b = s.index("""          return (
            /* data-level drives the row's colour in CSS""")
    s = s[:a] + s[b:]

    assert 'validationOnly' not in s and 'weight-locked' not in s
    io.open(WL, 'w', encoding='utf-8').write(s)
    done.append('WeightLevels.jsx')

# ══ 2. Presets gain the tenth key ═══════════════════════════════
s = io.open(PR, encoding='utf-8').read()
if 'customer_trust_recommendation' in s:
    skipped.append('presets.js')
else:
    s = s.replace("""// NINE keys each, matching WEIGHTED_KEYS in WeightLevels. Customer Trust &
// Recommendation is the tenth category but validates a ranking rather than
// producing one, so it never carries a weight and never appears here.""",
                  """// TEN keys each, matching WEIGHTED_KEYS in WeightLevels.""")
    # trust sits just after owner_responsiveness, as it does in the category list
    trust = {
        'balanced': 2,
        # Reputation follows from the work rather than standing in for it.
        'quality': 2,
        # Word of mouth is not what someone chasing a price is buying.
        'budget': 1,
        'hygiene': 2,
        # One appointment, no second chance: who else trusted them matters.
        'bridal': 4,
    }
    for name, val in trust.items():
        pat = r'(  ' + name + r': \{(?:[^}]*?))(\n    owner_responsiveness:\s+\d,)'
        new = r'\1\2\n    customer_trust_recommendation: %d,' % val
        s2 = re.sub(pat, new, s, count=1)
        assert s2 != s, 'preset %s not patched' % name
        s = s2
    io.open(PR, 'w', encoding='utf-8').write(s)
    done.append('presets.js')

# ══ 3. Clear all reserves its space ═════════════════════════════
s = io.open(QF, encoding='utf-8').read()
if 'qf-clear--idle' in s:
    skipped.append('QuickFilters.jsx')
else:
    s = s.replace("""      {/* Sits with the filters it clears rather than in a row of its own,
          and stays out of the way until something is actually non-default. */}
      {!isDefault && onReset && (
        <button type="button" className="btn-text qf-clear" onClick={onReset}>
          Clear all
        </button>
      )}""",
                  """      {/* Always rendered, so the row never changes width. It used to mount
          only when something was non-default, which meant the first click on
          a gender pushed every filter sideways to make room for it. Hidden
          rather than absent: the space stays reserved, and the control is
          taken out of the tab order and off the accessibility tree while
          there is nothing to clear. */}
      {onReset && (
        <button
          type="button"
          className={`btn-text qf-clear ${isDefault ? "qf-clear--idle" : ""}`}
          onClick={onReset}
          aria-hidden={isDefault}
          tabIndex={isDefault ? -1 : 0}
        >
          Clear all
        </button>
      )}""")
    assert 'qf-clear--idle' in s
    io.open(QF, 'w', encoding='utf-8').write(s)
    done.append('QuickFilters.jsx')

# ══ 4. CSS ══════════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
changed = False

if 'qf-clear--idle' not in s:
    s = s.replace(""".qf-clear { margin-left: 0.25rem; align-self: center; flex-shrink: 0; }""",
                  """.qf-clear { margin-left: 0.25rem; align-self: center; flex-shrink: 0; }
/* visibility, not display: the button keeps its box so the row's width never
   changes, which is the whole point of rendering it while it is unusable. */
.qf-clear--idle { visibility: hidden; pointer-events: none; }""")
    changed = True

# the validation row's styling has nothing left to style
old_val = """/* The tenth category. It keeps its place in the list so the ten are all
   visible, but where the other nine have a track it states plainly that it
   has none — a greyed-out slider would suggest a control that is merely
   disabled, and this one will never be enabled. */
.weight-row--validation .weight-label { color: var(--muted); }
.weight-locked {
  flex: 1.2;
  min-width: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: var(--muted);
  padding: 0.35rem 0.7rem;
  border-radius: var(--r-sm);
  border: 1px dashed var(--line);
}"""
if old_val in s:
    s = s.replace(old_val, '')
    changed = True

if changed:
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')
else:
    skipped.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
