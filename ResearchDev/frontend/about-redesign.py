# -*- coding: utf-8 -*-
"""About page: drop the limits panel, fix the hero, rebuild the method section.

1. "Honest limits" goes. It was also the one block on the page with padding of
   its own, so its text started ~36px further in than every other block — the
   margin mismatch that was visible in the screenshot.

2. The hero was rendering as a two-column grid instead of a banner. Cause:
   .about-hero--banner was declared ABOVE .about-hero. Both are single-class
   selectors, so specificity ties and source order decides — display:grid won.
   Moved below, and the copy underneath becomes a masthead: headline left,
   standfirst right, sharing a baseline, so the banner no longer opens onto
   two thirds of a page of nothing.

3. "How we know it works" was three dense paragraphs of method. Same content,
   re-cut as four named checks in the same numbered-list language the ten
   categories already use, so the page has one visual grammar instead of two.

Idempotent. Re-run after a revert:   python about-redesign.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'About.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ About.jsx ══════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'about-checks' in s:
    skipped.append('About.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── 1. the hero takes the lede in, as a masthead ────────────
    sub("""        {/* Under the banner rather than over it. At 734x272 the source has no
            height to spare for a scrim, and type on it would sit on an
            upscaled strip. */}
        <div className="about-hero-copy">
          <p className="editorial-eyebrow">About</p>
          <h1>Helping you find a salon you&apos;ll love</h1>
        </div>
      </header>

      <p className="about-lede">
        Amore Beauty ranks salons on what their clients actually wrote, not on a single
        star average. You decide which things matter to you, and the ranking rearranges
        itself around that — because the salon that suits a bride the week before her
        wedding is rarely the one that suits a Tuesday afternoon haircut.
      </p>
""",
        """        {/* Under the banner rather than over it. At 734x272 the source has no
            height to spare for a scrim, and type on it would sit on an
            upscaled strip.

            The standfirst lives in here rather than below it, so it can take
            the empty half of the masthead beside a headline that is only
            three words wide. */}
        <div className="about-hero-copy">
          <p className="editorial-eyebrow">About</p>
          <h1>Helping you find a salon you&apos;ll love</h1>
          <p className="about-lede">
            Amore Beauty ranks salons on what their clients actually wrote, not on a
            single star average. You decide which things matter to you, and the ranking
            rearranges itself around that — because the salon that suits a bride the
            week before her wedding is rarely the one that suits a Tuesday afternoon
            haircut.
          </p>
        </div>
      </header>
""")

    # ── 2. the method section, re-cut as named checks ───────────
    a = s.index("      {/* ── How it's evaluated")
    b = s.index('      </section>', s.index('{methodImage &&')) + len('      </section>')
    sub(s[a:b], """      {/* ── How it's evaluated ────────────────────────── */}
      {/* Four checks rather than three paragraphs. Same content, but a method
          is a list of things that had to pass — written as prose it reads as
          reassurance and nobody finishes it. Numbered in the same language as
          the ten categories above, so the page has one grammar. */}
      <section className="about-split about-split--flip">
        <div className="about-split-copy">
          <h2>How we know it works</h2>
          <p className="about-note">
            A ranking is only worth as much as the checks behind it. Every part of the
            method has to pass all four of these before it reaches a result you see.
          </p>
          <ol className="about-checks">
            <li>
              <span className="about-check-no">01</span>
              <span className="about-check-body">
                <strong>It agrees with people</strong>
                <p>
                  The reading is checked against the same reviews read by hand. Where
                  the two disagree too often, that part of the method does not ship.
                </p>
              </span>
            </li>
            <li>
              <span className="about-check-no">02</span>
              <span className="about-check-body">
                <strong>It beats the simple version</strong>
                <p>
                  Every step is raced against simply counting positive and negative
                  words. If the plain count does the job as well, the extra complexity
                  is not worth what it costs you in accuracy you cannot check.
                </p>
              </span>
            </li>
            <li>
              <span className="about-check-no">03</span>
              <span className="about-check-body">
                <strong>Nothing stays unless it earns it</strong>
                <p>
                  The confidence weighting is tested by taking it out. If removing it
                  does not make the ranking measurably worse, it was never doing
                  anything, and it goes.
                </p>
              </span>
            </li>
            <li>
              <span className="about-check-no">04</span>
              <span className="about-check-body">
                <strong>Your sliders behave</strong>
                <p>
                  Priorities are tested for stability, so nudging one slider shifts the
                  order a little rather than rewriting the whole list under you.
                </p>
              </span>
            </li>
          </ol>
        </div>
        {methodImage && (
          <figure className="about-split-media">
            <img src={methodImage} alt="" loading="lazy" decoding="async" />
          </figure>
        )}
      </section>""")

    # ── 3. the limits panel goes ────────────────────────────────
    a = s.index('      {/* ── Limits ')
    b = s.index('      </section>', a) + len('      </section>\n')
    s = s[:a] + s[b:]
    s = s.replace('\n\n    </article>', '\n    </article>')

    assert 'about-limits' not in s, 'limits survived in JSX'
    assert s.count('<section') == s.count('</section>'), 'section mismatch'
    assert s.count('<div') == s.count('</div>'), 'div mismatch'
    assert s.count('<span') == s.count('</span>'), 'span mismatch'
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('About.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.about-checks' in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── 1. lift the banner rules out of their losing position ───
    csub("""/* Opening frame. The scrim is directional rather than flat — heaviest under
   the type, releasing across the picture — so the photograph is darkened
   only where it has to carry words. */
/* Copy beside the picture, in two columns, because every picture in this
   project is a ~736px portrait. Stretched across a full-width band it would
   be upscaled past 1000px and cropped to a strip at the same time; in a
   portrait frame it sits at close to native size and keeps its subject. */
/* Banner variant: the picture runs the full width with the words beneath.
   A 2.7:1 source has no vertical room to carry type, so the heading sits
   under it rather than on it. */
.about-hero--banner {
  display: block;
  margin-bottom: var(--about-gap);
}
.about-hero--banner .about-hero-media {
  aspect-ratio: 734 / 272;
  max-height: 20rem;
  margin-bottom: 1.75rem;
}
.about-hero--banner .about-hero-media img { object-position: 50% 50%; }
.about-hero--banner .about-hero-copy h1 { max-width: 22ch; }

.about-hero {""",
         """/* The base hero is two columns: a picture beside the copy, because most
   pictures in this project are ~736px portraits and a portrait frame keeps
   them near native size. The banner modifier further down overrides it. */
.about-hero {""")

    # ── 2. put them back AFTER the base rule ────────────────────
    csub("""/* Ink on paper now: with the picture beside the copy rather than under it,
   there is no photograph to darken and no reason for white type. */
.about-hero-copy h1 {
  font-size: clamp(1.9rem, 4vw, 3rem);
  max-width: 16ch;
}""",
         """/* Ink on paper now: with the picture beside the copy rather than under it,
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
}""")

    # ── 3. one colour, not two ──────────────────────────────────
    csub("""  line-height: 1.7;
  color: var(--ink-700);
  color: var(--body);
  max-width: 62ch;""",
         """  line-height: 1.7;
  color: var(--body);
  max-width: 62ch;""")

    # ── 4. the four checks, in the categories' visual language ──
    csub("""/* The limits sit on a tinted panel. They are the part most likely to be
   skipped and the part most worth reading, so they get a surface of their
   own rather than being the last paragraph on white. */
.about-limits {
  background: var(--surface);
  border-radius: var(--radius-panel);
  padding: clamp(1.5rem, 3vw, 2.25rem);
  margin-bottom: 0;
}
.about-limits h2 { margin-bottom: 0.6rem; }""",
         """/* The four method checks. Same construction as .about-cats — gold number,
   bold label, hairline between — because they are the same kind of thing: a
   fixed, ordered list you are meant to be able to scan and count. */
.about-checks {
  list-style: none;
  margin: 0;
  padding: 0;
}
.about-checks li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  padding: 0.95rem 0;
  border-top: 1px solid var(--line-soft);
}
/* The first item opens straight under the standfirst, so a rule there would
   have nothing above it to divide. */
.about-checks li:first-child { border-top: 0; padding-top: 0; }
.about-check-no {
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  line-height: 1.9;
}
.about-check-body { display: block; min-width: 0; }
.about-check-body strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 0.25rem;
}
/* Overrides the 68ch measure from .about p — inside a half-width column that
   cap never bites, and the smaller size is what separates the note from the
   label above it. Justification is inherited, as the page requires. */
.about-checks p {
  font-size: 0.875rem;
  line-height: 1.65;
  max-width: none;
  margin: 0;
}""")

    # ── 5. the limits exemption has nothing left to exempt ──────
    csub("""/* A hairline where each section begins. Six blocks separated only by white
   space read as one long scroll; a drawn joint tells you where you are
   without adding a heading level. The hero and the panel are exempt — one
   opens the page and the other already has a surface of its own. */
.about-section,
.about-split {
  padding-top: var(--about-gap);
  border-top: 1px solid var(--line-soft);
}
.about-limits { border-top: 0; padding-top: 0; }""",
         """/* A hairline where each section begins, with the same gap above it and below
   it, so every joint down the page measures the same. Blocks separated only
   by white space read as one long scroll; a drawn joint says where you are
   without adding a heading level. The hero is exempt: it opens the page. */
.about-section,
.about-split {
  padding-top: var(--about-gap);
  border-top: 1px solid var(--line-soft);
}""")

    # ── 6. stacked masthead on narrow screens ───────────────────
    csub("""  .about-hero { grid-template-columns: 1fr; gap: 1.25rem; }
  .about-hero-media { aspect-ratio: 16 / 10; }""",
         """  .about-hero { grid-template-columns: 1fr; gap: 1.25rem; }
  .about-hero-media { aspect-ratio: 16 / 10; }
  /* The masthead's two columns become two rows. The letterbox keeps its own
     ratio: the rule above is less specific than the banner's. */
  .about-hero--banner .about-hero-copy { grid-template-columns: 1fr; gap: 1rem; }
  .about-hero--banner .about-hero-copy .about-lede {
    grid-column: 1;
    grid-row: auto;
  }""")

    assert '.about-limits' not in s, 'limits CSS survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
