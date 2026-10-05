# -*- coding: utf-8 -*-
"""Explore page polish, on the sidebar layout: priorities left, service tabs
and results right.

Idempotent. If the page reverts, re-run:   python polish-explore.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
MARK = '/* -- explore polish -- */'

s = io.open(CSS, encoding='utf-8').read()
if MARK in s:
    print('already applied')
    raise SystemExit


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, 'expected %d got %d: %r' % (cnt, n, old[:70])
    s = s.replace(old, new)


# ── 1. Give the rail the width ten categories need ────────────────
sub("""  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2.75rem;
  align-items: start;
}""",
    """  display: grid;
  /* 340, not 300. The rail held six categories when it was sized; it holds
     ten now, each stacking a label over a track over a four-stop scale. At
     300 the scale labels crowd the track and "Very high" sits on the edge. */
  grid-template-columns: 340px 1fr;
  gap: 2.25rem;
  align-items: start;
}""")

# ── 2. The panel head reads as a masthead, not a stray h3 ─────────
sub("""  border-radius: var(--radius-panel);
  box-shadow: var(--sh), var(--glass-lit);
  padding: 1.35rem 1.75rem 1.5rem;
  margin-bottom: 1.6rem;
}""",
    """  border-radius: var(--radius-panel);
  box-shadow: var(--sh), var(--glass-lit);
  padding: 1.35rem 1.75rem 1.5rem;
  margin-bottom: 1.6rem;
}

/* -- explore polish -- */

/* Ten rows in a rail. Each is label, tag, track and a four-stop scale, so
   the vertical rhythm has to be tight or the last category sits three
   scrolls down; every value below is a reduction, not a redesign. */
.priority-panel--rail .priority-panel-head {
  margin-bottom: 1.1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--line-soft);
}
.priority-panel--rail .priority-panel-head h3 {
  font-size: 1.02rem;
  letter-spacing: var(--track-display);
}
.priority-panel--rail .priority-panel-head p {
  font-size: 0.73rem;
  line-height: 1.45;
  margin-top: 0.25rem;
  max-width: 30ch;
}
.priority-panel--rail .weight-row { padding: 0.7rem 0; gap: 0.3rem 0; }
.priority-panel--rail .weight-head { gap: 0.1rem; }
.priority-panel--rail .weight-label { font-size: 0.81rem; line-height: 1.2; }
.priority-panel--rail .weight-tag { font-size: 0.68rem; }
.priority-panel--rail .lvl { gap: 0.25rem; margin-top: 0.15rem; }
/* Only the chosen stop is named. Four labels under a 250px track collide;
   the slider already announces its value, and the scale's job here is to
   say WHICH of four, not to letter every notch. */
.priority-panel--rail .lvl-scale i { font-size: 0.58rem; }

/* The rail scrolls, so it needs to look like it does. A hard crop at the
   panel edge reads as content that has been cut off rather than content
   that continues. */
.sidebar-scroll { scrollbar-gutter: stable; }

/* -- the results column -- */

/* The tab row sat on a hairline with nothing above it, floating clear of
   the column it filters. Given the column's own top edge it reads as the
   heading of what follows. */
.results-col .svcbar,
.discover .svcbar { margin-bottom: 1.5rem; }

/* A resting state, not a gap: it fills the column it is standing in for,
   so the page does not look like it failed to load something. */
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 20rem;
}
.empty-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: var(--track-display);
  color: var(--ink);
  margin-bottom: 0.4rem;
}

@media (max-width: 1100px) {
  /* Below this the rail and the results cannot both have room, and a 340px
     column beside a squeezed grid serves neither. */
  .discover { grid-template-columns: 1fr; gap: 1.75rem; }
  .sidebar { position: static; max-height: none; }
}""")

assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied; braces %d' % s.count('{'))
