# -*- coding: utf-8 -*-
"""The hero becomes copy on a dark ground beside a run of photo slats.

Same shape as the reference: type left, a fan of tall narrow pictures right,
a ghosted word standing behind them. In this palette rather than that one —
ink ground with warm gold pools, tan accent, Playfair for the accent line.

What goes: the full-bleed backdrop and everything built to make type legible
on top of it — the masked progressive blur, its @supports fallback, the
directional scrim, and the 720px crop override. All of it existed to carry
copy over a photograph, and the copy is on a flat ground now. The banner
itself is not lost; it becomes the second slat.

The slats deliberately do NOT reuse the five service photographs. Those run
again in the fan one screen below, and the same five pictures twice in a row
reads as a shortage rather than a motif.

They are decorative — aria-hidden, not clickable. The five service buttons
sit directly beneath them and are the way in; making the pictures a second,
silent set of controls would just be a keyboard trap with no labels.

Idempotent. Re-run after a revert:   python hero-slats.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Landing.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'hero-slats' in s:
    skipped.append('Landing.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    sub("""/* The banner made for this page, then the older stand-ins. contact1 was
   never meant to be here — it is the contact page's portrait, and the hero
   fell back to it when herogirl.jpg went in the folder reshuffle. */
const heroBackdrop =
  byName.landingpage ?? byName.contact1 ?? byName.about1 ?? null;""",
        """/* The slats. Not the five service photographs on purpose: those run again
   in the fan a screen below, and the same five pictures twice reads as a
   shortage rather than a motif. Anything missing simply drops out — the
   stagger is by position, so four or three still fan correctly. */
const SLATS = ["about1", "landingpage", "about3", "contact1", "about2"]
  .map((key) => byName[key])
  .filter(Boolean);""")

    sub("""        {/* The room, full bleed behind everything. */}
        {heroBackdrop && (
          <div className="hero-media" aria-hidden="true">
            {/* The banner IS the first paint, so it is fetched at high
                priority rather than competing with the JS bundle. */}
            <img src={heroBackdrop} alt="" fetchPriority="high" decoding="async" />
          </div>
        )}

        {/* Copy left, the product itself right — both over the photograph. */}
        <div className="hero-glass">""",
        """        {/* Copy left, the pictures right, both on a flat ground. */}
        <div className="hero-glass">""")

    sub("""            <h1 className="landing-title">
              <span>Find the salon that</span>
              <span>suits <em>you.</em></span>
            </h1>""",
        """            {/* Two weights, two faces: the setup in the text face, the
                promise in the display one. */}
            <h1 className="landing-title">
              <span className="lt-thin">Find the salon that</span>
              <span className="lt-accent">suits you.</span>
            </h1>""")

    # the slats go in after the copy block, before the services list
    sub("""          {/* The five services along the foot of the hero.""",
        """          {/* Decorative. The service buttons below are the way in; a second
              silent set of controls here would be a keyboard stop with no
              label to announce. */}
          <div className="hero-slats" aria-hidden="true">
            <span className="hero-ghost">BEAUTY</span>
            {SLATS.map((src, i) => (
              <span
                key={src}
                className="hero-slat"
                style={{ backgroundImage: `url(${src})` }}
              />
            ))}
          </div>

          {/* The five services along the foot of the hero.""")

    assert 'heroBackdrop' not in s and 'hero-media' not in s
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.hero-slats' in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── 1. the ground goes dark ─────────────────────────────────
    csub("""  /* A dark room, not a pale field. The iridescent pools stay underneath as
     the no-photo fallback — drop the image and the hero still has a ground
     rather than collapsing to bare white. They are never seen while a photo
     is present, and cost nothing when it is. */
  background:
    radial-gradient(58rem 42rem at 10% 16%, rgba(var(--iris-sky),   0.62), transparent 63%),
    radial-gradient(50rem 38rem at 76%  4%, rgba(var(--iris-peri),  0.55), transparent 61%),
    radial-gradient(54rem 40rem at 92% 74%, rgba(var(--iris-sage),  0.52), transparent 63%),
    var(--paper);
}""",
         """  /* Ink, warmed by two gold pools. There is no photograph behind the copy
     any more, so this ground is what everything is read against rather than
     a fallback that is never seen. The iridescent pools went with the
     backdrop: they were mixed from hues this palette no longer contains. */
  background:
    radial-gradient(64rem 46rem at 74% 16%, rgba(150, 105, 47, 0.30), transparent 62%),
    radial-gradient(52rem 40rem at 8% 82%, rgba(212, 170, 125, 0.13), transparent 60%),
    var(--ink);
}""")

    # ── 2. everything built to carry type over a photo ──────────
    a = s.index('/* The photograph: sharp on the right, blurring away to the left.')
    b = s.index('/* Transparent, so the copy sits directly on the photograph.')
    removed = s[a:b].count('\n')
    s = s[:a] + s[b:]

    csub("""/* A 2.64:1 banner against a portrait viewport has to lose most of its width
   to `cover`. Held at 12% everything that survives is the empty half and the
   model never appears, so the crop moves onto her — the copy is stacked over
   the picture by then and no longer needs a clear side of its own. */
@media (max-width: 720px) {
  .hero-media img { object-position: 64% 50%; }
}

""", "")

    csub("""/* Transparent, so the copy sits directly on the photograph. The section
   carries the picture; this only carries the layout. */""",
         """/* Transparent: the section carries the ground, this only carries layout. */""")

    # ── 3. the slats take the right-hand column, full height ────
    csub("""  /* The copy takes a little under half; the rest is left open so the sharp
     side of the photograph is what fills it. */
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);""",
         """  /* The copy takes a little under half; the slats take the rest. */
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.12fr);""")

    csub(""".hero-services {
  grid-column: 1 / -1;""",
         """.hero-services {
  /* Column one only. Run full width it would pass under the slats, and the
     rule along its top would cut across the pictures. */
  grid-column: 1;""")

    # ── 4. the slats themselves ─────────────────────────────────
    anchor = """/* The five domains along the pane's foot, ruled off above. */"""
    assert s.count(anchor) == 1
    s = s.replace(anchor, """/* ── The slats ─────────────────────────────────────────────────
   A run of tall narrow pictures, fanned by height and nudged out of true.

   Heights alone would centre into a tidy arch — correct for the services
   fan, too neat here. The small alternating translateY is what keeps it
   reading as a set of loose slats rather than a chart. */
.hero-slats {
  position: relative;
  grid-column: 2;
  grid-row: 1 / -1;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(0.35rem, 0.8vw, 0.7rem);
  min-height: 0;
}
.hero-slat {
  flex: 1 1 0;
  min-width: 0;
  max-width: 8.5rem;
  border-radius: 3px;
  background-color: var(--ink-800);
  background-size: cover;
  background-position: 50% 28%;
  box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.75);
}
.hero-slat:nth-child(2) { height: 62%; transform: translateY(-5%); }
.hero-slat:nth-child(3) { height: 88%; transform: translateY(4%); }
.hero-slat:nth-child(4) { height: 72%; transform: translateY(-7%); }
.hero-slat:nth-child(5) { height: 95%; transform: translateY(3%); }
.hero-slat:nth-child(6) { height: 67%; transform: translateY(-4%); }

/* The word stands behind the slats, not beside them. Outlined rather than
   filled: at this size a filled word light enough to stay in the background
   is too faint to read as a word at all. `color` is set first so browsers
   without text-stroke still get a faint filled one. */
.hero-ghost {
  position: absolute;
  left: 0;
  top: 50%;
  z-index: 0;
  transform: translate(-38%, -50%) rotate(180deg);
  writing-mode: vertical-rl;
  font-family: var(--font-display);
  font-size: clamp(3.5rem, 9vw, 8rem);
  font-weight: 600;
  letter-spacing: 0.1em;
  line-height: 1;
  color: rgba(255, 255, 255, 0.05);
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.13);
  pointer-events: none;
  user-select: none;
}

""" + anchor)

    # ── 5. stacked: the slats become a band under the copy ──────
    csub("""  .hero-glass {
    grid-template-columns: 1fr;
    justify-items: stretch;
    gap: 2.25rem;
  }""",
         """  .hero-glass {
    grid-template-columns: 1fr;
    justify-items: stretch;
    gap: 2.25rem;
  }
  /* One column, so the slats stop being a column of their own and become a
     band under the copy. Percentage heights need something to be a
     percentage OF, and the row is content-sized now — hence a fixed band
     height with the fan expressed inside it. */
  .hero-slats {
    grid-column: 1;
    grid-row: auto;
    height: 15rem;
    justify-content: center;
  }
  .hero-slat { max-width: 6rem; }
  .hero-ghost { transform: translate(-50%, -50%) rotate(180deg); opacity: 0.6; }""")

    assert '.hero-media' not in s, 'hero-media CSS survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css (%d lines of backdrop CSS removed)' % removed)

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
