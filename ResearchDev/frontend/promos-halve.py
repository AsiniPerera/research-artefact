# -*- coding: utf-8 -*-
"""Halve the promotion cards.

They were that size because the section claimed a whole screen and the rack
was `flex: 1` inside it — on any normal monitor it hit its 34rem cap and the
panels ran about 550px tall. The section is the only one on the landing page
that claimed a screen, so dropping that brings it into line with the rest
rather than breaking a rhythm.

The open panel has to be relaid out to survive the cut. At ~17rem the copy
does not fit stacked: tag, title, a 54px numeral, two lines of note and the
code row come to roughly 240px inside 188px of usable height. The panel is
short and wide now, so the discount moves into a column of its own beside the
copy and uses the width the shape actually has.

Idempotent. Re-run after a revert:   python promos-halve.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
s = io.open(CSS, encoding='utf-8').read()
if '--rack-h' in s:
    print('already applied')
    raise SystemExit


def csub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, 'expected %d got %d: %r' % (cnt, n, old[:70])
    s = s.replace(old, new)


# ── 1. the section stops claiming a screen ─────────────────────
csub(""".promos-section {
  --nav-clear: calc(var(--nav-h) + var(--nav-gap) + 0.6rem);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100vh - var(--nav-clear));
  min-height: calc(100svh - var(--nav-clear));
  scroll-margin-top: var(--nav-clear);
  padding: clamp(1rem, 2.5vh, 2.25rem) var(--gutter);
}""",
     """.promos-section {
  --nav-clear: calc(var(--nav-h) + var(--nav-gap) + 0.6rem);
  /* Half height, set here so the rack and its breakpoints read from one
     number instead of three that have to be kept in step. */
  --rack-h: clamp(12.5rem, 22vw, 17rem);
  display: flex;
  flex-direction: column;
  /* No 100vh claim any more. The rack was `flex: 1` inside a full screen, so
     it hit its 34rem cap on any normal monitor and the panels ran ~550px
     tall — that is why the cards were twice the size they needed to be. This
     was also the only section on the page claiming a screen, so the section
     is now sized by its content like all the others. */
  scroll-margin-top: var(--nav-clear);
  padding: clamp(2.5rem, 5vh, 4rem) var(--gutter) clamp(1.25rem, 2.5vh, 2rem);
}""")

# ── 2. the rack takes a height of its own ──────────────────────
csub("""  width: 100%;
  flex: 1;
  min-height: 0;
  max-height: 34rem;
}""",
     """  width: 100%;
  height: var(--rack-h);
}""")

# ── 3. the open panel, relaid for a short wide shape ───────────
csub(""".offer-full {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  height: 100%;
  padding: clamp(1.5rem, 3vw, 2.75rem);""",
     """/* The discount takes a column of its own beside the copy. Stacked above it,
   the five pieces came to ~240px against 188px of usable height once the
   panel was halved; side by side the tallest column is the copy at about
   170px. .promo-foot is a sibling here, not nested, so it can be placed into
   the second column directly. */
.offer-full {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: clamp(1.1rem, 2.6vw, 2rem);
  align-content: end;
  justify-items: start;
  height: 100%;
  padding: clamp(1.1rem, 2.4vw, 2rem);""")

csub(""".offer-amount {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0.5rem 0 0.45rem;
  color: #fff;
}""",
     """/* Spans every row of the copy column so it centres against the block as a
   whole rather than sitting on one line of it. */
.offer-amount {
  grid-column: 1;
  grid-row: 1 / span 4;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0;
  color: #fff;
}
.offer-full .promo-tag,
.offer-full .promo-title,
.offer-full .promo-note,
.offer-full .promo-foot { grid-column: 2; }""")

# the numerals lose their side-by-side baseline now they are stacked
csub(""".offer-amount .promo-pct {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-300);
}""",
     """.offer-amount .promo-pct {
  margin-top: 0.15rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-300);
}""")

# ── 4. tighter foot, so the copy column clears the new height ──
csub(""".promo-foot {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  margin-top: 1.3rem;
  padding-top: 1rem;""",
     """.promo-foot {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  margin-top: 0.85rem;
  padding-top: 0.7rem;""")

# ── 5. the breakpoint override now conflicts with the base ─────
csub("""  /* Three rows in one screen would leave each card ~195px — under what the
     title, note and code row need. Below this width the section stops
     claiming a single screen and simply flows. */
  .promos-section {
    min-height: 0;
    display: block;
    padding: 3rem var(--gutter) 1rem;
  }
  /* The section stops claiming a screen, so the rack stops stretching to
     fill one and takes a height of its own. */
  .offers-rack { flex: none; height: 27rem; max-height: none; }""",
     """  .promos-section {
    display: block;
    padding: 3rem var(--gutter) 1rem;
  }
  /* No height override here any more. The base is a clamp on vw, so it comes
     down on its own at this width — a second fixed value was one more number
     to keep in step with the first. */""")

assert 'max-height: 34rem' not in s
assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied')
