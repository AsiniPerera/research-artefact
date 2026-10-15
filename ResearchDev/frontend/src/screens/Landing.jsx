/* The marketing homepage shown to a signed-out visitor, reached at "/".
   Laid out after the light studio reference: hero with stats, numbered
   service cards, why-us list, offers, feedbacks,
   closing call to action. Styles live in theme.css (`lp-`). */
import { useEffect, useRef } from "react";
import { SERVICE_FAMILIES, SUB_SERVICES } from "../constants/taxonomy";
import { IconArrow } from "../components/Icons";

const TRUST = [
  { title: "Unbiased picks",   note: "Salons never pay for a better spot." },
  { title: "Real client love", note: "Straight from people who sat in the chair." },
  { title: "Every service",    note: "Hair, nails, skin, bridal and grooming." },
  { title: "Matched to you",   note: "Ranked around what you care about most." },
];

/* Placeholder marketing content, carried over from the previous homepage. */
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
    quote: "Found a bridal artist for my sister's wedding here. The feedbacks were spot on — no surprises on the big day.",
    name: "Ishara Perera",
    role: "Bridal party · Gampaha",
  },
  {
    quote: "I loved the honest descriptions and real client details. It helped me choose a nail studio that delivered exactly what I wanted.",
    name: "Priya Senanayake",
    role: "Nail art client · Mount Lavinia",
  },
];

/* Placeholder marketing content, carried over from the previous homepage. */
const PROMOS = [
  { tag: "New here",       amount: "20", title: "Your first booking",  note: "Enjoy 20% off your very first salon visit.",            code: "AMORE20", family: null },
  { tag: "Wedding season", amount: "30", title: "Bridal & occasion",   note: "Up to 30% off bridal and occasion packages this season.", code: "BRIDE30", family: "makeup_bridal" },
  { tag: "Colour bar",     amount: "25", title: "Colour & keratin",    note: "25% off highlights, balayage and keratin smoothing.",    code: "HAIR25",  family: "hair" },
];

const FAMILY_BLURB = {
  hair: "Cuts, colour, treatments, styling and beard & shave services.",
  makeup_bridal: "Bridal and occasion artistry, including saree and osari draping.",
  nails: "Manicures, pedicures, gel, acrylic, art and extensions.",
  skin_beauty: "Facials, skin treatments, threading, brows, lashes and waxing.",
};

/* Images are matched by bare filename, case and separators ignored, so a
   file can be swapped in assets/images without a code change. */
const imageFiles = import.meta.glob(
  [
    "../assets/images/**/*.{jpg,jpeg,png,webp}",
    "!../assets/images/logo/**",
    "!../assets/images/source/**",
    "!../assets/images/hero.png",
  ],
  { eager: true, import: "default" }
);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const byName = Object.fromEntries(
  Object.entries(imageFiles).map(([path, url]) => [norm(path.split("/").pop().replace(/\.\w+$/, "")), url])
);
const pics = (...keys) => keys.map((k) => byName[k]).filter(Boolean);

const HERO_IMG = byName.l1 ?? byName.about1;
/* Read straight from services/: `hair` and `nails` also exist in offers/ as
   posters with another brand's text, and the flat name map above cannot tell
   the two folders apart. */
const serviceFiles = import.meta.glob("../assets/images/services/*.{jpg,jpeg,png,webp}", { eager: true, import: "default" });
const svcImg = Object.fromEntries(
  Object.entries(serviceFiles).map(([path, url]) => [norm(path.split("/").pop().replace(/\.\w+$/, "")), url])
);
/* Which photograph in services/ stands for each family. */
const FAMILY_IMAGE = { hair: "hair", skin_beauty: "skinbeauty", nails: "nails", makeup_bridal: "bridal" };
/* Only plain photographs: offers/, about2, about3 and the "Cloud Skin" file
   carry another brand's poster text. `hair` and `nails` are avoided as keys
   because offers/ has posters under the same names. */
const WHY_IMG = byName.contact1 ?? byName.l5;

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Landing({ onExplore, scrollToOffers = false, scrollToServices = false }) {
  const offersRef = useRef(null);
  const servicesRef = useRef(null);

  useEffect(() => {
    if (scrollToOffers) offersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (scrollToServices) servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollToOffers, scrollToServices]);

  return (
    <div className="lp">
      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div>
            <p className="lp-eyebrow">Thousands of real feedbacks, read for you</p>
            <h1 className="lp-h1">Find the salon that suits you</h1>
            <p className="lp-lede">
              We read what real clients wrote about every salon, so you don&apos;t have to.
              Tell us what matters to you, and we&apos;ll show you where to go.
            </p>
            <div className="lp-actions">
              <button type="button" className="lp-btn" onClick={() => onExplore()}>Find Your Salon</button>
              <button type="button" className="lp-link" onClick={() => onExplore("how")}>
                How it works <IconArrow size={14} />
              </button>
            </div>
            {/* Counts from the loaded research data in Colombo District. */}
            <dl className="lp-stats">
              <div><dt>Salons</dt><dd>549</dd></div>
              <div><dt>Feedbacks collected</dt><dd>27K+</dd></div>
              <div><dt>Services</dt><dd>51</dd></div>
            </dl>
          </div>
          {HERO_IMG && <img className="lp-hero-img" src={HERO_IMG} alt="" />}
        </div>
      </section>

      {/* ── Services ── */}
      <section className="lp-section lp-section--grey" ref={servicesRef}>
        <div className="lp-wrap">
          <div className="lp-head">
            <p className="lp-eyebrow">Our services</p>
            <h2 className="lp-h2">Explore by service</h2>
          </div>
          <div className="lp-svc-grid">
            {SERVICE_FAMILIES.map(({ value, label }, i) => (
              <button type="button" className="lp-svc" key={value}
                      onClick={() => onExplore("services", value)}>
                <span className="lp-svc-photo">
                  {svcImg[FAMILY_IMAGE[value]] && (
                    <img src={svcImg[FAMILY_IMAGE[value]]} alt="" loading="lazy" />
                  )}
                  <span className="lp-svc-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="lp-svc-body">
                  <h3>{label}</h3>
                  <p>{FAMILY_BLURB[value]}</p>
                  <span className="lp-svc-foot">
                    <span>{SUB_SERVICES[value].length} services</span>
                    <span className="lp-svc-go" aria-hidden="true"><IconArrow size={14} /></span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="lp-section lp-section--grey">
        <div className="lp-wrap lp-why">
          {WHY_IMG && <img src={WHY_IMG} alt="" />}
          <div>
            <p className="lp-eyebrow">Why Amore</p>
            <h2 className="lp-h2">What makes us different</h2>
            <ul className="lp-checks">
              {TRUST.map(({ title, note }) => (
                <li key={title}>
                  <Check />
                  <div><strong>{title}</strong><span>{note}</span></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Offers ── */}
      <section className="lp-section" ref={offersRef}>
        <div className="lp-wrap">
          <div className="lp-head">
            <p className="lp-eyebrow">Offers</p>
            <h2 className="lp-h2">This season&apos;s offers</h2>
          </div>
          <div className="lp-offers">
            {PROMOS.map(({ tag, amount, title, note, code, family }, i) => (
              <article key={title} className={`lp-offer ${i === 1 ? "lp-offer--featured" : ""}`}>
                {i === 1 && <span className="lp-offer-flag">Popular</span>}
                <span className="lp-offer-tag">{tag}</span>
                <p className="lp-offer-amount">{amount}%<small>off</small></p>
                <h3>{title}</h3>
                <p>{note}</p>
                <p className="lp-offer-code">CODE · {code}</p>
                <button type="button" className={`lp-btn ${i === 1 ? "" : "lp-btn--outline"}`}
                        onClick={() => onExplore("services", family)}>
                  Redeem
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className="lp-section lp-section--grey">
        <div className="lp-wrap">
          <div className="lp-head">
            <p className="lp-eyebrow">Testimonials</p>
            <h2 className="lp-h2">Client feedbacks</h2>
          </div>
          <div className="lp-reviews">
            {REVIEWS.map(({ quote, name, role }) => (
              <figure className="lp-review" key={name}>
                <span className="lp-stars" aria-label="5 stars">★★★★★</span>
                <blockquote>&ldquo;{quote}&rdquo;</blockquote>
                <figcaption>{name}<span>{role}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>


      {/* ── Closing CTA ── */}
      <section className="lp-section lp-cta">
        <div className="lp-wrap">
          <h2 className="lp-h2">Ready to find your salon?</h2>
          <p className="lp-lede">Tell us what matters to you, and we&apos;ll show you the salons that fit.</p>
          <button type="button" className="lp-btn" onClick={() => onExplore()}>Find Your Salon</button>
        </div>
      </section>
    </div>
  );
}
