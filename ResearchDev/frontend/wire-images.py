# -*- coding: utf-8 -*-
"""Point Contact and About at contact1 / about1 / about2, and re-shape the
frames to suit them.

All three are portraits about 736px wide. The About hero was a full-width
landscape band, which would have upscaled a 736px source past 1000px AND
cropped it to a strip; it becomes a two-column hero instead, showing the
picture near its native size. Several images the pages previously named
(modernsalon, heroroom, reviewssection, hero.png) no longer exist, so the
fallback chains are re-pointed at files that do.

Idempotent. Re-run after a revert:   python wire-images.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
done, skipped = [], []

# ══ Contact ═════════════════════════════════════════════════════
p = os.path.join(SRC, 'screens', 'Contact.jsx')
s = io.open(p, encoding='utf-8').read()
if 'byName.contact1' in s:
    skipped.append('Contact.jsx')
else:
    old = """const heroImage = byName.modernsalon ?? byName.heroroom ?? null;
const asideImage = byName.skinbeauty ?? byName.bridal ?? null;"""
    assert s.count(old) == 1, 'contact image picks not found'
    s = s.replace(old, """const heroImage = byName.contact1 ?? byName.herogirl ?? null;
const asideImage = byName.skinbeauty ?? byName.bridal ?? null;""")
    io.open(p, 'w', encoding='utf-8').write(s)
    done.append('Contact.jsx')

# ══ About ═══════════════════════════════════════════════════════
p = os.path.join(SRC, 'screens', 'About.jsx')
s = io.open(p, encoding='utf-8').read()
if 'byName.about1' in s:
    skipped.append('About.jsx')
else:
    old = """const heroImage = byName.heroroom ?? byName.modernsalon ?? null;
const methodImage = byName.reviewssection ?? byName.herogirl ?? null;
const originImage = byName.modernsalon ?? byName.skinbeauty ?? null;"""
    assert s.count(old) == 1, 'about image picks not found'
    s = s.replace(old, """const heroImage = byName.about1 ?? byName.skinbeauty ?? null;
const originImage = byName.about2 ?? byName.bridal ?? null;
const methodImage = byName.auth ?? byName.grooming ?? null;""")
    io.open(p, 'w', encoding='utf-8').write(s)
    done.append('About.jsx')

# ══ Landing: its picks were deleted too ═════════════════════════
p = os.path.join(SRC, 'screens', 'Landing.jsx')
s = io.open(p, encoding='utf-8').read()
if 'byName.modernsalon' in s:
    s = s.replace(
        "const heroBackdrop = byName.modernsalon ?? byName.heroroom ?? byName.herogirl ?? null;",
        "const heroBackdrop = byName.herogirl ?? byName.about1 ?? byName.contact1 ?? null;")
    s = s.replace(
        "  byName.reviewssection ?? byName.skinbeauty ?? byName.bridal ?? null;",
        "  byName.skinbeauty ?? byName.bridal ?? byName.about2 ?? null;")
    io.open(p, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')
else:
    skipped.append('Landing.jsx')

# ══ CSS: frames that suit a portrait source ═════════════════════
p = os.path.join(SRC, 'index.css')
s = io.open(p, encoding='utf-8').read()
MARK = 'two columns, because every picture'
if MARK in s:
    skipped.append('index.css')
else:
    old_hero = """.about-hero {
  position: relative;
  margin: 0 0 2.5rem;
  border-radius: var(--radius-panel);
  overflow: hidden;
  min-height: clamp(15rem, 34vw, 22rem);
  display: flex;
  align-items: flex-end;
  background: var(--ink);
}
.about-hero-media { position: absolute; inset: 0; }
.about-hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 45%;
  display: block;
}
.about-hero-media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(15deg,
    rgba(22, 21, 15, 0.86) 0%,
    rgba(22, 21, 15, 0.55) 42%,
    rgba(22, 21, 15, 0.18) 78%);
}
.about-hero-copy {
  position: relative;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  color: #fff;
}
.about-hero-copy h1 {
  color: #fff;
  font-size: clamp(1.9rem, 4vw, 3rem);
  max-width: 18ch;
}
.about-hero-copy .editorial-eyebrow { color: var(--gold-300); }"""
    assert s.count(old_hero) == 1, 'about hero rule not found'
    s = s.replace(old_hero, """/* Copy beside the picture, in two columns, because every picture in this
   project is a ~736px portrait. Stretched across a full-width band it would
   be upscaled past 1000px and cropped to a strip at the same time; in a
   portrait frame it sits at close to native size and keeps its subject. */
.about-hero {
  display: grid;
  grid-template-columns: 1fr minmax(0, 0.62fr);
  gap: clamp(1.5rem, 4vw, 3.5rem);
  align-items: center;
  margin: 0 0 3rem;
}
.about-hero-media {
  border-radius: var(--radius-panel);
  overflow: hidden;
  aspect-ratio: 3 / 4;
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
}""")

    # Contact hero: portrait source in what was a 16:11 landscape frame.
    old_cm = """.cp-hero-media {
  position: relative;
  margin: 0 0 0 auto;
  width: 72%;
  aspect-ratio: 16 / 11;"""
    assert s.count(old_cm) == 1, 'contact hero media not found'
    s = s.replace(old_cm, """.cp-hero-media {
  position: relative;
  margin: 0 0 0 auto;
  /* Narrower and taller than the reference's frame: the source is a
     portrait, and a 16:11 crop of one is a horizontal slice through the
     middle of whatever it was a picture of. */
  width: 58%;
  aspect-ratio: 4 / 5;""")
    s = s.replace(""".cp-hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; }""",
                  """.cp-hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
  display: block;
}""")
    # the plate has to grow to still meet the narrower photo
    s = s.replace("""  width: 46%;
  height: 62%;""", """  width: 52%;
  height: 58%;""")

    # About hero stacks below the same breakpoint the splits use
    s = s.replace("""  .about-split-media { aspect-ratio: 16 / 10; }""",
                  """  .about-split-media { aspect-ratio: 16 / 10; }
  .about-hero { grid-template-columns: 1fr; gap: 1.25rem; }
  .about-hero-media { aspect-ratio: 16 / 10; }""")

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(p, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
