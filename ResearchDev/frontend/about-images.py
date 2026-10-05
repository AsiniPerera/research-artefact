# -*- coding: utf-8 -*-
"""Use all three about/ images, each in a frame that suits its shape.

    about1.webp  736x1314  portrait 0.56 -> hero, beside the copy
    about2.jpg   736x1104  portrait 0.67 -> the Why it exists column
    about3.jpg   734x 272  BANNER   2.70 -> a full-width band of its own

about3 is the reason this is not just three picks: at 2.7:1 it is a letterbox,
and the portrait frame that "How we know it works" used would have cropped it
to a sliver. It gets a band across the page instead, and that section becomes
plain full-width copy.

Every frame is capped by max-height as well as aspect-ratio. A 2:3 frame in a
430px column computes to 645px tall — taller than the paragraph beside it and
most of the viewport — so the ratio holds the shape on narrow screens and the
cap takes over on wide ones.

Idempotent. Re-run after a revert:   python about-images.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'About.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ About.jsx ═══════════════════════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'bandImage' in s:
    skipped.append('About.jsx')
else:
    old = """const heroImage = byName.about1 ?? byName.skinbeauty ?? null;
const originImage = byName.about2 ?? byName.bridal ?? null;
const methodImage = byName.auth ?? byName.grooming ?? null;"""
    assert s.count(old) == 1, 'image picks not found'
    s = s.replace(old, """const heroImage = byName.about1 ?? byName.skinbeauty ?? null;
const originImage = byName.about2 ?? byName.bridal ?? null;
/* A 2.7:1 letterbox — it gets a band of its own rather than a column. */
const bandImage = byName.about3 ?? null;""")

    # "How we know it works" loses its portrait column and gains the band above it
    lines = s.split('\n')
    a = next(i for i, l in enumerate(lines) if "How it's evaluated" in l or 'How we know' in l and l.strip().startswith('{/*'))
    a = next(i for i, l in enumerate(lines) if l.strip().startswith('{/*') and 'evaluated' in l)
    b = next(i for i, l in enumerate(lines) if i > a and l.strip() == '</section>')
    block = lines[a:b + 1]
    body = '\n'.join(block)

    body = body.replace('<section className="about-split about-split--flip">',
                        '<section className="about-section">')
    body = body.replace('          <div className="about-split-copy">\n', '')
    # drop the figure and the div that wrapped the copy
    fa = body.index('        {methodImage && (')
    fb = body.index('        )}', fa) + len('        )}')
    body = body[:fa] + body[fb:]
    body = body.replace('          </div>\n', '')
    # de-indent the copy by two, it lost a wrapper
    out = []
    for ln in body.split('\n'):
        out.append(ln[2:] if ln.startswith('            ') else ln)
    body = '\n'.join(out)

    BAND = """      {/* A full-width band. The picture is a letterbox, so it gets the one
          shape on this page that suits it rather than being cropped into a
          column built for portraits. */}
      {bandImage && (
        <figure className="about-band" aria-hidden="true">
          <img src={bandImage} alt="" loading="lazy" decoding="async" />
        </figure>
      )}

"""
    lines[a:b + 1] = (BAND + body).split('\n')
    s = '\n'.join(lines)

    assert 'methodImage' not in s, 'methodImage still referenced'
    assert 'about-split--flip' not in s, 'flip modifier still used'
    assert s.count('<section') == s.count('</section>')
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('About.jsx')

# ══ CSS ═════════════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.about-band' in s:
    skipped.append('index.css')
else:
    # hero frame: the source is 0.56, but a frame that tall next to two
    # paragraphs is a column of photograph. Ratio for shape, cap for height.
    old_h = """.about-hero-media {
  border-radius: var(--radius-panel);
  overflow: hidden;
  aspect-ratio: 3 / 4;
  background: var(--surface);
}"""
    assert s.count(old_h) == 1, 'about hero media not found'
    s = s.replace(old_h, """.about-hero-media {
  border-radius: var(--radius-panel);
  overflow: hidden;
  /* about1 is 0.56 — nearly 9:16. Held at 3/4 and capped, so it keeps a
     portrait shape without becoming a column of photograph beside a
     two-paragraph heading. */
  aspect-ratio: 3 / 4;
  max-height: 24rem;
  background: var(--surface);
}""")

    old_s = """.about-split-media {
  margin: 0;
  border-radius: var(--radius-panel);
  overflow: hidden;
  aspect-ratio: 4 / 5;
  background: var(--surface);
}"""
    assert s.count(old_s) == 1, 'about split media not found'
    s = s.replace(old_s, """.about-split-media {
  margin: 0;
  border-radius: var(--radius-panel);
  overflow: hidden;
  /* about2 is exactly 2:3, so the frame is too — no crop at all until the
     cap bites on a wide window. */
  aspect-ratio: 2 / 3;
  max-height: 26rem;
  background: var(--surface);
}""")

    # the flip modifier has nothing left to flip
    s = s.replace("""/* Alternating sides down the page, so two picture-and-text sections never
   stack into one column of images. */
.about-split--flip .about-split-copy { order: 2; }
.about-split--flip .about-split-media { order: 1; }
""", "")
    s = s.replace("""  .about-split--flip .about-split-copy,
  .about-split--flip .about-split-media { order: 0; }
""", "")

    anchor = """/* The ten categories, numbered."""
    assert s.count(anchor) == 1
    s = s.replace(anchor, """/* Full-width band. Its ratio IS the source's, so nothing is cropped; the cap
   only matters on a very wide window. */
.about-band {
  margin: 0 0 3.5rem;
  border-radius: var(--radius-panel);
  overflow: hidden;
  aspect-ratio: 734 / 272;
  max-height: 22rem;
  background: var(--surface);
}
.about-band img { width: 100%; height: 100%; object-fit: cover; display: block; }

""" + anchor)

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
