# -*- coding: utf-8 -*-
"""Our Services becomes a fan of five tall cards, one per domain.

The arch is one declaration, not five offsets: `align-items: center` on the
row, then three heights by position (short, medium, tall, medium, short). Each
card centres on a shared axis, so the taller ones grow equally up and down and
the run curves on its own. Hand-placed translateY offsets would have to be
re-tuned every time a height changed.

Five cards for the five taxonomy domains, and services/ already holds exactly
five photographs, resolved through the FAMILY_ALIASES chain that was already
there — so adding or replacing an image stays a drop-in.

The blurb no longer fits on a 180px-wide card, so it opens on hover and focus.
Label and count stay visible at all times: hover does not exist on a phone,
and everything needed to choose a card has to be readable without it.

Replaces the bordered grid — 105 lines of card, thumb and body CSS.

Idempotent. Re-run after a revert:   python services-fan.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Landing.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'services-fan' in s:
    skipped.append('Landing.jsx')
else:
    a = s.index('        <div className="services-cards">')
    b = s.index('        </div>\n      </section>', a) + len('        </div>\n      </section>')
    old = s[a:b]
    new = '''        {/* Five cards for five domains. The order is the taxonomy's, so the
            arch always puts the same one in the middle. */}
        <div className="services-fan">
          {SERVICE_FAMILIES.map(({ value, label }) => {
            const img = familyImage(value);
            return (
              <button
                type="button"
                className="fan-card"
                key={value}
                onClick={() => onExplore("services", value)}
              >
                <span
                  className={`fan-photo ${
                    CENTRE_CROP.has(value) ? "fan-photo--center" : ""
                  }`}
                  aria-hidden="true"
                  style={img ? { backgroundImage: `url(${img})` } : undefined}
                />
                <span className="fan-scrim" aria-hidden="true" />

                <span className="fan-label">
                  <h3>{label}</h3>
                  <span className="fan-count">
                    {SUB_SERVICES[value].length} services
                  </span>
                  <span className="fan-blurb">{FAMILY_BLURB[value]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>'''
    assert s.count(old) == 1
    s = s.replace(old, new)

    assert 'services-cards' not in s and 'service-thumb' not in s
    assert 'FAMILY_BLURB' in s, 'blurbs dropped'
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.services-fan' in s:
    skipped.append('index.css')
else:
    a = s.index('/* ── Services showcase ')
    b = s.index('/* ── Trust strip — the method in four beats')
    removed = s[a:b].count('\n')

    s = s[:a] + '''/* ── Services fan ────────────────────────────────────────────────
   Five tall cards, one per domain, curved into an arch.

   The arch is `align-items: center` plus three heights by position — not
   five hand-placed offsets. Each card centres on one axis, so a taller card
   grows equally above and below its neighbours and the curve falls out of
   the heights themselves. Offsets would need re-tuning on every size change;
   this needs none. */
.services-section { padding: clamp(1.5rem, 3vh, 2.5rem) var(--gutter); }

.services-fan {
  --fan-l: clamp(17rem, 31vw, 24rem);
  --fan-m: calc(var(--fan-l) * 0.85);
  --fan-s: calc(var(--fan-l) * 0.71);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(0.5rem, 1.4vw, 1.25rem);
  padding: clamp(0.75rem, 2vw, 1.75rem) 0;
}

.fan-card {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  max-width: 15rem;
  height: var(--fan-s);
  padding: 0;
  border: 0;
  border-radius: clamp(1rem, 2.2vw, 1.85rem);
  overflow: hidden;
  background: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--sh);
  transition: transform 0.4s var(--ease), box-shadow 0.4s var(--ease);
}
/* Short, medium, TALL, medium, short. */
.fan-card:nth-child(2),
.fan-card:nth-child(4) { height: var(--fan-m); }
.fan-card:nth-child(3) { height: var(--fan-l); }

.fan-card:hover,
.fan-card:focus-visible {
  transform: translateY(-8px);
  box-shadow: var(--sh-lg);
}

.fan-photo {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: var(--ink-800);
  background-size: cover;
  /* Biased up: these are portrait subjects, and the scrim darkens the foot,
     so the face belongs in the clear part. */
  background-position: 50% 20%;
  transition: transform 0.7s var(--ease);
}
/* Compositions with no face to frame to — the upward bias would lop off
   half of them. */
.fan-photo--center { background-position: 50% 50%; }
.fan-card:hover .fan-photo { transform: scale(1.06); }

.fan-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(22, 21, 15, 0) 34%,
    rgba(22, 21, 15, 0.5) 62%,
    rgba(22, 21, 15, 0.9) 100%
  );
}

.fan-label {
  position: absolute;
  inset: auto 0 0 0;
  z-index: 2;
  display: block;
  padding: clamp(0.8rem, 1.5vw, 1.2rem);
  color: #fff;
}
.fan-label h3 {
  font-family: var(--font-display);
  font-size: clamp(0.95rem, 1.4vw, 1.15rem);
  font-weight: 600;
  line-height: 1.25;
}
.fan-count {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-300);
}
/* No room for a blurb on a 180px card, so it opens on hover and focus. The
   label and count above it never hide: hover does not exist on a phone, and
   what you need in order to choose has to be readable without it. */
.fan-blurb {
  display: block;
  margin-top: 0;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  font-size: 0.72rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.82);
  transition: max-height 0.4s var(--ease), opacity 0.3s var(--ease),
              margin-top 0.4s var(--ease);
}
.fan-card:hover .fan-blurb,
.fan-card:focus-visible .fan-blurb {
  margin-top: 0.5rem;
  max-height: 6rem;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .fan-card,
  .fan-photo,
  .fan-blurb { transition: none; }
  .fan-card:hover .fan-photo { transform: none; }
}

''' + s[b:]

    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    csub("""  .services-section { padding: 3rem var(--gutter); }""",
         """  .services-section { padding: 3rem var(--gutter); }
  /* Five across stops fitting before the cards stop being legible, so the
     row scrolls instead. The arch goes with it — a curve reads as a mistake
     once only two or three cards are in view at a time.

     overflow-x on the container, never width:max-content on the row: an
     unclipped max-content row is what once gave the whole PAGE a sideways
     scroll in the reviews section. */
  .services-fan {
    justify-content: flex-start;
    align-items: stretch;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 0.75rem;
    padding-bottom: 1rem;
  }
  .fan-card,
  .fan-card:nth-child(2),
  .fan-card:nth-child(3),
  .fan-card:nth-child(4) {
    flex: 0 0 clamp(9.5rem, 34vw, 12rem);
    max-width: none;
    height: clamp(15rem, 46vw, 18rem);
    scroll-snap-align: start;
  }""")

    csub("""  .services-cards { grid-template-columns: repeat(2, 1fr); gap: 1rem; }\n""", "")

    for dead in ('.services-cards', '.service-card', '.service-thumb',
                 '.service-body', '.service-tag', '.service-more'):
        assert dead not in s, 'dead selector survived: ' + dead
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css (%d lines of card CSS removed)' % removed)

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
