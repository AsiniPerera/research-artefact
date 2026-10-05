# -*- coding: utf-8 -*-
"""Put the landing-page banner on the landing page.

"landing page.jpg" was dropped into images/source/, which is the one folder
every glob explicitly excludes — it holds the 5.4 MB hero.png master, and an
eager glob bundles whatever it matches whether or not anything renders it. So
the file could never load, and the hero went on borrowing contact1.jpg, the
contact page's portrait.

Moved to images/landing/, matching the per-page folders already there
(about/, contact/, offers/, profiles/, services/).

The crop has to be re-aimed with it. The old value was tuned for a portrait:
`object-position: 72%` pushed the subject right, away from the headline. This
source is a 1680x637 banner — 2.64:1 — built the other way round, with its
left ~40% deliberately left as empty soft beige for exactly this copy. Biasing
it right would drag the model back under the headline, which is the one thing
the picture was made to avoid. It is pulled left instead.

Phones need the opposite. At 2.64:1 against a portrait viewport, `cover` has
to crop most of the width away, and at 12% every pixel kept is empty beige —
the model never appears at all. Below 720px the crop moves onto her instead.

Idempotent. Re-run after a revert:   python landing-image.py
"""
import io
import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(ROOT, 'src', 'assets', 'images')
JSX = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ 1. out of the excluded folder ══════════════
src = os.path.join(IMG, 'source', 'landing page.jpg')
dstdir = os.path.join(IMG, 'landing')
dst = os.path.join(dstdir, 'landing page.jpg')
if os.path.exists(dst):
    skipped.append('the file (already in landing/)')
else:
    assert os.path.exists(src), 'source/landing page.jpg not found'
    if not os.path.isdir(dstdir):
        os.makedirs(dstdir)
    shutil.move(src, dst)
    done.append('moved to images/landing/')

# ══════════════════ 2. Landing.jsx ═════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'landingpage' in s:
    skipped.append('Landing.jsx')
else:
    old = """const heroBackdrop = byName.contact1 ?? byName.about1 ?? byName.auth ?? null;"""
    assert s.count(old) == 1, 'heroBackdrop not found'
    s = s.replace(old, """/* The banner made for this page, then the older stand-ins. contact1 was
   never meant to be here — it is the contact page's portrait, and the hero
   fell back to it when herogirl.jpg went in the folder reshuffle. */
const heroBackdrop =
  byName.landingpage ?? byName.contact1 ?? byName.about1 ?? null;""")
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══════════════════ 3. index.css ═══════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if 'a banner, not a portrait' in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # the section comment described the old portrait source
    csub("""/* ── Landing hero — copy left, portrait right ─────────────
   The subject is a portrait (2:3), so it sits beside the copy in its own
   frame rather than stretched behind everything: a tall photograph used as
   a full-bleed background on a wide screen loses most of its subject. */""",
         """/* ── Landing hero — copy left, picture behind ─────────────
   The source is a banner, not a portrait: 1680x637, with its left ~40% left
   empty on purpose so the copy has somewhere to sit. That is why it runs
   full-bleed behind everything rather than in a frame beside the copy — the
   empty half IS the layout. */""")

    csub("""  object-fit: cover;
  /* Biased right, so the room's subject sits in the sharp half rather than
     behind the headline. */
  object-position: 72% 50%;""",
         """  object-fit: cover;
  /* Pulled LEFT, which is the opposite of what a portrait source wanted.
     At 2.64:1 against a ~1.78:1 viewport, `cover` scales to height and crops
     roughly a third of the width away; anchored right, the crop ate the
     empty beige and put the model back under the headline. At 12% the empty
     side survives at about half the viewport, which is a little wider than
     the copy column. */
  object-position: 12% 50%;""")

    csub("""  .landing-hero { min-height: auto; }
  .hero-glass {
    grid-template-columns: 1fr;
    justify-items: stretch;
    gap: 2.25rem;
  }
}""",
         """  .landing-hero { min-height: auto; }
  .hero-glass {
    grid-template-columns: 1fr;
    justify-items: stretch;
    gap: 2.25rem;
  }
}

/* A 2.64:1 banner against a portrait viewport has to lose most of its width
   to `cover`. Held at 12% everything that survives is the empty half and the
   model never appears, so the crop moves onto her — the copy is stacked over
   the picture by then and no longer needs a clear side of its own. */
@media (max-width: 720px) {
  .hero-media img { object-position: 64% 50%; }
}""")

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
