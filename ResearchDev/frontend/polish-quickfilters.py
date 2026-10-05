# -*- coding: utf-8 -*-
"""Quick-filter row: real glass pills, one shell each.

Idempotent. Re-run after a revert:   python polish-quickfilters.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
MARK = '/* -- quick filters, glassed -- */'

s = io.open(CSS, encoding='utf-8').read()

# A previous run inserted this block BEFORE the original .qf-field rule, which
# then overrode it. Strip that block if present, then rebuild properly.
if MARK in s:
    a = s.index(MARK)
    b = s.index('.qf-field {', a)
    s = s[:a] + s[b:]

OLD = """.qf-field {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  height: 2.4rem;
  padding: 0 0.8rem 0 1rem;
  border: 1px solid rgba(140, 125, 110, 0.20);
  border-radius: var(--pill);
  background:
    linear-gradient(100deg,
      rgba(255, 255, 255, 0.75) 0%,
      rgba(255, 255, 255, 0.15) 20%,
      transparent 45%),
    rgba(255, 255, 255, 0.90);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: 0 1px 2px rgba(26, 24, 21, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.90);
  cursor: pointer;
  transition: border-color 0.15s var(--ease), background 0.15s var(--ease);
}"""
assert s.count(OLD) == 1, 'original .qf-field rule not found (%d)' % s.count(OLD)

NEW = MARK + """

/* Real glass, not a near-opaque chip. The fill was 0.90 white under a raking
   gradient, which is a painted highlight on something solid — at 0.55 the
   pill actually sits ON the page rather than over it.

   TWO rims, the same pair the nav carries: a bright inner one that draws the
   pill against anything dark, and a faint ink hairline outside it that draws
   it against paper. Whichever ground it is on, one is working and the other
   is invisible. Together they replace the warm brown border, which read as a
   drawn outline rather than the edge of a piece of glass. */
.qf-field {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  height: 2.5rem;
  padding: 0 0.85rem 0 1rem;
  border: 0;
  border-radius: var(--pill);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.7),
    0 0 0 1px rgba(22, 21, 15, 0.055),
    0 2px 6px -3px rgba(22, 21, 15, 0.16);
  cursor: pointer;
  transition: background 0.16s var(--ease), box-shadow 0.16s var(--ease);
}
.qf-field:hover {
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.85),
    0 0 0 1px rgba(22, 21, 15, 0.08),
    0 3px 8px -3px rgba(22, 21, 15, 0.2);
}
.qf-field:focus-within {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.85),
    0 0 0 1px var(--slate),
    0 3px 8px -3px rgba(22, 21, 15, 0.2);
}
/* The old checked state shifted a brown border that no longer exists. */
.qf-toggle:has(input:checked) { border-color: transparent; }

/* The segmented control carried its OWN border, fill and shadow — a 12px
   panel sitting inside a pill, so two shells disagreed about the same shape.
   In here it is only the buttons; the pill around it is the shell. */
.qf-field--seg { padding: 0 0.3rem 0 1rem; gap: 0.5rem; }
.qf-field--seg .segmented,
.segmented--sm {
  display: flex;
  gap: 0.1rem;
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
  border-radius: 0;
}
.qf-field--seg .segmented button,
.segmented--sm button {
  border-radius: var(--pill);
  padding: 0.42rem 0.8rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ink-600);
  transition: background 0.16s var(--ease), color 0.16s var(--ease),
              box-shadow 0.16s var(--ease);
}
.qf-field--seg .segmented button:hover,
.segmented--sm button:hover {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
}
/* Chosen is a solid white puck riding in the glass, not a beige fill. On a
   translucent pill the one opaque shape is unmistakably the selection, and
   needs no colour of its own to say so. */
.qf-field--seg .segmented button[aria-pressed="true"],
.segmented--sm button[aria-pressed="true"] {
  background: #fff;
  color: var(--ink);
  box-shadow:
    0 1px 2px rgba(22, 21, 15, 0.16),
    0 0 0 1px rgba(22, 21, 15, 0.05);
}

/* Slate, not bronze. The toggle is the only saturated thing in the row and
   was the one warm note left in an otherwise cool set of controls. */
.qf-toggle .toggle input:checked + .toggle-track { background: var(--slate); }
.qf-toggle:has(input:checked) .filter-toggle-icon { color: var(--slate); }

/* Set apart from the pills it clears, rather than reading as a fourth one. */
.qf-clear { margin-left: 0.25rem; align-self: center; flex-shrink: 0; }"""

s = s.replace(OLD, NEW)
assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied in place; braces %d' % s.count('{'))
