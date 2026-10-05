# -*- coding: utf-8 -*-
"""Two fixes on the About page.

1. The opening picture goes. The page now starts on type.
   With it, the whole banner/hero split goes too: .about-hero--banner existed
   only to override the base hero's two-column grid, and with no picture there
   are no two columns to override. Collapsed into one .about-hero, which also
   permanently removes the source-order hazard between them.

2. "How we know it works" had ~300px of dead space between picture and copy
   that "Why it exists" did not.

   Cause: .about-split--flip reorders the ITEMS but the tracks stay
   1.15fr .85fr. Unflipped, copy takes the 1.15fr track and the picture takes
   .85fr — which it fills. Flipped, the picture lands in the 1.15fr track and
   cannot fill it (its height is capped at 26rem against a 2:3 ratio, so it
   tops out around 277px wide), leaving the rest of the track empty before the
   text starts. Swapping the TRACKS as well as the items keeps the picture in
   a .85fr column both times, so the two sections now measure the same.

Idempotent. Re-run after a revert:   python about-gaps.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'About.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ About.jsx ══════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'heroImage' not in s:
    skipped.append('About.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    sub("""/* A 2.7:1 letterbox, which is why it opens the page as a banner rather than
   standing in a column that would crop it to a sliver. */
const heroImage = byName.about3 ?? byName.about1 ?? null;
const originImage""",
        """const originImage""")

    sub("""      {/* The opening banner. The picture carries no information, so it is
          aria-hidden and the heading beneath it does the announcing. */}
      <header className="about-hero about-hero--banner">
        {heroImage && (
          <div className="about-hero-media" aria-hidden="true">
            <img src={heroImage} alt="" fetchPriority="high" decoding="async" />
          </div>
        )}
        {/* Under the banner rather than over it. At 734x272 the source has no
            height to spare for a scrim, and type on it would sit on an
            upscaled strip.

            The standfirst lives in here rather than below it, so it can take
            the empty half of the masthead beside a headline that is only
            three words wide. */}
        <div className="about-hero-copy">""",
        """      {/* The page opens on type. The standfirst sits in the masthead rather
          than below it, so it takes the half of the line that a three-word
          headline leaves empty. */}
      <header className="about-hero">
        <div className="about-hero-copy">""")

    assert 'heroImage' not in s, 'heroImage still referenced'
    assert 'about-hero--banner' not in s, 'banner modifier survived'
    assert 'about-hero-media' not in s, 'hero media survived'
    assert s.count('<div') == s.count('</div>'), 'div mismatch'
    assert s.count('<section') == s.count('</section>'), 'section mismatch'
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('About.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.about-hero-media' not in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── 1. one hero, no picture, no modifier ────────────────────
    csub("""/* The base hero is two columns: a picture beside the copy, because most
   pictures in this project are ~736px portraits and a portrait frame keeps
   them near native size. The banner modifier further down overrides it. */
.about-hero {
  display: grid;
  grid-template-columns: 1fr minmax(0, 0.62fr);
  gap: clamp(1.5rem, 4vw, 3.5rem);
  align-items: center;
  margin: 0 0 var(--about-gap);
}
.about-hero-media {
  border-radius: var(--radius-panel);
  overflow: hidden;
  /* about1 is 0.56 — nearly 9:16. Held at 3/4 and capped, so it keeps a
     portrait shape without becoming a column of photograph beside a
     two-paragraph heading. */
  aspect-ratio: 3 / 4;
  max-height: 24rem;
  background: var(--surface);
}
.about-hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 35%;
  display: block;
}
/* Ink on paper now: with the picture beside the copy rather than under it,
   there is no photograph to darken and no reason for white type. */
.about-hero-copy h1 {
  font-size: clamp(1.9rem, 4vw, 3rem);
  max-width: 16ch;
}

/* ── Banner masthead ───────────────────────────────────────────────
   These rules sit AFTER .about-hero on purpose. Both are single-class
   selectors, so specificity ties and source order is the only tiebreak —
   declared above the base rule, `display: block` lost to `display: grid`
   and the banner rendered as a two-column hero with the headline squeezed
   into a third of the width. Moving the block IS the fix; do not put these
   back on top. */
.about-hero--banner {
  display: block;
  margin-bottom: var(--about-gap);
}
.about-hero--banner .about-hero-media {
  /* The source's own ratio, so the letterbox is never cropped. */
  aspect-ratio: 734 / 272;
  max-height: 21rem;
  margin-bottom: clamp(1.5rem, 3vw, 2.25rem);
}
.about-hero--banner .about-hero-media img { object-position: 50% 45%; }

/* Headline left, standfirst right, on a shared baseline. The banner runs the
   full measure and the heading is three words: alone under it the opening was
   two thirds empty, which reads as unfinished rather than spare. */
.about-hero--banner .about-hero-copy {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: clamp(1.5rem, 4vw, 3.25rem);
  align-items: end;
}
.about-hero--banner .about-hero-copy .editorial-eyebrow { grid-column: 1; }
.about-hero--banner .about-hero-copy h1 {
  grid-column: 1;
  max-width: 20ch;
  margin: 0;
}
/* Spans both rows of the left column so its last line lands with the foot of
   the headline instead of floating at the top of a taller cell. */
.about-hero--banner .about-hero-copy .about-lede {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: end;
  margin: 0;
}""",
         """/* The page opens on type. There is no picture here any more, so there is no
   picture column either — one block, and the masthead inside it does the
   only dividing. */
.about-hero { margin: 0 0 var(--about-gap); }

/* Headline left, standfirst right, on a shared baseline. The headline is
   three words: on its own across the full measure it left two thirds of the
   line empty, which reads as unfinished rather than spare. */
.about-hero-copy {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: clamp(1.5rem, 4vw, 3.25rem);
  align-items: end;
}
.about-hero-copy .editorial-eyebrow { grid-column: 1; }
.about-hero-copy h1 {
  grid-column: 1;
  font-size: clamp(1.9rem, 4vw, 3rem);
  max-width: 20ch;
  margin: 0;
}
/* Spans both rows of the left column so its last line lands with the foot of
   the headline instead of floating at the top of a taller cell. */
.about-hero-copy .about-lede {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: end;
  margin: 0;
}""")

    # ── 2. the flip swaps tracks, not just items ────────────────
    csub("""  align-items: center;
  margin-bottom: var(--about-gap);
}
.about-split-media {""",
         """  align-items: center;
  margin-bottom: var(--about-gap);
}
/* The flip has to move the TRACKS too, not only the items. Reordering alone
   left the picture in the 1.15fr track, and it cannot fill one: its height is
   capped at 26rem against a 2:3 ratio, so it tops out near 277px wide and the
   rest of the track stayed empty — that was the ~300px of dead air between
   picture and copy in "How we know it works" that "Why it exists" did not
   have. With the tracks swapped the picture sits in a .85fr column in both,
   so the two sections measure identically.

   Declared after .about-split deliberately: equal specificity, source order
   decides. */
.about-split--flip { grid-template-columns: 0.85fr 1.15fr; }

.about-split-media {""")

    # ── 3. stacked masthead keeps working without the modifier ──
    csub("""  .about-hero { grid-template-columns: 1fr; gap: 1.25rem; }
  .about-hero-media { aspect-ratio: 16 / 10; }
  /* The masthead's two columns become two rows. The letterbox keeps its own
     ratio: the rule above is less specific than the banner's. */
  .about-hero--banner .about-hero-copy { grid-template-columns: 1fr; gap: 1rem; }
  .about-hero--banner .about-hero-copy .about-lede {
    grid-column: 1;
    grid-row: auto;
  }""",
         """  /* The masthead's two columns become two rows. */
  .about-hero-copy { grid-template-columns: 1fr; gap: 1rem; }
  .about-hero-copy .about-lede { grid-column: 1; grid-row: auto; }""")

    assert '.about-hero-media' not in s, 'hero media CSS survived'
    assert '--banner' not in s, 'banner modifier CSS survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
