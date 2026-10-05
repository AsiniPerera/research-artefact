# -*- coding: utf-8 -*-
"""Contact page: platform wording, and the form card lifted over the picture.

1. "Our doors are always open" belongs to a salon with doors. Amore Beauty is
   a platform across many salons, so the line now speaks for a team you write
   to rather than a shop you walk into. Two "Opening hours"/"Address" labels
   had the same problem and are corrected with it.

2. The form card now overlaps the hero photograph.

   Only the CARD moves. .cp-body is pulled up by --cp-overlap, which would
   drag the details column up with it and land body copy on the photograph —
   so .cp-details gets the same value back as padding, putting it exactly
   where it was. One variable moves one thing.

   .cp-body also needs `position: relative` again, for a different reason than
   the one it lost it for: .cp-hero-media is positioned, so without a position
   and a z-index of its own the card would paint UNDER the picture rather than
   over it.

   .cp-hero gains the body's 1180px measure. It was full-bleed while the body
   was capped, so on a wide window the two blocks had different edges and the
   overlap would have drifted with viewport width instead of holding.

Idempotent. Re-run after a revert:   python contact-overlap.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Contact.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Contact.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'cp-on-plate">We' in s:
    skipped.append('Contact.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    sub("""            <span className="cp-on-plate">Our doors are</span>{" "}
            <span className="cp-on-photo">always open</span>""",
        """            <span className="cp-on-plate">We&apos;d love to</span>{" "}
            <span className="cp-on-photo">hear from you</span>""")

    # the same single-salon slip, in the details column
    sub("""            <h3>Address</h3>""", """            <h3>Our office</h3>""")
    sub("""            <h3>Opening hours</h3>""", """            <h3>Support hours</h3>""")
    sub("""            <p className="cp-hours">Monday – Saturday: 9:00 AM to 7:00 PM</p>""",
        """            <p className="cp-hours">Monday – Saturday, 9:00 AM to 7:00 PM</p>""")

    assert 'Our doors are' not in s and 'Opening hours' not in s
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Contact.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '--cp-overlap' in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    csub(""".contactpage { padding: 0 0 4rem; }""",
         """.contactpage {
  padding: 0 0 4rem;
  /* How far the form card rises into the photograph above it. One value, used
     twice: negative on .cp-body to lift everything, and positive on
     .cp-details to put the details column back down where it was. */
  --cp-overlap: clamp(2rem, 9vw, 9rem);
}""")

    # the hero shares the body's measure, so the two line up at every width
    csub(""".cp-hero {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: center;
  padding: clamp(1.5rem, 4vw, 3.5rem) var(--gutter) clamp(2rem, 5vw, 4rem);
}""",
         """.cp-hero {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: center;
  padding: clamp(1.5rem, 4vw, 3.5rem) var(--gutter) clamp(2rem, 5vw, 4rem);
  /* Same measure as .cp-body. The hero used to run full-bleed while the body
     was capped at 1180, so their edges parted company on a wide window and
     the overlap below would have slid around with the viewport. */
  max-width: 1180px;
  margin: 0 auto;
}""")

    csub("""/* ── Body: the form card beside the details ────────────────── */
.cp-body {
  display: grid;""",
         """/* ── Body: the form card, lifted over the picture ──────────── */
/* position + z-index are load-bearing: .cp-hero-media is positioned, and a
   static block paints below positioned siblings whatever the source order —
   without these the card would slide UNDER the photograph. */
.cp-body {
  position: relative;
  z-index: 1;
  margin-top: calc(-1 * var(--cp-overlap));
  display: grid;""")

    # the details column stays put while the card rises past it
    csub(""".cp-details { padding-top: clamp(1rem, 3vw, 2.5rem); }""",
         """/* Takes back exactly what .cp-body's negative margin removed, so only the
   card actually moves; without this the details would ride up onto the
   photograph too. */
.cp-details { padding-top: calc(var(--cp-overlap) + clamp(1rem, 3vw, 2.5rem)); }""")

    # single column: a smaller lift, and nothing to hold back
    csub("""  .cp-body { grid-template-columns: 1fr; }""",
         """  .cp-body { grid-template-columns: 1fr; }
  /* Stacked, the details follow the card instead of sitting beside it, so the
     compensating padding would only open a gap. */
  .cp-details { padding-top: clamp(1rem, 3vw, 2.5rem); }""")

    csub("""  .cp-hero { grid-template-columns: 1fr; }""",
         """  .cp-hero { grid-template-columns: 1fr; }""")

    assert s.count('--cp-overlap') == 3, 'overlap used %d times, expected 3' % s.count('--cp-overlap')
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
