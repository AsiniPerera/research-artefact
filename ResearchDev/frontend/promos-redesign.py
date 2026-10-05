# -*- coding: utf-8 -*-
"""Offers & Promotions, rebuilt.

The layout was five cards in a bento, and every one of them was the same
object: a portrait photo, a dark scrim, white type at the foot. Five of the
same thing in different sizes is why it read as flat — there was nothing for
the eye to rank, and the discount, which is the only reason anyone looks at
this section, was a 0.72rem pill in a corner.

Now: one photographic feature down the left, and four voucher rows down the
right. The vouchers are paper rather than photo, so the section has a light
half and a dark half; the discount is display-size gold numerals; and the
code sits behind a dashed perforation like something you tear off.

The markup barely moves. The row layout is CSS: the card becomes a grid of
thumb / numeral / content, and .promo-foot — which is nested inside
.promo-content, not a sibling — is placed into the content grid's second
column spanning all three text rows. Two things did change in the JSX:
a --ticket modifier to hang the rules on, and the badge split into the
number and its unit so they can be sized apart.

Idempotent. Re-run after a revert:   python promos-redesign.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Landing.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'promo-card--ticket' in s:
    skipped.append('Landing.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    sub("""              className={`promo-card ${feature ? "promo-card--feature" : ""}`}""",
        """              className={`promo-card ${
                feature ? "promo-card--feature" : "promo-card--ticket"
              }`}""")

    sub("""              <span className="promo-badge">{amount}% OFF</span>""",
        """              {/* Split so the two halves can be sized independently: on a
                  voucher the number is display-size and the unit is a caption
                  under it; on the feature they sit back on one baseline. */}
              <span className="promo-badge">
                <span className="promo-amount">{amount}</span>
                <span className="promo-pct">% off</span>
              </span>""")

    assert s.count('promo-card--ticket') == 1
    # Substring-counting <span vs </span> is wrong here: four spans on this
    # page are self-closing, and two of those carry multi-line attributes, so
    # a line-based regex misses them too. Walk the tags instead and count only
    # the ones that actually open an element. (No attribute on this page holds
    # a '>', so the next one always ends the tag.)
    def _opening_spans(src):
        i, n = 0, 0
        while True:
            i = src.find('<span', i)
            if i < 0:
                return n
            j = src.index('>', i)
            if src[j - 1] != '/':
                n += 1
            i = j + 1

    _opens = _opening_spans(s)
    assert _opens == s.count('</span>'), (
        'span mismatch: %d opening vs %d closing' % (_opens, s.count('</span>')))
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.promo-card--ticket' in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── 1. two columns: the feature, and a stack of four ────────
    csub("""/* Bento for five, which is the count that actually balances: one tall
   feature beside two columns of two. No card needs a special rule — the
   feature spans both rows and auto-placement fills the rest exactly.
   The `feature` flag already existed in the data; it only drew a ring. */
.promos-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr;
  grid-template-rows: repeat(2, 1fr);
  gap: 1.25rem;""",
         """/* One feature down the left, four vouchers stacked down the right.
   Auto-placement does the rest with no rule per card: the feature is pinned
   to column 1 across all four rows, so rows 1-4 of column 1 are occupied and
   every later item can only land in column 2, in order. */
.promos-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 1.45fr);
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 1rem 1.25rem;""")

    csub(""".promo-card--feature { grid-row: span 2; }""",
         """.promo-card--feature { grid-column: 1; grid-row: 1 / span 4; }""")

    # ── 2. the voucher, appended AFTER .promo-card:hover so its own
    #       hover (equal specificity) wins on source order ───────
    csub("""/* The feature card has the room to speak louder — bigger discount, bigger
   title. Its size is the emphasis now, so it drops the bronze ring. */
.promo-card--feature { min-height: 32rem; padding: 1.9rem; }
.promo-card--feature .promo-title { font-size: 2rem; }
.promo-card--feature .promo-note { font-size: 0.92rem; max-width: 34ch; }
.promo-card--feature .promo-badge {
  padding: 0.6rem 1rem;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
}""",
         """/* The feature card has the room to speak louder — bigger discount, bigger
   title. Its size is the emphasis now, so it drops the bronze ring. */
.promo-card--feature { min-height: 32rem; padding: 1.9rem; }
.promo-card--feature .promo-title { font-size: 2rem; }
.promo-card--feature .promo-note { font-size: 0.92rem; max-width: 34ch; }
.promo-card--feature .promo-badge {
  padding: 0.6rem 1rem;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
}
/* Back on one baseline, and no gap, so the two spans read as "20% off"
   rather than a stacked numeral. */
.promo-card--feature .promo-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 0;
}

/* ── The voucher rows ───────────────────────────────────────────────
   Paper, not photograph. Four of these beside one dark feature is what
   gives the section a light half and a dark half; five scrimmed photos
   gave it neither.

   Every rule here undoes something .promo-card set for a photo card —
   the ink background, the white type, the absolute media and badge — so
   this block has to stay AFTER .promo-card and .promo-card:hover, which
   it ties with on specificity. */
.promo-card--ticket {
  --promo-pad: clamp(0.85rem, 1.6vw, 1.2rem);
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: clamp(0.85rem, 1.8vw, 1.4rem);
  min-height: 0;
  padding: var(--promo-pad);
  color: var(--ink);
  background-color: var(--card);
  background-image: none;
  border: 1px solid var(--line-soft);
  box-shadow: var(--sh-sm);
}
.promo-card--ticket:hover {
  transform: translateY(-3px);
  border-color: var(--gold-300);
  box-shadow: var(--sh);
}

/* The photo survives as a thumbnail. Still biased up: these are portraits
   and a centred square crop takes the chin and the collarbone. */
.promo-card--ticket .promo-media {
  position: static;
  width: clamp(3rem, 5.5vw, 4.5rem);
  aspect-ratio: 1;
  border-radius: var(--radius);
  background-position: 50% 20%;
}
.promo-card--ticket .promo-scrim { display: none; }

/* The number is the whole point of an offer, so it is set like one. */
.promo-card--ticket .promo-badge {
  position: static;
  display: grid;
  justify-items: center;
  min-width: 3.25rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: var(--gold);
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: normal;
  text-transform: none;
}
.promo-card--ticket .promo-amount {
  font-family: var(--font-display);
  font-size: clamp(1.55rem, 3vw, 2.3rem);
  font-weight: 600;
  line-height: 1;
}
.promo-card--ticket .promo-pct {
  margin-top: 0.2rem;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

/* .promo-foot is nested inside .promo-content, not a sibling of it, so it
   cannot be a column of the card. Making .promo-content the grid instead
   and spanning the foot down all three text rows puts it on the right
   without touching the markup. */
.promo-card--ticket .promo-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: clamp(0.85rem, 1.8vw, 1.35rem);
}
.promo-card--ticket .promo-tag {
  grid-column: 1;
  color: var(--muted);
  letter-spacing: 0.16em;
}
.promo-card--ticket .promo-title {
  grid-column: 1;
  margin-top: 0.2rem;
  font-size: clamp(1rem, 1.6vw, 1.18rem);
  color: var(--ink);
}
.promo-card--ticket .promo-note {
  grid-column: 1;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--body);
}
/* The tear line. A dashed rule down the side of the stub is what makes the
   card read as something you detach rather than a list item. */
.promo-card--ticket .promo-foot {
  grid-column: 2;
  grid-row: 1 / span 3;
  align-self: stretch;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0;
  padding: 0 0 0 clamp(0.85rem, 1.8vw, 1.35rem);
  border-top: 0;
  border-left: 1px dashed var(--gold-300);
}
.promo-card--ticket .promo-code {
  border-color: var(--gold-300);
  color: var(--ink-700);
}
.promo-card--ticket .promo-cta { color: var(--gold); }""")

    # ── 3. ≤1100: same two columns, height no longer viewport-bound
    csub("""  .promos-grid {
    grid-template-columns: 1.15fr 1fr;
    grid-template-rows: repeat(3, 1fr);
    flex: none;
    max-height: none;
  }
  .promo-card--feature { grid-row: span 2; min-height: 0; }
  /* Two columns make each card wide; the extra height keeps more than a
     sliver of a portrait source in frame. */
  .promo-card { min-height: 18rem; }""",
         """  .promos-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    flex: none;
    max-height: none;
  }
  /* Only the photo card needs a floor. Applied to .promo-card it hit the
     vouchers too and stretched four text rows to 18rem each. */
  .promo-card--feature { min-height: 24rem; }""")

    # ── 4. ≤900: one column ─────────────────────────────────────
    csub("""  /* Stacked: nothing spans rows any more, and the row template goes with
     it — otherwise fixed fractions fight the stacked cards. */
  .promos-grid { grid-template-columns: 1fr; grid-template-rows: none; }
  /* Stacked and full width, the cards go wide — the crop tightens further,
     so lift the height to keep the subject in frame. */
  .promo-card--feature { grid-row: auto; }
  .promo-card { min-height: 19rem; }""",
         """  /* Stacked: nothing spans rows any more, and the row template goes with
     it — otherwise fixed fractions fight the stacked cards. */
  .promos-grid { grid-template-columns: 1fr; grid-template-rows: none; }
  /* Stacked and full width, the photo card goes wide — the crop tightens
     further, so lift the height to keep the subject in frame. */
  .promo-card--feature { grid-column: auto; grid-row: auto; min-height: 19rem; }""")

    # ── 5. ≤640: the stub goes under the copy ───────────────────
    csub("""  .promos-section { padding: 2.5rem var(--gutter) 0.5rem; }""",
         """  .promos-section { padding: 2.5rem var(--gutter) 0.5rem; }
  /* No room for four columns on a phone: the thumbnail goes, and the stub
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
  }""")

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
