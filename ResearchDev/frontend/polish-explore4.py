# -*- coding: utf-8 -*-
"""Three fixes on the Explore page:

  1. One line at the top of the rail, not two.
  2. Rank Salons visible without scrolling.
  3. Available now moves to the end of the quick-filter row, after Distance.

Idempotent. Re-run after a revert:   python polish-explore4.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
CSS = os.path.join(ROOT, 'src', 'index.css')
QF = os.path.join(ROOT, 'src', 'components', 'QuickFilters.jsx')
done, skipped = [], []

# ══ 1 + 2. CSS ══════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
MARK = '/* -- rail: one edge, and a button you can always reach -- */'
if MARK in s:
    skipped.append('index.css')
else:
    # -- one line. The panel drew THREE edges across its top: a white border,
    #    the inset white lip from --glass-lit, and a 2px gold letterhead just
    #    inside them. On a 20px curve they resolve into two visible arcs.
    gold = """.sidebar::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: linear-gradient(90deg, var(--gold) 0%, var(--gold-300) 45%, transparent 100%);
}"""
    assert s.count(gold) == 1, 'sidebar letterhead not found'
    s = s.replace(gold, MARK + """

/* The gold letterhead is gone. It sat 1px inside a white border that sits
   inside a shadow, so the panel's top edge was three lines deep and read as
   a badly registered double arc on the corner radius. The rim and its shadow
   are enough to say where the card begins; a second decorative rule on top
   of them is the one that has to go. */""")

    # -- and the panel keeps its own lit lip out of the same pile
    old_sh = """  box-shadow: var(--sh), var(--glass-lit);
  padding: 1.5rem 1.4rem;
  overflow: hidden;
}"""
    assert s.count(old_sh) == 1, 'sidebar shadow not found'
    s = s.replace(old_sh, """  box-shadow: var(--sh);
  padding: 1.5rem 1.4rem;
  overflow: hidden;
}""")

    # -- 2. the button has to be on screen at scroll zero, not after a scroll
    old_mh = """  max-height: calc(100vh - var(--nav-h) - var(--nav-gap) - 2.5rem);"""
    assert s.count(old_mh) == 1, 'sidebar max-height not found'
    s = s.replace(old_mh, """  /* Sized against where the rail actually STARTS, not against the nav.
     vh minus the nav alone assumed the card began at the top of the page; it
     begins below the masthead too, so the old cap let the card run past the
     fold and put Rank Salons off screen until you scrolled. 16rem covers the
     nav, the page padding and the masthead, so the whole card — the pinned
     button included — fits the first screen. The priorities take the crop
     and scroll inside instead.
     svh, not vh: on mobile vh is the tallest the viewport ever gets, which
     is exactly the wrong number when the browser chrome is showing. */
  max-height: calc(100svh - 16rem);""")

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

# ══ 3. Available now moves to the end ═══════════════════════════
s = io.open(QF, encoding='utf-8').read()
if s.index('qf-toggle') > s.index('Distance'):
    skipped.append('QuickFilters.jsx')
else:
    lines = s.split('\n')
    a = next(i for i, l in enumerate(lines) if 'qf-toggle' in l)
    # back up over the comment block above it
    while a > 0 and (lines[a - 1].strip().startswith(('{/*', 'only real', 'label wraps'))
                     or lines[a - 1].strip().endswith('*/}')):
        a -= 1
    b = next(i for i, l in enumerate(lines) if i > a and l.strip() == '</label>')
    block = lines[a:b + 1]
    del lines[a:b + 2]                       # plus the blank line after it

    # drop it in after the distance field, before Clear all
    c = next(i for i, l in enumerate(lines) if 'qf-clear' in l)
    while c > 0 and lines[c - 1].strip().startswith(('{/*', 'and stays', 'Sits with')):
        c -= 1
    while c > 0 and not lines[c - 1].strip():
        c -= 1
    lines[c:c] = [''] + block
    s = '\n'.join(lines)

    # the comment described a position it no longer holds
    s = s.replace(
        """/**
 * The three constraints you change most while reading results — open now,
 * who it is for, and how far — sitting directly above them rather than down
 * the rail. All three are hard filters: they decide who is eligible at all.
 */""",
        """/**
 * The three constraints you change most while reading results — who it is
 * for, how far, and open now — sitting directly above them rather than down
 * the rail. All three are hard filters: they decide who is eligible at all.
 *
 * Order runs widest to narrowest: client focus rules most salons out, the
 * radius fewer, opening hours fewest and most transiently. The toggle sits
 * last because it is the one you flick and un-flick while reading.
 */""")

    assert s.index('qf-toggle') > s.index('Distance'), 'toggle did not move'
    assert s.count('qf-toggle') == 1 and s.count('</label>') == 2
    io.open(QF, 'w', encoding='utf-8').write(s)
    done.append('QuickFilters.jsx')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
