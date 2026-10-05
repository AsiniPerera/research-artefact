# -*- coding: utf-8 -*-
"""Swap about1 and about3 — and swap the frames with them.

    was:  about1 (portrait 0.56) hero column   |  about3 (2.7:1) mid-page band
    now:  about3 (2.7:1) full-width hero banner|  about1 (portrait) method column

Swapping only the sources would have put a 2.7:1 letterbox in a 400px column
(a 148px sliver beside a display heading) and a tall portrait in a full-width
band (cropped to a tenth of itself). The shapes have to move with them:
about3 becomes the opening banner, where a letterbox is exactly right, and
about1 goes back into a portrait column beside the method copy.

Idempotent. Re-run after a revert:   python about-swap.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'About.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ About.jsx ═══════════════════════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'about-hero--banner' in s:
    skipped.append('About.jsx')
else:
    s = s.replace("""const heroImage = byName.about1 ?? byName.skinbeauty ?? null;
const originImage = byName.about2 ?? byName.bridal ?? null;
/* A 2.7:1 letterbox — it gets a band of its own rather than a column. */
const bandImage = byName.about3 ?? null;""",
                  """/* A 2.7:1 letterbox, which is why it opens the page as a banner rather than
   standing in a column that would crop it to a sliver. */
const heroImage = byName.about3 ?? byName.about1 ?? null;
const originImage = byName.about2 ?? byName.bridal ?? null;
/* Tall portrait — it belongs beside copy, not across the page. */
const methodImage = byName.about1 ?? byName.skinbeauty ?? null;""")

    # hero: banner above the words, not a column beside them
    old_hero = """      <header className="about-hero">
        {heroImage && (
          <div className="about-hero-media" aria-hidden="true">
            <img src={heroImage} alt="" fetchPriority="high" decoding="async" />
          </div>
        )}
        <div className="about-hero-copy">
          <p className="editorial-eyebrow">About</p>
          <h1>Ranking salons on evidence, not averages</h1>
        </div>
      </header>"""
    assert s.count(old_hero) == 1, 'hero block not found'
    s = s.replace(old_hero, """      <header className="about-hero about-hero--banner">
        {heroImage && (
          <div className="about-hero-media" aria-hidden="true">
            <img src={heroImage} alt="" fetchPriority="high" decoding="async" />
          </div>
        )}
        {/* Under the banner rather than over it. At 734x272 the source has no
            height to spare for a scrim, and type on it would sit on an
            upscaled strip. */}
        <div className="about-hero-copy">
          <p className="editorial-eyebrow">About</p>
          <h1>Ranking salons on evidence, not averages</h1>
        </div>
      </header>""")

    # the mid-page band goes; the method section takes a portrait column back
    a = s.index("      {/* A full-width band.")
    b = s.index("      {/* ── How it's evaluated")
    s = s[:a] + s[b:]

    old_method = """      <section className="about-section">
        <h2>How we know it works</h2>"""
    assert s.count(old_method) == 1, 'method section not found'
    s = s.replace(old_method, """      <section className="about-split about-split--flip">
        <div className="about-split-copy">
        <h2>How we know it works</h2>""")

    # close the new wrapper and add the figure before </section>
    marker = """          little rather than rewriting the whole list.
        </p>
      </section>"""
    assert s.count(marker) == 1, 'method tail not found'
    s = s.replace(marker, """          little rather than rewriting the whole list.
        </p>
        </div>
        {methodImage && (
          <figure className="about-split-media">
            <img src={methodImage} alt="" loading="lazy" decoding="async" />
          </figure>
        )}
      </section>""")

    assert 'bandImage' not in s and 'about-band' not in s
    assert s.count('<section') == s.count('</section>')
    assert s.count('<div') == s.count('</div>')
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('About.jsx')

# ══ CSS ═════════════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.about-hero--banner' in s:
    skipped.append('index.css')
else:
    # banner hero: one column, picture then words
    anchor = """.about-hero {
  display: grid;
  grid-template-columns: 1fr minmax(0, 0.62fr);"""
    assert s.count(anchor) == 1, 'about-hero not found'
    s = s.replace(anchor, """/* Banner variant: the picture runs the full width with the words beneath.
   A 2.7:1 source has no vertical room to carry type, so the heading sits
   under it rather than on it. */
.about-hero--banner {
  display: block;
  margin-bottom: 2.5rem;
}
.about-hero--banner .about-hero-media {
  aspect-ratio: 734 / 272;
  max-height: 20rem;
  margin-bottom: 1.75rem;
}
.about-hero--banner .about-hero-media img { object-position: 50% 50%; }
.about-hero--banner .about-hero-copy h1 { max-width: 22ch; }

.about-hero {
  display: grid;
  grid-template-columns: 1fr minmax(0, 0.62fr);""")

    # the flip modifier is in use again
    s = s.replace("""/* Copy beside a picture. The image column is narrower than the text: the
   picture supports the argument, it does not make it. */""",
                  """/* Copy beside a picture. The image column is narrower than the text: the
   picture supports the argument, it does not make it. Alternating sides down
   the page keeps two picture sections from stacking into one column of
   images. */
.about-split--flip .about-split-copy { order: 2; }
.about-split--flip .about-split-media { order: 1; }""")

    s = s.replace("""  .about-split-media { aspect-ratio: 16 / 10; }""",
                  """  .about-split-media { aspect-ratio: 16 / 10; }
  /* Stacked, the flip would put a picture above the heading it belongs to. */
  .about-split--flip .about-split-copy,
  .about-split--flip .about-split-media { order: 0; }""")

    # the band rule has nothing left to style
    a = s.index("""/* Full-width band. Its ratio IS the source's""")
    b = s.index("""/* The ten categories, numbered.""")
    s = s[:a] + s[b:]

    assert '.about-band' not in s, 'band CSS survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
