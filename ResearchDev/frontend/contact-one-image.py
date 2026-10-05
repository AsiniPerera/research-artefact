# -*- coding: utf-8 -*-
"""The Contact page keeps one picture: contact1, in the hero.

The second one — a skinBeauty crop bleeding off the left edge behind the form
card — goes. Its whole support structure goes with it, because nothing else
used any of it:

  .cp-body  position: relative   existed only as the containing block for the
                                 aside's absolute positioning
  .cp-card  position + z-index   existed only to stack the card above it
  the @media rule that hid it below 900px

Checked before removing: .cp-aside was the only absolutely positioned element
inside .cp-body. The hero's plate and title are absolute too, but they sit in
.cp-hero-stage, which has a position of its own.

Idempotent. Re-run after a revert:   python contact-one-image.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Contact.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Contact.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'asideImage' not in s:
    skipped.append('Contact.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    sub("""const heroImage = byName.contact1 ?? byName.about1 ?? null;
const asideImage = byName.skinbeauty ?? byName.bridal ?? null;""",
        """/* The one picture on this page. */
const heroImage = byName.contact1 ?? byName.about1 ?? null;""")

    sub("""      <div className="cp-body">
        {asideImage && (
          <figure className="cp-aside" aria-hidden="true">
            <img src={asideImage} alt="" loading="lazy" decoding="async" />
          </figure>
        )}

        <section className="cp-card">""",
        """      <div className="cp-body">
        <section className="cp-card">""")

    assert 'asideImage' not in s, 'asideImage still referenced'
    assert 'cp-aside' not in s, 'aside markup survived'
    assert s.count('<img') == 1, 'expected exactly one <img>, found %d' % s.count('<img')
    # cp-hero-plate is a self-closing <div ... />, so a raw count is off by
    # one by design. Count only divs that actually open an element.
    import re as _re
    opens = len(_re.findall(r'<div(?![^>]*/>)', s))
    assert opens == s.count('</div>'), 'div mismatch: %d vs %d' % (opens, s.count('</div>'))
    assert s.count('<section') == s.count('</section>'), 'section mismatch'
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Contact.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.cp-aside' not in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    csub("""/* ── Body: card, details, and a picture bleeding in ────────── */
.cp-body {
  position: relative;
  display: grid;""",
         """/* ── Body: the form card beside the details ────────────────── */
.cp-body {
  display: grid;""")

    csub("""/* Runs off the left edge, behind the card. Hidden below the two-column
   breakpoint: with one column there is no margin for it to bleed into. */
.cp-aside {
  position: absolute;
  left: calc(-1 * var(--gutter));
  bottom: -2rem;
  width: 15rem;
  aspect-ratio: 3 / 4;
  margin: 0;
  border-radius: 0 var(--radius-panel) var(--radius-panel) 0;
  overflow: hidden;
  z-index: 0;
}
.cp-aside img { width: 100%; height: 100%; object-fit: cover; display: block; }

.cp-card {
  position: relative;
  z-index: 1;
  background: var(--card);""",
         """.cp-card {
  background: var(--card);""")

    csub("""  .cp-body { grid-template-columns: 1fr; }
  /* No margin left to bleed into once the card is full width. */
  .cp-aside { display: none; }
""",
         """  .cp-body { grid-template-columns: 1fr; }
""")

    assert '.cp-aside' not in s, 'aside CSS survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
