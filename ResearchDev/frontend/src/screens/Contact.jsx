/* The contact page, reached from the nav/footer. Its chat assistant posts to
   backend/api/contact.py; attributed to the signed-in user automatically if
   there is a valid token, anonymous otherwise. */
import { ContactChat } from "../components/ContactChat";
import {
  IconMail, IconClock, IconPin, IconInstagram, IconFacebook,
} from "../components/Icons";

/* Same filename-matched glob the other screens use, so all three agree about
   which picture is which. */
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
/* The one picture on this page. */
const heroImage = byName.contact1 ?? byName.about1 ?? null;

/* Trial: the photo seen through a mosaic of rounded tiles. Positions are in
   the SVG's own 300 x 400 units: three columns, four rows, a 9-unit gap, and
   some tiles spanning two cells. To go back, render the arched
   <figure className="cp-intro-media"> again instead of <MosaicImage>. */
const MOSAIC = (() => {
  const g = 9, cw = (300 - 2 * g) / 3, rh = (400 - 3 * g) / 4;
  const x = (c) => c * (cw + g), y = (r) => r * (rh + g);
  const w = (n) => n * cw + (n - 1) * g, h = (n) => n * rh + (n - 1) * g;
  return [
    [x(0), y(0), w(1), h(1)], [x(1), y(0), w(1), h(2)], [x(2), y(0), w(1), h(1)],
    [x(0), y(1), w(1), h(2)], [x(2), y(1), w(1), h(2)],
    [x(1), y(2), w(1), h(1)],
    [x(0), y(3), w(2), h(1)], [x(2), y(3), w(1), h(1)],
  ];
})();

function MosaicImage({ src }) {
  return (
    <figure className="cp-mosaic" aria-hidden="true">
      <svg viewBox="0 0 300 400" role="presentation">
        <defs>
          <clipPath id="cp-mosaic-clip">
            {MOSAIC.map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} rx="22" />
            ))}
          </clipPath>
        </defs>
        <image
          href={src}
          width="300"
          height="400"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#cp-mosaic-clip)"
        />
        {MOSAIC.map(([x, y, w, h], i) => (
          <rect key={i} className="cp-mosaic-edge" x={x + 0.5} y={y + 0.5}
                width={w - 1} height={h - 1} rx="21.5" />
        ))}
      </svg>
    </figure>
  );
}

export function Contact({ token, user, onSurvey }) {
  return (
    <div className="contactpage">
      {/* ── Opening: the headline beside the picture ───────── */}
      <header className="cp-intro">
        <div className="cp-intro-copy">
          <p className="cp-intro-kicker">Drop us a line</p>
          <h1 className="cp-intro-title">
            <span>We&apos;d love to</span>
            <span className="cp-intro-accent">hear from <em>you.</em></span>
          </h1>
          <p className="cp-intro-lede">
            A question about a ranking, a salon you&apos;d like listed, or something
            that doesn&apos;t look right? Write to us — a real person reads every
            message.
          </p>
          <ul className="cp-intro-facts">
            <li><span aria-hidden="true"><IconClock size={15} /></span>Replies within one working day</li>
            <li><span aria-hidden="true"><IconPin size={15} /></span>Colombo, Sri Lanka</li>
          </ul>
        </div>

        {heroImage && <MosaicImage src={heroImage} />}
      </header>

      {/* ── Form card + details ────────────────────────────── */}
      <div className="cp-body">
        <section className="cp-card cp-card--chat">
          <ContactChat token={token} user={user} />
        </section>

        <aside className="cp-details">
          <p className="about-kicker">Get in touch</p>
          <h2 className="cp-details-name">Amore Beauty</h2>

          {/* One row per detail, each led by a gold badge. The two repeated
              lines that used to sit at the foot (the city again, and the
              reply time) are gone — both are already on the opening. */}
          <ul className="cp-rows">
            <li>
              <span className="cp-row-icon" aria-hidden="true"><IconPin size={16} /></span>
              <span className="cp-row-body">
                <strong>Our office</strong>
                <span>Colombo 07, Western Province<br />Sri Lanka</span>
              </span>
            </li>
            <li>
              <span className="cp-row-icon" aria-hidden="true"><IconMail size={16} /></span>
              <span className="cp-row-body">
                <strong>Email us</strong>
                <a href="mailto:hello@amorebeauty.app">hello@amorebeauty.app</a>
              </span>
            </li>
            <li>
              <span className="cp-row-icon" aria-hidden="true"><IconClock size={16} /></span>
              <span className="cp-row-body">
                <strong>Support hours</strong>
                <span>Monday – Saturday<br />9:00 AM – 7:00 PM</span>
              </span>
            </li>
          </ul>

          <div className="cp-social">
            <a href="#" aria-label="Instagram" onClick={(e) => e.preventDefault()}>
              <IconInstagram size={16} />
            </a>
            <a href="#" aria-label="Facebook" onClick={(e) => e.preventDefault()}>
              <IconFacebook size={16} />
            </a>
            <a href="mailto:hello@amorebeauty.app" aria-label="Email">
              <IconMail size={16} />
            </a>
          </div>

          {/* A second, unrelated reason someone might be here: not a question
              for us, but feedback on the site itself. Kept apart from the
              contact channels above rather than folded into them. */}
          {onSurvey && (
            <div className="cp-survey-cta">
              <p>Already used the site? Tell us how it went.</p>
              <button type="button" className="cp-survey-btn" onClick={onSurvey}>
                Rate your experience
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
