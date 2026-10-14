import { CATEGORIES } from "../components/WeightLevels";
import { IconArrow } from "../components/Icons";

/* The seven categories, taken from the priority panel so the two lists
   cannot disagree. Overall Verdict is stored but never shown. */

/* Images are optional and matched by filename — drop one in and it appears,
   no code change. Same glob the landing page uses, so the two never disagree
   about which picture belongs to which service. */
const imageFiles = import.meta.glob(
  /* ** so the subfolders count: the service photos live in images/services
     now, and a single-level glob quietly returned nothing for them.
     source/ holds the full-size originals — matching it would bundle a 5 MB
     PNG that nothing renders. */
  [
    "../assets/images/**/*.{jpg,jpeg,png,webp}",
    "!../assets/images/logo/**",
    "!../assets/images/source/**",
  ],
  { eager: true, import: "default" }
);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const byName = Object.fromEntries(
  Object.entries(imageFiles).map(([path, url]) => [
    norm(path.split("/").pop().replace(/\.\w+$/, "")),
    url,
  ])
);

/* The page uses about2 and about3 and nothing else. Both are tall portraits
   that belong beside copy rather than across the page, and about3 is now the
   same 0.56 ratio as the file it replaces, so it sits in the same frame with
   no change to the crop. */
const originImage = byName.about2 ?? byName.bridal ?? null;
/* Trial: the poster treatment (photo, plum bar, a huge vertical word that is
   outlined over the photo and gold-filled over the bar). about1 suits it: a
   plain warm background. To go back, render the plain <figure> with
   originImage again instead of <PosterImage>. */
const posterImage = byName.about1 ?? null;

function PosterImage({ src, word, side }) {
  return (
    <figure className="poster" aria-hidden="true">
      <span className="poster-photo" style={{ backgroundImage: `url(${src})` }} />
      <span className="poster-bar" />
      <span className="poster-layer poster-layer--line"><b>{word}</b></span>
      <span className="poster-layer poster-layer--fill"><b>{word}</b></span>
      <span className="poster-side">{side}</span>
    </figure>
  );
}
const methodImage = byName.about3 ?? byName.skinbeauty ?? null;

/* Render "&" in the plain text font — the display font's italic ampersand is
   too ornate in the category names. The rest of the name stays in display. */
function plainAmp(text) {
  return text.split("&").flatMap((part, i) =>
    i === 0 ? [part] : [<span key={i} className="amp-plain">&amp;</span>, part]
  );
}

export function About({ onExplore }) {
  return (
    <article className="about">
      {/* The page opens on type. The standfirst sits in the masthead rather
          than below it, so it takes the half of the line that a three-word
          headline leaves empty. */}
      <header className="about-hero">
        <div className="about-hero-copy">
          <p className="editorial-eyebrow">About</p>
          <h1>
            <span>Helping you find</span>
            <span className="about-accent">a salon you&apos;ll <em>love.</em></span>
          </h1>
          <p className="about-lede">
            Amore Beauty ranks salons on what their clients actually wrote, not on a
            single star average. You decide which things matter to you, and the ranking
            rearranges itself around that — because the salon that suits a bride the
            week before her wedding is rarely the one that suits a Tuesday afternoon
            haircut.
          </p>
        </div>
      </header>

      {/* ── Why it exists ─────────────────────────────── */}
      <section className="about-split">
        <div className="about-split-copy">
          <p className="about-kicker">Our story</p>
          <h2>Why it exists</h2>
          <p>
            Choosing a salon is a high-trust decision made with low-quality information. A
            4.6-star average flattens a hundred different opinions into one number that
            hides whichever thing you personally care about — whether the colour lasted,
            whether the place was clean, whether the price at the counter matched the price
            you were quoted. Worse, that number treats four reviews and four hundred as
            though they carry equal weight.
          </p>
          <p>
            So we take reviews apart into individual opinions, attach each one to a named
            category, and rebuild them into a score you control the shape of. What a salon
            is good at, how confident we are about it, and how much you care are three
            separate questions — and they deserve three separate answers rather than one
            blended star.
          </p>
        </div>
        {posterImage ? (
          <PosterImage src={posterImage} word="Beauty" side="Amore" />
        ) : originImage && (
          <figure className="about-split-media">
            <img src={originImage} alt="" loading="lazy" decoding="async" />
          </figure>
        )}
      </section>

      {/* ── What gets measured ────────────────────────── */}
      <section className="about-section">
        <p className="about-kicker">The framework</p>
        <h2>What gets measured</h2>
        <p className="about-note">
          Seven weighted quality categories. The vocabulary is fixed and closed — extraction
          can only ever return one of these, which is what keeps scores comparable between
          salons. You set how much each of them counts; none of them is weighted for you.
        </p>
        <ol className="about-cats">
          {CATEGORIES.map(({ no, label: name, tag }) => (
            <li key={no} data-no={String(no).padStart(2, "0")}>
              <span className="about-cat-no">{String(no).padStart(2, "0")}</span>
              <span className="about-cat-body">
                <strong>{plainAmp(name)}</strong>                <span>{tag}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── How it's evaluated ────────────────────────── */}
      {/* Four checks rather than three paragraphs. Same content, but a method
          is a list of things that had to pass — written as prose it reads as
          reassurance and nobody finishes it. Numbered in the same language as
          the categories above, so the page has one grammar. */}
      <section className="about-split about-split--flip">
        <div className="about-split-copy">
          <p className="about-kicker">Our method</p>
          <h2>How we know it works</h2>
          <p className="about-note">
            A ranking is only worth as much as the checks behind it. Every part of the
            method has to pass all four of these before it reaches a result you see.
          </p>
          <ol className="about-checks">
            <li>
              <span className="about-check-no">01</span>
              <span className="about-check-body">
                <strong>It agrees with people</strong>
                <p>
                  The reading is checked against the same reviews read by hand. Where
                  the two disagree too often, that part of the method does not ship.
                </p>
              </span>
            </li>
            <li>
              <span className="about-check-no">02</span>
              <span className="about-check-body">
                <strong>It beats the simple version</strong>
                <p>
                  Every step is raced against simply counting positive and negative
                  words. If the plain count does the job as well, the extra complexity
                  is not worth what it costs you in accuracy you cannot check.
                </p>
              </span>
            </li>
            <li>
              <span className="about-check-no">03</span>
              <span className="about-check-body">
                <strong>Nothing stays unless it earns it</strong>
                <p>
                  The confidence weighting is tested by taking it out. If removing it
                  does not make the ranking measurably worse, it was never doing
                  anything, and it goes.
                </p>
              </span>
            </li>
            <li>
              <span className="about-check-no">04</span>
              <span className="about-check-body">
                <strong>Your sliders behave</strong>
                <p>
                  Priorities are tested for stability, so nudging one slider shifts the
                  order a little rather than rewriting the whole list under you.
                </p>
              </span>
            </li>
          </ol>
        </div>
        {methodImage && (
          <figure className="about-split-media">
            <img src={methodImage} alt="" loading="lazy" decoding="async" />
          </figure>
        )}
      </section>

      {/* ── Close: one way onward ─────────────────────── */}
      {onExplore && (
        <section className="about-cta">
          <p className="about-kicker">Begin here</p>
          <h2>Your salon is already <em>waiting.</em></h2>
          <p>Tell us what matters to you, and we&apos;ll show you the salons that fit.</p>
          <button type="button" className="btn-hero" onClick={onExplore}>
            Find Your Salon
            <span className="btn-hero-disc" aria-hidden="true">
              <IconArrow size={16} />
            </span>
          </button>
        </section>
      )}
    </article>
  );
}
