# -*- coding: utf-8 -*-
"""Tidy the About page: one vertical rhythm, section rules, and justification
that actually reaches every paragraph.

The spacing was four different values doing the same job — 2.5rem under the
banner, 3rem under the hero, 3.5rem under the lede and the sections — which
is what makes a long page read as a pile of blocks rather than a document.
One token now sets all of them.

Idempotent. Re-run after a revert:   python about-neaten.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
MARK = '--about-gap'

s = io.open(CSS, encoding='utf-8').read()
if MARK in s:
    print('already applied')
    raise SystemExit


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, 'expected %d got %d: %r' % (cnt, n, old[:64])
    s = s.replace(old, new)


# ── One rhythm ────────────────────────────────────────────────────
sub(""".about {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 var(--gutter) 5rem;
}""",
    """.about {
  /* One gap between every block on the page. It was four separate values
     doing the same job, which is what makes a long read look assembled
     rather than composed. */
  --about-gap: clamp(2.5rem, 5vw, 3.75rem);
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 var(--gutter) 5rem;
}""")

sub(""".about-hero--banner {
  display: block;
  margin-bottom: 2.5rem;
}""",
    """.about-hero--banner {
  display: block;
  margin-bottom: var(--about-gap);
}""")

sub("""  align-items: center;
  margin: 0 0 3rem;
}
.about-hero-media {""",
    """  align-items: center;
  margin: 0 0 var(--about-gap);
}
.about-hero-media {""")

sub("""  max-width: 62ch;
  margin-bottom: 3.5rem;
}""",
    """  max-width: 62ch;
  margin-bottom: var(--about-gap);
}""")

sub(""".about-section { margin-bottom: 3.5rem; }""",
    """.about-section { margin-bottom: var(--about-gap); }""")

sub("""  align-items: center;
  margin-bottom: 3.5rem;
}""",
    """  align-items: center;
  margin-bottom: var(--about-gap);
}""")

# ── A rule above each section, so the page has joints ────────────
sub(""".about h2 {
  font-size: clamp(1.3rem, 2.2vw, 1.75rem);
  margin-bottom: 0.9rem;
}""",
    """.about h2 {
  font-size: clamp(1.3rem, 2.2vw, 1.75rem);
  margin-bottom: 0.9rem;
}
/* A hairline where each section begins. Six blocks separated only by white
   space read as one long scroll; a drawn joint tells you where you are
   without adding a heading level. The hero and the panel are exempt — one
   opens the page and the other already has a surface of its own. */
.about-section,
.about-split {
  padding-top: var(--about-gap);
  border-top: 1px solid var(--line-soft);
}
.about-limits { border-top: 0; padding-top: 0; }""")

# ── The numbered list, evened up ──────────────────────────────────
sub(""".about-cats li {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
  padding: 0.8rem 0;
  border-top: 1px solid var(--line-soft);
}""",
    """.about-cats li {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--line-soft);
}
/* The first row of EACH column, not just the first of the list. With two
   columns that is items 1 and 6; without this the second column opened with
   a rule that had nothing above it. */
.about-cats li:nth-child(5n + 1) { border-top: 0; padding-top: 0; }""")

# ── The lede, given the weight of a standfirst ───────────────────
sub(""".about-lede {
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  line-height: 1.75;""",
    """.about-lede {
  font-size: clamp(1.05rem, 1.6vw, 1.22rem);
  line-height: 1.7;
  color: var(--ink-700);""")

# ── Justification: the split copy was the only prose still ragged ─
sub(""".about-lede,
.about-split-copy p,
.about-section p,
.about-limits p,
.about-note {
  text-align: justify;""",
    """/* Every paragraph on the page, however it is wrapped. Listing the wrappers
   one by one is how .about-section p came to be missing for a while — this
   catches any <p> inside .about that is not a short caption. */
.about p,
.about-lede,
.about-note {
  text-align: justify;""")

sub(""".about-lede,
  .about-split-copy p,
  .about-section p,
  .about-limits p,
  .about-note { text-align: left; }""",
    """.about p,
  .about-lede,
  .about-note { text-align: left; }""")

# the numbered captions are not prose and must stay ragged
sub(""".about-cat-body span { font-size: 0.78rem; color: var(--muted); }""",
    """.about-cat-body span {
  font-size: 0.78rem;
  color: var(--muted);
  /* Two or three words: justifying these would only stretch the spaces. */
  text-align: left;
}""")

assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied; braces %d' % s.count('{'))
