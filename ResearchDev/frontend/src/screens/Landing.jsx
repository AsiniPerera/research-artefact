import { useEffect, useRef, useState } from "react";
import { SERVICE_FAMILIES, SUB_SERVICES } from "../constants/taxonomy";
import {
  IconArrow,
  IconQuote,
  IconScale,
  IconGrid,
  IconSliders,
} from "../components/Icons";

/* What makes the app worth using, said in four salon-focused beats —
   the warm trust strip that sits under the hero. */
const TRUST = [
  { icon: IconScale,   title: "Unbiased picks",    note: "Salons never pay for a better spot." },
  { icon: IconQuote,   title: "Real client love",  note: "Straight from people who sat in the chair." },
  { icon: IconGrid,    title: "Every service",     note: "Hair, nails, skin, bridal and grooming." },
  { icon: IconSliders, title: "Matched to you",    note: "Ranked around what you care about most." },
];

/* Salon-app figures for the home band — product framing, not research. */
const STATS = [
  { value: "5",       label: "Services covered" },
  { value: "100%",    label: "Independent picks" },
  { value: "1,000s",  label: "Reviews read for you" },
  { value: "0",       label: "Sponsored spots" },
];

/* The client's booking journey in three beats — styled like the
   templates' insight row. Every card leads into the salon finder. */
const JOURNEY = [
  {
    kick: "Step 01",
    title: "Tell us what matters",
    note: "Skill, value, ambiance, a short walk from home — set the things you care about in a few taps.",
  },
  {
    kick: "Step 02",
    title: "Compare the best fits",
    note: "See salons matched to you, each with what clients loved and what to keep an eye on.",
  },
  {
    kick: "Step 03",
    title: "Book with confidence",
    note: "Pick the salon that suits you and walk in knowing exactly what to expect.",
  },
];

/* Sample client reviews of the app itself — placeholder marketing content,
   swap for real testimonials when you have them. */
const REVIEWS = [
  {
    quote: "Amore matched me with a colourist who finally understood what I wanted. Booked in two minutes and walked out thrilled.",
    name: "Ananya Sharma",
    role: "Colour client · Maharagama",
  },
  {
    quote: "I hate scrolling endless listings. This ranked the salons near me by what I actually care about — clean, calm and close.",
    name: "Maya Fernando",
    role: "Skin & facials · Kadawatha",
  },
  {
    quote: "Found a bridal artist for my sister's wedding here. The reviews were spot on — no surprises on the big day.",
    name: "Ishara Perera",
    role: "Bridal party · Gampaha",
  },
  {
    quote: "The booking process was effortless, and the salon recommendations felt personalized. I'm definitely using Amore again.",
    name: "Neha Wijesinghe",
    role: "Hair & colour · Nugegoda",
  },
  {
    quote: "I loved the honest descriptions and real client details. It helped me choose a nail studio that delivered exactly what I wanted.",
    name: "Priya Senanayake",
    role: "Nail art client · Mount Lavinia",
  },
  {
    quote: "Finally a way to find a facial spa without guessing. The results were calm, clean, and exactly what I needed.",
    name: "Samantha Perera",
    role: "Skin client · Dehiwala",
  },
  {
    quote: "Amore made it easy to compare salons on the services that mattered to me. My groomer was punctual, professional, and talented.",
    name: "Rohan Silva",
    role: "Grooming client · Galle",
  },
  {
    quote: "I was tired of the same old listings. Amore's curated salon suggestions helped me book a bridal trial with confidence.",
    name: "Kalani Rodrigo",
    role: "Bridal client · Kandy",
  },
  {
    quote: "The interface is beautiful and the reviews feel trustworthy. I found a hair studio that understood my texture and budget.",
    name: "Dinesh Perera",
    role: "Hair treatment · Colombo 7",
  },
  {
    quote: "A great service for a busy schedule — the salon recommendations were spot on, and the booking details were clear.",
    name: "Tharuka Fernando",
    role: "Beauty client · Negombo",
  },
];

/* Featured salon offers — placeholder marketing content. Each promo opens
   the finder, pre-filtered to the relevant family where it makes sense. */
const PROMOS = [
  {
    tag: "New here",
    amount: "20",
    title: "Your first booking",
    note: "New to Amore? Enjoy 20% off your very first salon visit.",
    code: "AMORE20",
    family: null,
    image: "1stoffer",
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
    image: "about1",
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
    family: "hair",
    image: "offerunisex",
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
];

/* First-initial monogram for the review avatar — no stock photos needed. */
const initials = (name) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* Images are optional and matched by filename — drop one into
   assets/images and it appears, no code change. Logos are excluded so
   they aren't pulled into the bundle for nothing. */
const imageFiles = import.meta.glob(
  [
    "../assets/images/**/*.{jpg,jpeg,png,webp}",
    "!../assets/images/logo/**",
    "!../assets/images/source/**",
    /* hero.png is a 3780x1890, 5.1 MB master. heroroom.webp is rendered
       from it at the sizes a browser actually needs, so the master is kept
       on disk but excluded here — an eager glob bundles whatever it matches
       whether or not anything renders it. */
    "!../assets/images/hero.png",
  ],
  { eager: true, import: "default" }
);

/* Case and separators shouldn't matter: skinBeauty, skin-beauty and
   skin_beauty are the same file to us. */
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const byName = Object.fromEntries(
  Object.entries(imageFiles).map(([path, url]) => [
    norm(path.split("/").pop().replace(/\.\w+$/, "")),
    url,
  ])
);

/* Nobody names a file `makeup_bridal.webp`, so accept the natural
   shorthands alongside the canonical taxonomy key. */
const FAMILY_ALIASES = {
  hair:          ["hair"],
  makeup_bridal: ["makeupbridal", "bridal", "makeup"],
  nails:         ["nails"],
  skin_beauty:   ["skinbeauty", "skin"],
};

const familyImage = (family) =>
  (FAMILY_ALIASES[family] ?? []).map((alias) => byName[alias]).find(Boolean) ?? null;

/* Room shot behind the hero. `norm` strips the space in the filename, so
   "modern salon.jpg" resolves as `modernsalon`. */
/* modernsalon: a 736x1104 portrait. That aspect suits the banner now that
   the picture holds the RIGHT of the frame instead of stretching across all
   of it — it is shown at roughly half width, so it is barely upscaled. */
/* The banner picture: a mosaic of eight rounded tiles in three columns,
   after a reference the client chose. SVG units: a 300 x 386 frame, a 9-unit
   gap, columns 94 wide and rows 89.75 tall; a tall tile spans two rows.

   Keys are bare filenames (see byName), so `nails` and `hair` are avoided:
   those exist in BOTH offers/ and services/ and the flat map keeps only one.
   Each photograph covers its tile and is shifted so its subject (fx, fy:
   fractions of the photo) lands at (tx, ty) within the tile.
     r  the photo's height / width */
const MOSAIC = (() => {
  const g = 9, cw = (300 - 2 * g) / 3, rh = (386 - 3 * g) / 4;
  const X = (c) => c * (cw + g), Y = (r) => r * (rh + g);
  const W = (n) => n * cw + (n - 1) * g, H = (n) => n * rh + (n - 1) * g;
  return [
    /* Seven tiles, no gaps: two tall tiles down each outer column, and the
       middle column small - tall - small, so the grid is symmetric and the
       hair portrait sits at its centre. */
    { key: "l2",         box: [X(0), Y(0), W(1), H(2)], fx: 0.32, fy: 0.22, r: 2.650 },  // colour
    { key: "grooming",   box: [X(0), Y(2), W(1), H(2)], fx: 0.57, fy: 0.16, r: 1.500 },  // men
    { key: "skinbeauty", box: [X(1), Y(0), W(1), H(1)], fx: 0.57, fy: 0.30, r: 1.499 },  // skin
    { key: "l1",         box: [X(1), Y(1), W(1), H(2)], fx: 0.42, fy: 0.24, r: 1.250 },  // hair
    { key: "l3",         box: [X(1), Y(3), W(1), H(1) + 36], fx: 0.55, fy: 0.68, r: 1.778 },  // nails
    { key: "bridal",     box: [X(2), Y(0), W(1), H(2)], fx: 0.55, fy: 0.20, r: 1.333 },  // bridal
    { key: "l4",         box: [X(2), Y(2), W(1), H(2)], fx: 0.45, fy: 0.28, r: 1.250 },  // the vanity
  ];
})();
const MOSAIC_R = 17;   // tile corner radius

function placeImage({ box: [bx, by, bw, bh], fx, fy, r, tx = 0.5, ty = 0.5, zoom = 1 }) {
  const W = zoom * Math.max(bw, bh / r);
  const H = W * r;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp(bx + tx * bw - fx * W, bx + bw - W, bx),
    y: clamp(by + ty * bh - fy * H, by + bh - H, by),
    width: W,
    height: H,
  };
}

function HeroMosaic() {
  const tiles = MOSAIC.filter((t) => byName[t.key]);
  return (
    <figure className="hero-mosaic" aria-hidden="true">
      <svg viewBox="0 0 300 422" role="presentation">
        <defs>
          {tiles.map(({ key, box: [x, y, w, h] }) => (
            <clipPath id={`hero-tile-${key}`} key={key}>
              <rect x={x} y={y} width={w} height={h} rx={MOSAIC_R} />
            </clipPath>
          ))}
        </defs>
        {tiles.map((tile) => (
          <g key={tile.key}>
            <image href={byName[tile.key]} preserveAspectRatio="none"
                   clipPath={`url(#hero-tile-${tile.key})`} {...placeImage(tile)} />
            <rect className="hero-tile-edge" x={tile.box[0] + 0.5} y={tile.box[1] + 0.5}
                  width={tile.box[2] - 1} height={tile.box[3] - 1} rx={MOSAIC_R - 0.5} />
          </g>
        ))}
      </svg>
    </figure>
  );
}

/* The five domains, straight from the taxonomy — so the hero can never
   list a service the app does not actually rank. */
/* Offer artwork resolves from images/offers before anywhere else.
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
    norm(path.split("/").pop().replace(/\.\w+$/, "")),
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
  /* The busiest of them: headline across the top third, a monogram top-right,
     and a real salon's phone number and street address banded across the
     bottom. The crop sits on the couple in the middle so none of it shows.
     Quoted because the key starts with a digit. */
  "1stoffer": { backgroundSize: "300%", backgroundPosition: "45% 58%" },
  /* Cropped hard to the male model on the right — the female model, the
     headline and the studio logo are all outside this frame. */
  offerunisex: { backgroundSize: "350%", backgroundPosition: "92% 16%" },
  /* Face upper-right; product shots along the bottom, headline top-left. */
  makeup: { backgroundSize: "200%", backgroundPosition: "85% 20%" },
  /* "25% OFF" is set across the middle, so the crop takes the top-right
     corner, which is hair and nothing else. */
  hair: { backgroundSize: "300%", backgroundPosition: "95% 5%" },
  /* Hands on the right; the loyalty-card panel fills the lower left. */
  nails: { backgroundSize: "200%", backgroundPosition: "85% 55%" },
};

/* Exact crops that centre a point of interest (a face, the hands) in a box.
     fx, fy  the point, as fractions of the image's width and height
     zoom    how far past "just covers the box" to go in
     r       the image's height / width
     box     the box's height / width
   Returns the background-size and background-position that put that point at
   the centre of the box, clamped so no edge of the image ever shows. */
function focus({ fx, fy, zoom, r }, box) {
  const S = zoom * Math.max(1, box / r);          // image width, in box widths
  const Sy = (S * r) / box;                       // image height, in box heights
  const pos = (f, k) => (k <= 1 ? 50 : Math.min(100, Math.max(0, ((0.5 - f * k) / (1 - k)) * 100)));
  return { backgroundSize: `${S * 100}% auto`, backgroundPosition: `${pos(fx, S)}% ${pos(fy, Sy)}%` };
}

/* The open offer shows its picture in a 4:5 frame, cropped to the people or
   hands and clear of the posters' own text and studio names. */
const OFFER_FRAME = 1.25;
const PROMO_FOCUS = {
  "1stoffer":  { fx: 0.48, fy: 0.58, zoom: 2.2, r: 1.499 },   // the couple at the vanity
  makeup:      { fx: 0.70, fy: 0.32, zoom: 2.0, r: 1.25 },    // the model's face
  about1:      { fx: 0.50, fy: 0.45, zoom: 1.25, r: 1.785 },  // balayage, face and lengths
  skinbeauty:  { fx: 0.55, fy: 0.40, zoom: 1.4, r: 1.499 },   // eyes closed, hand to cheek
  offerunisex: { fx: 0.77, fy: 0.45, zoom: 2.1, r: 1.335 },   // the two models
  nails:       { fx: 0.80, fy: 0.55, zoom: 2.3, r: 1.414 },   // the hands
};

/* Reviewer photos are full-length portraits; each avatar zooms to the face. */
const AVATAR_FOCUS = [
  { fx: 0.48, fy: 0.425, zoom: 3.2, r: 1.5 },
  { fx: 0.40, fy: 0.31, zoom: 3.3, r: 1.601 },
  { fx: 0.70, fy: 0.345, zoom: 3.6, r: 1.5 },
  { fx: 0.52, fy: 0.33, zoom: 2.3, r: 1.503 },
  { fx: 0.50, fy: 0.26, zoom: 2.3, r: 1.503 },
  { fx: 0.47, fy: 0.19, zoom: 2.5, r: 1.503 },
];

/* Reviewer avatars map by position: review #1 → profile1, #2 → profile2, …
   Missing files simply fall back to the initials monogram, so dropping in
   profile4…profile10 later needs no code change. */
const profileImage = (i) => byName[`profile${i + 1}`] ?? null;

/* The nails shot has no face to frame to — centre its crop so both hands
   stay in view rather than biasing upward like the portraits. */
const CENTRE_CROP = new Set(["nails"]);

const FAMILY_BLURB = {
  hair: "Cuts, colour, treatments, styling and beard & shave services.",
  makeup_bridal: "Bridal and occasion artistry, including saree and osari draping.",
  nails: "Manicures, pedicures, gel, acrylic, art and extensions.",
  skin_beauty: "Facials, skin treatments, threading, brows, lashes and waxing.",
};

export function Landing({
  onExplore,
  scrollToOffers = false,
  scrollToServices = false,
}) {
  const offersRef = useRef(null);
  const servicesRef = useRef(null);

  /* Which offer is open. The first one starts open, so the section never
     shows a rack of six closed spines with nothing to read. */
  const [offer, setOffer] = useState(0);

  useEffect(() => {
    if (scrollToOffers) {
      offersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (scrollToServices) {
      servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollToOffers, scrollToServices]);

  return (
    <div className="landing">
      {/* ── Hero: one full-bleed section, copy over the open left ─ */}
      <section className="landing-hero">
        {/* Copy left, the pictures right, both on a flat ground. */}
        <div className="hero-glass">
          <div className="hero-copy">
            <p className="hero-kicker">Thousands of real reviews, read for you</p>

            {/* One face, two voices: the setup upright, the promise in
                italic champagne. */}
            <h1 className="landing-title">
              <span className="lt-thin">Find the salon</span>
              <span className="lt-accent">that suits <em>you.</em></span>
            </h1>

            <p className="landing-lede">
              We read what real clients wrote about every salon, so you don&apos;t
              have to. Tell us what matters to you, and we&apos;ll show you where
              to go.
            </p>

            <div className="hero-actions">
              {/* One control: the disc rides inside the pill's own padding,
                  so the button keeps a single silhouette. */}
              <button type="button" className="btn-hero" onClick={() => onExplore()}>
                Find Your Salon
                <span className="btn-hero-disc" aria-hidden="true">
                  <IconArrow size={16} />
                </span>
              </button>
              <button type="button" className="hero-link" onClick={() => onExplore("how")}>
                How it works
              </button>
            </div>

            {/* Counts from the loaded research data (raw.provider, raw.review,
                ref.sub_service) in Colombo District. */}
            <dl className="hero-stats">
              <div><dt>Salons</dt><dd>549</dd></div>
              <div><dt>Reviews read</dt><dd>27,122</dd></div>
              <div><dt>Services</dt><dd>51</dd></div>
            </dl>

          </div>

          {/* Decorative. The service buttons below are the way in; a second
              silent set of controls here would be a keyboard stop with no
              label to announce. */}
          {/* Eight photographs in a mosaic of rounded tiles. */}
          <HeroMosaic />

        </div>

        <span className="hero-scroll" aria-hidden="true">
          <i />
          Scroll
        </span>

      </section>

      {/* ── Statement — one sentence, given room ─────────── */}
      <section className="statement">
        <div className="statement-inner">
          <span className="statement-ornament" aria-hidden="true"><i />✦<i /></span>
          <p className="eyebrow">The Amore Standard</p>
          <h2 className="statement-text">
            The right salon isn't the most talked-about — it's the one that fits
            <em> your hair, your budget</em> and the way you like to be looked after.
          </h2>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────── */}
      <section className="services-section" ref={servicesRef}>
        <div className="section-bar">
          <div className="section-head">
            <p className="eyebrow">Our Services</p>
            <h2 className="section-title">Explore by <em>service</em></h2>
          </div>
          <button type="button" className="link-arrow" onClick={() => onExplore()}>
            View All Services
            <IconArrow size={14} />
          </button>
        </div>

        {/* Five cards for five domains. The order is the taxonomy's, so the
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
      </section>

      {/* ── Offers — an expanding rack ───────────────────── */}
      <section className="promos-section" ref={offersRef}>
        <div className="section-bar">
          <div className="section-head">
            <p className="eyebrow">Offers &amp; Promotions</p>
            <h2 className="section-title">This season&apos;s <em>offers</em></h2>
          </div>
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

                    {img && (
                      <span className="offer-frame" aria-hidden="true">
                        <span
                          className="offer-photo"
                          style={{
                            backgroundImage: `url(${img})`,
                            ...(PROMO_FOCUS[image]
                              ? focus(PROMO_FOCUS[image], OFFER_FRAME)
                              : POSTER_CROP[image]),
                          }}
                        />
                      </span>
                    )}
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

      {/* ── Reviews — what clients say about Amore ───────── */}
      <section className="testimonials">
        <div className="section-bar">
          <div className="section-head">
            <p className="eyebrow">Reviews</p>
            <h2 className="section-title">Loved by <em>our clients</em></h2>
          </div>
        </div>

        {/* Six reviews, laid out and still. */}
        <div className="tm-grid">
          {REVIEWS.slice(0, 6).map((review, i) => {
            const avatar = profileImage(i);
            return (
              <article className="tm-item" key={review.name}>
                <blockquote className="tm-quote">{review.quote}</blockquote>
                <div className="tm-person">
                  {avatar ? (
                    <span
                      className="tm-avatar tm-avatar--photo"
                      style={{
                        backgroundImage: `url(${avatar})`,
                        ...(AVATAR_FOCUS[i] ? focus(AVATAR_FOCUS[i], 1) : {}),
                      }}
                      role="img"
                      aria-label={review.name}
                    />
                  ) : (
                    <span className="tm-avatar" aria-hidden="true">
                      {initials(review.name)}
                    </span>
                  )}
                  <span className="tm-who">
                    <span className="tm-name">{review.name}</span>
                    <span className="tm-role">{review.role}</span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Closing invitation ───────────────────────────── */}
      <section className="cta-band">
        <div className="cta-inner">
          <p className="eyebrow">Begin here</p>
          <h2 className="cta-title">
            Your salon is already
            <em> waiting.</em>
          </h2>
          <p className="cta-lede">
            Tell us what matters to you, and we'll show you the salons that fit.
          </p>
          <button type="button" className="btn-hero" onClick={() => onExplore()}>
            Find Your Salon
            <span className="btn-hero-disc" aria-hidden="true">
              <IconArrow size={16} />
            </span>
          </button>
        </div>
      </section>


    </div>
  );
}
