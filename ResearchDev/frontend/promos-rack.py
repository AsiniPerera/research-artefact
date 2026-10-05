# -*- coding: utf-8 -*-
"""Offers become an expanding rack: one panel open, the rest folded to spines.

The open panel carries the photograph and the whole offer. The others collapse
to narrow vertical strips with their title and discount turned on end, and
clicking one opens it. The first is open on load.

How the motion works: every panel keeps the same flex-basis, and only
`flex-grow` changes — 0 when folded, 1 when open — so the open panel takes all
the space the folded ones leave. flex-grow is animatable; flex-basis to `auto`
is not, which is the trap in the obvious version of this.

Stacked, the axis turns: below 900px the rack is a column, the spines run
horizontally, and the animation moves to flex-basis (two lengths, so it still
interpolates) because grow along a column would fight the page height.

Replaces the booklet — 247 lines of spread, page-turn and folio CSS. The
offer typography survives again, restyled from paper back to white-on-photo.

Idempotent. Re-run after a revert:   python promos-rack.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Landing.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'offers-rack' in s:
    skipped.append('Landing.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── state: which panel is open. No direction any more ───────
    sub("""  /* Which offer is open, and which way we got there — the direction decides
     which page animates, so it has to survive into the render. */
  const [offer, setOffer] = useState(0);
  const [dir, setDir] = useState(1);
  const turn = (step) => {
    setDir(step);
    setOffer((o) => (o + step + PROMOS.length) % PROMOS.length);
  };
  const openOffer = PROMOS[offer];""",
        """  /* Which offer is open. The first one starts open, so the section never
     shows a rack of six closed spines with nothing to read. */
  const [offer, setOffer] = useState(0);""")

    # ── the section ─────────────────────────────────────────────
    a = s.index('      {/* ── Offers — a booklet you turn through')
    b = s.index('      {/* ── Reviews — what clients say')
    sub(s[a:b], '''      {/* ── Offers — an expanding rack ───────────────────── */}
      <section className="promos-section" ref={offersRef}>
        <div className="section-bar">
          <p className="eyebrow">Offers &amp; Promotions</p>
          <button type="button" className="link-arrow" onClick={() => onExplore()}>
            Browse Salons
            <IconArrow size={14} />
          </button>
        </div>

        <div className="offers-rack">
          {PROMOS.map(({ tag, amount, title, note, code, family, image }, i) => {
            const isOpen = i === offer;
            const img = promoImage(image);
            return (
              <section
                key={title}
                className={`offer-panel ${isOpen ? "is-open" : ""}`}
              >
                {isOpen ? (
                  <>
                    {img && (
                      <span
                        className="offer-photo"
                        aria-hidden="true"
                        style={{
                          backgroundImage: `url(${img})`,
                          ...POSTER_CROP[image],
                        }}
                      />
                    )}
                    <span className="offer-scrim" aria-hidden="true" />

                    <div className="offer-full">
                      <span className="promo-tag">{tag}</span>
                      <h3 className="promo-title">{title}</h3>
                      <span className="offer-amount">
                        <span className="promo-amount">{amount}</span>
                        <span className="promo-pct">% off</span>
                      </span>
                      <p className="promo-note">{note}</p>

                      <span className="promo-foot">
                        <span className="promo-code">Code · {code}</span>
                        <button
                          type="button"
                          className="promo-cta"
                          onClick={() => onExplore("services", family)}
                        >
                          Redeem
                          <IconArrow size={13} />
                        </button>
                      </span>
                    </div>
                  </>
                ) : (
                  /* The whole folded strip IS the control — a separate hit
                     target inside it would leave most of the panel dead. */
                  <button
                    type="button"
                    className="offer-spine"
                    onClick={() => setOffer(i)}
                    aria-expanded="false"
                  >
                    <span className="offer-spine-amount">{amount}%</span>
                    <span className="offer-spine-title">{title}</span>
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </section>

''')

    assert 'booklet' not in s, 'booklet markup survived'
    assert s.count('offer-panel') == 1
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.offers-rack' in s:
    skipped.append('index.css')
else:
    a = s.index('/* ── The booklet ')
    b = s.index('/* ── Reviews — a static grid')
    removed = s[a:b].count('\n')

    s = s[:a] + '''/* ── The offers rack ───────────────────────────────────────────────
   One panel open, the rest folded to spines. Six equal cards gave the eye
   nothing to rank; this makes the choice for it and lets the reader change
   its mind. */
.offers-rack {
  display: flex;
  gap: clamp(0.45rem, 1vw, 0.85rem);
  width: 100%;
  flex: 1;
  min-height: 0;
  max-height: 34rem;
}

.offer-panel {
  position: relative;
  overflow: hidden;
  border-radius: clamp(1.25rem, 2.6vw, 2.25rem);
  /* Basis stays put and only grow changes. Animating flex-basis to `auto`
     is the obvious version of this and it does not interpolate — `auto` is
     not a length, so the panel would snap open instead of sliding. */
  flex: 0 0 clamp(3.1rem, 5.5vw, 4.5rem);
  transition: flex-grow 0.55s var(--ease), flex-basis 0.55s var(--ease);
}
.offer-panel.is-open { flex-grow: 1; }

/* Folded grounds. Cycling through the palette by position rather than storing
   a colour per offer: the sequence is a property of the rack, not of any one
   promotion, and adding a seventh offer should not mean picking a colour. */
.offer-panel:nth-child(6n + 1) { background: var(--ink); color: #fff; }
.offer-panel:nth-child(6n + 2) { background: var(--gold-300); color: var(--ink); }
.offer-panel:nth-child(6n + 3) { background: var(--gold); color: #fff; }
.offer-panel:nth-child(6n + 4) { background: var(--gold-100); color: var(--ink); }
.offer-panel:nth-child(6n + 5) { background: var(--ink-800); color: #fff; }
.offer-panel:nth-child(6n + 6) { background: var(--surface); color: var(--ink); }

/* ── Folded: the spine ────────────────────────────────────── */
.offer-spine {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.4rem 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  /* Turned on end, then flipped, so it reads bottom-to-top the way a book
     spine does rather than upside down. */
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
.offer-spine-amount {
  font-family: var(--font-display);
  font-size: clamp(1.1rem, 1.9vw, 1.5rem);
  font-weight: 600;
}
.offer-spine-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.offer-panel:not(.is-open):hover { filter: brightness(1.08); }

/* ── Open: photograph, scrim, offer ───────────────────────── */
.offer-photo {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: 50% 25%;
  animation: offer-reveal 0.6s var(--ease) both;
}
/* Heaviest at the foot where the type sits, releasing upward — a flat wash
   would have to be as dark as the worst spot everywhere. */
.offer-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(22, 21, 15, 0.12) 0%,
    rgba(22, 21, 15, 0.34) 42%,
    rgba(22, 21, 15, 0.82) 82%,
    rgba(22, 21, 15, 0.93) 100%
  );
}
@keyframes offer-reveal {
  from { opacity: 0; transform: scale(1.06); }
  to { opacity: 1; transform: scale(1); }
}

.offer-full {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  height: 100%;
  padding: clamp(1.5rem, 3vw, 2.75rem);
  /* Held back a beat so it arrives as the panel finishes opening rather than
     sliding along inside a box that is still moving. */
  animation: offer-copy 0.45s var(--ease) 0.18s both;
}
@keyframes offer-copy {
  from { opacity: 0; transform: translateY(0.75rem); }
  to { opacity: 1; transform: translateY(0); }
}

/* The offer, back on a photograph. Every colour here was paper a moment ago;
   nothing else uses these classes, so they are set for this panel outright
   rather than overridden inside it. */
.promo-tag {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--gold-300);
}
.promo-title {
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 2.8vw, 2.1rem);
  font-weight: 600;
  color: #fff;
  margin-top: 0.3rem;
}
.offer-amount {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0.5rem 0 0.45rem;
  color: #fff;
}
.offer-amount .promo-amount {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4.6vw, 3.4rem);
  font-weight: 600;
  line-height: 1;
}
.offer-amount .promo-pct {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold-300);
}
.promo-note {
  font-size: 0.9rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
  max-width: 34ch;
}
.promo-foot {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  margin-top: 1.3rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(255, 255, 255, 0.3);
  width: 100%;
  max-width: 24rem;
}
.promo-code {
  padding: 0.35rem 0.7rem;
  border: 1px dashed rgba(255, 255, 255, 0.45);
  border-radius: var(--radius);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
}
.promo-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gold-300);
  cursor: pointer;
  white-space: nowrap;
}
.promo-cta svg { transition: transform 0.25s var(--ease); }
.promo-cta:hover svg { transform: translateX(3px); }

/* The panel still has to open for anyone who has asked for less motion —
   only the sliding and the zoom go. */
@media (prefers-reduced-motion: reduce) {
  .offer-panel { transition: none; }
  .offer-photo,
  .offer-full { animation: none; }
}

''' + s[b:]

    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    csub("""  /* The section stops claiming a screen, so the spread stops stretching to
     fill one and takes a height of its own. */
  .booklet-book { flex: none; height: 26rem; max-height: none; }""",
         """  /* The section stops claiming a screen, so the rack stops stretching to
     fill one and takes a height of its own. */
  .offers-rack { flex: none; height: 27rem; max-height: none; }""")

    csub("""  /* The spread folds into a single page: picture over offer. A spine drawn
     down the middle of one column would be a line through the copy. */
  .booklet-book {
    grid-template-columns: 1fr;
    grid-template-rows: 14rem auto;
    height: auto;
  }
  .booklet-spine { display: none; }
  /* Both halves are stacked now, so a page hinged on its left or right edge
     would swing out of the column. They settle instead. */
  .booklet-page--left.is-turning,
  .booklet-page--right.is-turning {
    animation: booklet-settle 0.42s var(--ease) both;
  }
  /* Nested deliberately. The reduced-motion block sits ~3000 lines earlier,
     so at equal specificity the rule above was overriding it and putting the
     animation back for anyone who had asked for less of it. This is the only
     place that ordering can be settled locally. */
  @media (prefers-reduced-motion: reduce) {
    .booklet-page--left.is-turning,
    .booklet-page--right.is-turning { animation: none; }
  }""",
         """  /* The rack turns through 90 degrees: a column of bars, the open one
     growing downward. Six spines side by side on a phone would be six
     3rem columns of rotated type. */
  .offers-rack {
    flex-direction: column;
    height: auto;
    max-height: none;
  }
  /* Along a column, flex-basis is the height — and two lengths interpolate,
     so the animation moves there. Growing instead would make the open panel
     fight the page for height. */
  .offer-panel { flex: 0 0 3.75rem; }
  .offer-panel.is-open { flex: 0 0 25rem; flex-grow: 0; }
  .offer-spine {
    writing-mode: horizontal-tb;
    transform: none;
    justify-content: flex-start;
    gap: 1.1rem;
    padding: 0 clamp(1.1rem, 4vw, 1.75rem);
  }
  /* Nested deliberately. The reduced-motion block sits ~3000 lines earlier,
     so at equal specificity the rules above would put the transition back
     for anyone who had asked for less of it. This is the only place that
     ordering can be settled locally. */
  @media (prefers-reduced-motion: reduce) {
    .offer-panel,
    .offer-panel.is-open { transition: none; }
  }""")

    assert 'booklet' not in s, 'booklet CSS survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css (%d lines of booklet CSS removed)' % removed)

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
