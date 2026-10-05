# -*- coding: utf-8 -*-
"""Wire the offers/ artwork into the promotions section.

Three separate problems, only one of which was visible:

1. PROMOS asked for "offers1", "offers2", "offers3". No such files exist, so
   promoImage() returned null and three of the five cards were rendering the
   fallback gradient rather than any photograph at all.

2. offers/hair.jpg and offers/nails.jpg collide with services/hair.png and
   services/nails.jpg. byName is one flat map keyed on the bare filename, and
   Object.fromEntries keeps the last entry — "services" sorts after "offers",
   so the services files won and the offers ones were unreachable while still
   being bundled. Promos now resolve from a dedicated offers glob first.

3. All four offers files are finished POSTERS for other salon brands, not
   photographs: each carries its own headline, its own logo, and in two cases
   its own discount and validity dates. Dropped in as card backgrounds they
   would put "The Blowout Blowdry Bar — 25% OFF, VALID JULY 1-31" underneath
   Amore Beauty's own title, code and percentage.

   So each one is cropped to its photographic region and zoomed past `cover`,
   which puts every piece of poster text and branding outside the frame. The
   numbers are per image, because where the model sits is a property of the
   artwork rather than of the offer.

Also adds a hair offer. offers/hair.jpg is a colour-and-keratin promotion and
there was no hair offer in the section at all, which left the largest service
domain unrepresented and that file with nowhere to go.

Idempotent. Re-run after a revert:   python promos-images.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Landing.jsx ════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'offerByName' in s:
    skipped.append('Landing.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'JSX expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── 1. the whole PROMOS array, remapped ─────────────────────
    a = s.index('const PROMOS = [')
    b = s.index('\n];', a) + len('\n];')
    sub(s[a:b], '''const PROMOS = [
  {
    tag: "New here",
    amount: "20",
    title: "Your first booking",
    note: "New to Amore? Enjoy 20% off your very first salon visit.",
    code: "AMORE20",
    family: null,
    image: "offerunisex",
    feature: true,
  },
  {
    tag: "Wedding season",
    amount: "30",
    title: "Bridal & occasion",
    note: "Up to 30% off bridal and occasion packages this season.",
    code: "BRIDE30",
    family: "makeup_bridal",
    image: "makeup",
  },
  {
    tag: "Colour bar",
    amount: "25",
    title: "Colour & keratin",
    note: "25% off highlights, balayage and keratin smoothing.",
    code: "HAIR25",
    family: "hair",
    image: "hair",
  },
  {
    tag: "Midweek glow",
    amount: "15",
    title: "Facials & skin",
    note: "15% off facials and skin treatments, Monday to Wednesday.",
    code: "GLOW15",
    family: "skin_beauty",
    image: "skinbeauty",
  },
  {
    tag: "Sharp & simple",
    amount: "25",
    title: "Men's grooming",
    note: "25% off cuts, beard work and grooming packages.",
    code: "SHARP25",
    family: "barber_grooming",
    image: "grooming",
  },
  {
    tag: "Weekend ready",
    amount: "20",
    title: "Nails & art",
    note: "20% off gel, acrylic and nail art on Fridays and Saturdays.",
    code: "POLISH20",
    family: "nails",
    image: "nails",
  },
];''')

    # ── 2. offers resolve from their own folder ─────────────────
    sub("""/* Any of these, first one present wins — so the section works whatever is
   in the assets folder. */
const promoImage = (key) => byName[key] ?? null;""",
        """/* Offer artwork resolves from images/offers before anywhere else.
   hair and nails exist in BOTH offers/ and services/, and byName is one flat
   map keyed on the bare filename — Object.fromEntries keeps the last entry,
   and "services" sorts after "offers", so the offers files were unreachable
   through byName while still being bundled. */
const offerFiles = import.meta.glob(
  "../assets/images/offers/*.{jpg,jpeg,png,webp}",
  { eager: true, import: "default" }
);
const offerByName = Object.fromEntries(
  Object.entries(offerFiles).map(([path, url]) => [
    norm(path.split("/").pop().replace(/\\.\\w+$/, "")),
    url,
  ])
);
/* Offers first, then the general pool — so a promo with no artwork of its
   own (skin, grooming) still finds its service photograph. */
const promoImage = (key) => offerByName[key] ?? byName[key] ?? null;

/* Every file in offers/ is a finished poster for another salon brand: its own
   headline, its own logo, and in two cases its own discount and dates. Left
   at `cover` they would sit under this section's title, code and percentage,
   and read as a competitor's advert.

   Each is therefore zoomed past cover and positioned on the photograph inside
   it, which puts all of that text outside the frame. The values belong to the
   artwork, not the offer, so they are keyed by image. Anything absent here is
   an ordinary photograph and keeps the default crop. */
const POSTER_CROP = {
  /* Two models, right of centre; the studio logo runs across the foot. */
  offerunisex: { backgroundSize: "220%", backgroundPosition: "82% 25%" },
  /* Face upper-right; product shots along the bottom, headline top-left. */
  makeup: { backgroundSize: "200%", backgroundPosition: "85% 20%" },
  /* "25% OFF" is set across the middle, so the crop takes the top-right
     corner, which is hair and nothing else. */
  hair: { backgroundSize: "300%", backgroundPosition: "95% 5%" },
  /* Hands on the right; the loyalty-card panel fills the lower left. */
  nails: { backgroundSize: "200%", backgroundPosition: "85% 55%" },
};""")

    # ── 3. apply the crop ───────────────────────────────────────
    # The services section uses an identical style line, so the promo one has
    # to be matched together with the className above it.
    sub("""                className={`promo-media ${img ? "has-photo" : ""}`}
                style={img ? { backgroundImage: `url(${img})` } : undefined}""",
        """                className={`promo-media ${img ? "has-photo" : ""}`}
                style={
                  img
                    ? { backgroundImage: `url(${img})`, ...POSTER_CROP[image] }
                    : undefined
                }""")

    assert s.count('offers1') == 0 and s.count('offers2') == 0 and s.count('offers3') == 0
    assert s.count('POSTER_CROP') == 2
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if 'span 5' in s and 'repeat(5, minmax(0, 1fr))' in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # six promos now: the feature plus five vouchers
    csub("""  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 1rem 1.25rem;""",
         """  grid-template-rows: repeat(5, minmax(0, 1fr));
  gap: 0.85rem 1.25rem;""")

    csub(""".promo-card--feature { grid-column: 1; grid-row: 1 / span 4; }""",
         """.promo-card--feature { grid-column: 1; grid-row: 1 / span 5; }""")

    # five rows need a little more room than four did
    csub("""  max-height: 42rem;""", """  max-height: 45rem;""")

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
