# -*- coding: utf-8 -*-
"""Offers & Promotions becomes a flip-through booklet.

One offer per spread: the photograph on the left page, the offer on the right,
a spine down the middle, and prev/next that turn the page.

The turn is one keyframe per direction, not a two-sided leaf. Forward, the
right page swings down from the spine (rotateY -88deg to 0, origin left);
back, the left page swings the other way (origin right). React `key` on each
page forces a remount so the animation replays on every change. A two-faced
leaf would be truer to a real book, but it needs the outgoing and incoming
spreads rendered at once and a second animation phase to hand off between
them — for six offers that is a lot of machinery to hang on a decoration.

The bento and the voucher rows go: 295 lines of card, media, scrim and ticket
CSS that nothing renders any more. The typography they were built from —
tag, title, note, code, the amount numerals — is kept and restyled for paper,
since the right-hand page needs exactly those.

Idempotent. Re-run after a revert:   python promos-booklet.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Landing.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'booklet' in s:
    skipped.append('Landing.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # useState went out with the landing contact form; the booklet needs it
    sub('''import { useEffect, useRef } from "react";''',
        '''import { useEffect, useRef, useState } from "react";''')

    # ── state ───────────────────────────────────────────────────
    sub("""  const offersRef = useRef(null);
  const servicesRef = useRef(null);""",
        """  const offersRef = useRef(null);
  const servicesRef = useRef(null);

  /* Which offer is open, and which way we got there — the direction decides
     which page animates, so it has to survive into the render. */
  const [offer, setOffer] = useState(0);
  const [dir, setDir] = useState(1);
  const turn = (step) => {
    setDir(step);
    setOffer((o) => (o + step + PROMOS.length) % PROMOS.length);
  };
  const openOffer = PROMOS[offer];""")

    # ── the section ─────────────────────────────────────────────
    a = s.index('      {/* ── Offers — featured salon promotions')
    b = s.index('      {/* ── Reviews — what clients say')
    sub(s[a:b], '''      {/* ── Offers — a booklet you turn through ─────────── */}
      <section className="promos-section" ref={offersRef}>
        <div className="section-bar">
          <p className="eyebrow">Offers &amp; Promotions</p>
          <button type="button" className="link-arrow" onClick={() => onExplore()}>
            Browse Salons
            <IconArrow size={14} />
          </button>
        </div>

        <div className="booklet">
          {/* aria-live rather than a live region per page: the spread is one
              unit of meaning, and announcing the picture separately from the
              offer would read as two unrelated updates. */}
          <div className="booklet-book" aria-live="polite">
            <div
              key={`left-${offer}`}
              className={`booklet-page booklet-page--left ${
                dir < 0 ? "is-turning" : ""
              }`}
            >
              {promoImage(openOffer.image) && (
                <span
                  className="booklet-photo"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${promoImage(openOffer.image)})`,
                    ...POSTER_CROP[openOffer.image],
                  }}
                />
              )}
            </div>

            <span className="booklet-spine" aria-hidden="true" />

            <div
              key={`right-${offer}`}
              className={`booklet-page booklet-page--right ${
                dir > 0 ? "is-turning" : ""
              }`}
            >
              <span className="promo-tag">{openOffer.tag}</span>
              <h3 className="promo-title">{openOffer.title}</h3>
              <span className="booklet-amount">
                <span className="promo-amount">{openOffer.amount}</span>
                <span className="promo-pct">% off</span>
              </span>
              <p className="promo-note">{openOffer.note}</p>

              <span className="promo-foot">
                <span className="promo-code">Code · {openOffer.code}</span>
                <button
                  type="button"
                  className="promo-cta"
                  onClick={() => onExplore("services", openOffer.family)}
                >
                  Redeem
                  <IconArrow size={13} />
                </button>
              </span>

              <span className="booklet-folio" aria-hidden="true">
                {String(offer + 1).padStart(2, "0")} / {String(PROMOS.length).padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="booklet-nav">
            <button
              type="button"
              className="booklet-arrow booklet-arrow--prev"
              onClick={() => turn(-1)}
              aria-label="Previous offer"
            >
              <IconArrow size={15} />
            </button>

            <ol className="booklet-dots">
              {PROMOS.map(({ title }, i) => (
                <li key={title}>
                  <button
                    type="button"
                    className={`booklet-dot ${i === offer ? "is-on" : ""}`}
                    onClick={() => {
                      setDir(i >= offer ? 1 : -1);
                      setOffer(i);
                    }}
                    aria-label={`Offer ${i + 1}: ${title}`}
                    aria-current={i === offer ? "true" : undefined}
                  />
                </li>
              ))}
            </ol>

            <button
              type="button"
              className="booklet-arrow"
              onClick={() => turn(1)}
              aria-label="Next offer"
            >
              <IconArrow size={15} />
            </button>
          </div>
        </div>
      </section>

''')

    assert 'promos-grid' not in s and 'promo-card' not in s, 'old grid markup survived'
    assert s.count('booklet-page') == 4
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.booklet' in s:
    skipped.append('index.css')
else:
    # one clean cut: everything from the grid comment to the last ticket rule
    a = s.index('/* One feature down the left')
    b = s.index('/* ── Reviews — a static grid')
    removed = s[a:b].count('\n')

    s = s[:a] + '''/* ── The booklet ───────────────────────────────────────────────────
   One offer per spread: photograph left, offer right, spine between. It
   replaced a bento of six photo cards — six of one object in different
   sizes, which gave the eye nothing to rank. */
.booklet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.85rem, 2vh, 1.4rem);
  flex: 1;
  min-height: 0;
}
.booklet-book {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: min(100%, 68rem);
  flex: 1;
  min-height: 0;
  /* Capped, because the pages are portrait sources: on a tall monitor an
     uncapped spread stretches past 2:1 and `cover` throws the subject away. */
  max-height: 32rem;
  background: var(--card);
  border: 1px solid var(--line-soft);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-lg);
  overflow: hidden;
  /* The turn is a 3D rotation, so the depth has to be declared on the parent
     — on the page itself it would apply per element and read as flat. */
  perspective: 2200px;
}

/* The gutter shadow. Two pages meeting with nothing between them read as two
   panels; the darkening at the join is what says "one sheet folded". */
.booklet-spine {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2.75rem;
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(22, 21, 15, 0) 0%,
    rgba(22, 21, 15, 0.09) 40%,
    rgba(22, 21, 15, 0.15) 50%,
    rgba(22, 21, 15, 0.09) 60%,
    rgba(22, 21, 15, 0) 100%
  );
}

.booklet-page {
  position: relative;
  min-width: 0;
  backface-visibility: hidden;
  animation: booklet-settle 0.42s var(--ease) both;
}
.booklet-page--left { background: var(--surface); }
.booklet-page--right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 0.35rem;
  padding: clamp(1.4rem, 3.2vw, 2.75rem);
  background: var(--card);
}
.booklet-photo {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: 50% 25%;
}

/* Forward turns the right page down from the spine; back turns the left one
   the other way. The page that is not turning simply settles, so both halves
   of the spread always change together. */
@keyframes booklet-settle {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes booklet-turn-right {
  from { transform: rotateY(-88deg); opacity: 0.15; }
  to   { transform: rotateY(0deg); opacity: 1; }
}
@keyframes booklet-turn-left {
  from { transform: rotateY(88deg); opacity: 0.15; }
  to   { transform: rotateY(0deg); opacity: 1; }
}
.booklet-page--right.is-turning {
  transform-origin: left center;
  animation: booklet-turn-right 0.5s var(--ease) both;
}
.booklet-page--left.is-turning {
  transform-origin: right center;
  animation: booklet-turn-left 0.5s var(--ease) both;
}

/* ── The offer, set on paper ──────────────────────────────────
   These five classes are all that survives the card design; every colour in
   them was written for white type on a scrimmed photograph. */
.promo-tag {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--muted);
}
.promo-title {
  font-family: var(--font-display);
  font-size: clamp(1.45rem, 3vw, 2.15rem);
  font-weight: 600;
  color: var(--ink);
  margin-top: 0.3rem;
}
.booklet-amount {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0.7rem 0 0.5rem;
  color: var(--gold);
}
.booklet-amount .promo-amount {
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 5.5vw, 3.9rem);
  font-weight: 600;
  line-height: 1;
}
.booklet-amount .promo-pct {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.promo-note {
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--body);
  max-width: 34ch;
}
.promo-foot {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  margin-top: 1.4rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--gold-300);
  width: 100%;
  max-width: 24rem;
}
/* Still reads as something to take away. */
.promo-code {
  padding: 0.35rem 0.7rem;
  border: 1px dashed var(--gold-300);
  border-radius: var(--radius);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ink-700);
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
  color: var(--gold);
  cursor: pointer;
}
.promo-cta svg { transition: transform 0.25s var(--ease); }
.promo-cta:hover svg { transform: translateX(3px); }

/* Page number, in the corner a book would put it. */
.booklet-folio {
  position: absolute;
  right: clamp(1.4rem, 3.2vw, 2.75rem);
  bottom: clamp(1rem, 2.4vw, 1.75rem);
  font-size: 0.64rem;
  letter-spacing: 0.16em;
  color: var(--faint);
  font-variant-numeric: tabular-nums;
}

/* ── Turning controls ─────────────────────────────────────── */
.booklet-nav {
  display: flex;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1.35rem);
}
.booklet-arrow {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 1px solid var(--line-soft);
  background: var(--card);
  color: var(--ink-700);
  cursor: pointer;
  transition: border-color 0.25s var(--ease), color 0.25s var(--ease);
}
.booklet-arrow:hover { border-color: var(--gold-300); color: var(--gold); }
/* One icon, turned round — a second mirrored asset for the same arrow is
   two things to keep in step. */
.booklet-arrow--prev svg { transform: rotate(180deg); }

.booklet-dots {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.booklet-dot {
  display: block;
  width: 0.45rem;
  height: 0.45rem;
  padding: 0;
  border: 0;
  border-radius: var(--pill);
  background: var(--gold-100);
  cursor: pointer;
  transition: width 0.3s var(--ease), background 0.3s var(--ease);
}
.booklet-dot.is-on { width: 1.5rem; background: var(--gold); }

/* A page turn is decoration. Anyone who has asked for less motion still
   needs the offer to change, so the content swaps with no animation at all
   rather than with a shortened one. */
@media (prefers-reduced-motion: reduce) {
  .booklet-page,
  .booklet-page--left.is-turning,
  .booklet-page--right.is-turning { animation: none; }
  .booklet-dot { transition: none; }
}

''' + s[b:]

    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── responsive: the grid rules have nothing left to size ────
    csub("""  .promos-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    flex: none;
    max-height: none;
  }
  /* Only the photo card needs a floor. Applied to .promo-card it hit the
     vouchers too and stretched four text rows to 18rem each. */
  .promo-card--feature { min-height: 24rem; }""",
         """  /* The section stops claiming a screen, so the spread stops stretching to
     fill one and takes a height of its own. */
  .booklet-book { flex: none; height: 26rem; max-height: none; }""")

    csub("""  /* Stacked: nothing spans rows any more, and the row template goes with
     it — otherwise fixed fractions fight the stacked cards. */
  .promos-grid { grid-template-columns: 1fr; grid-template-rows: none; }
  /* Stacked and full width, the photo card goes wide — the crop tightens
     further, so lift the height to keep the subject in frame. */
  .promo-card--feature { grid-column: auto; grid-row: auto; min-height: 19rem; }""",
         """  /* The spread folds into a single page: picture over offer. A spine drawn
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
  }""")

    csub("""  /* No room for four columns on a phone: the thumbnail goes, and the stub
     drops below the copy with the tear line turned through 90 degrees. */
  .promo-card--ticket { grid-template-columns: auto minmax(0, 1fr); }
  .promo-card--ticket .promo-media { display: none; }
  .promo-card--ticket .promo-content { grid-template-columns: minmax(0, 1fr); }
  .promo-card--ticket .promo-foot {
    grid-column: 1;
    grid-row: auto;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.75rem;
    padding: 0.7rem 0 0;
    border-left: 0;
    border-top: 1px dashed var(--gold-300);
  }""",
         """  /* The code and the action stop sharing a line on a phone measure. */
  .promo-foot { flex-wrap: wrap; gap: 0.75rem; }
  .promo-cta { margin-left: 0; }""")

    for dead in ('.promos-grid', '.promo-card', '.promo-media', '.promo-scrim',
                 '.promo-badge', '.promo-content'):
        assert dead not in s, 'dead selector survived: ' + dead
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css (%d lines of card CSS removed)' % removed)

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
