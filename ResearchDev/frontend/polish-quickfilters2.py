# -*- coding: utf-8 -*-
"""Quick filters: plain solid controls, no glass.

Idempotent. Re-run after a revert:   python polish-quickfilters2.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
MARK = '/* -- quick filters, plain -- */'

s = io.open(CSS, encoding='utf-8').read()
if MARK in s:
    print('already applied')
    raise SystemExit


def sub(old, new):
    global s
    assert s.count(old) == 1, 'expected 1 got %d: %r' % (s.count(old), old[:64])
    s = s.replace(old, new)


# ── The pill ──────────────────────────────────────────────────────
sub("""/* Real glass, not a near-opaque chip. The fill was 0.90 white under a raking
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
}""",
    MARK + """

/* A plain control: one solid fill, one drawn border, no blur and no second
   rim. The glass version needed two rims because a translucent pill has no
   edge of its own on either a pale or a dark ground; an opaque one does, so
   a single hairline says everything the pair was there to say. */
.qf-field {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  height: 2.5rem;
  padding: 0 0.85rem 0 1rem;
  border: 1px solid var(--line);
  border-radius: var(--pill);
  background: var(--card);
  cursor: pointer;
  transition: border-color 0.16s var(--ease), box-shadow 0.16s var(--ease);
}
.qf-field:hover { border-color: var(--muted); }
/* The ring goes OUTSIDE the border rather than replacing it, so the control
   does not change size or lose its edge at the moment it gains focus. */
.qf-field:focus-within {
  border-color: var(--slate);
  box-shadow: 0 0 0 3px rgba(91, 107, 138, 0.16);
}""")

# ── The menu ──────────────────────────────────────────────────────
sub("""/* The panel a native select could never give us: the same glass as the pill
   it drops from, with a rim that works on either ground. */
.qf-menu {""",
    """/* Solid, like the pill it drops from. A menu is read, not looked through:
   whatever shows past a translucent one is noise behind the only thing on
   screen that matters at that moment. */
.qf-menu {""")

sub("""  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.7),
    0 0 0 1px rgba(22, 21, 15, 0.06),
    0 14px 32px -12px rgba(22, 21, 15, 0.28);
  animation: qfMenuIn 0.14s var(--ease) both;""",
    """  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 12px 28px -12px rgba(22, 21, 15, 0.24);
  animation: qfMenuIn 0.14s var(--ease) both;""")

# ── The segmented control's hover, which leaned on the glass ─────
sub("""  background: rgba(255, 255, 255, 0.5);
}""",
    """  background: var(--surface);
}""")

assert 'backdrop-filter' not in s.split(MARK)[1].split('/* --')[0], 'blur left in the filters'
assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied; braces %d' % s.count('{'))
