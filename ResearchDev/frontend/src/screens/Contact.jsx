import { useState } from "react";
import { SelectMenu } from "../components/SelectMenu";
import {
  IconMail, IconClock, IconPin, IconInstagram, IconFacebook, IconArrow,
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

const REASONS = ["General enquiry", "List your salon", "Feedback", "Something went wrong"];

export function Contact() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", reason: REASONS[0], message: "",
  });
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSent(true);
  }

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
        <section className="cp-card">
          {sent ? (
            <div className="cp-done">
              <h2>Message sent</h2>
              <p>
                Thank you, {form.name.split(" ")[0] || "there"} — we&apos;ll be in touch
                within one working day.
              </p>
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setSent(false);
                  setForm({ name: "", email: "", phone: "", reason: REASONS[0], message: "" });
                }}
              >
                Send another
              </button>
            </div>
          ) : (
            <>
              <h2 className="cp-card-title">Contact form</h2>
              <p className="cp-card-sub">
                Fill this out so we can learn more about you and what you need.
              </p>

              <form className="cp-form" onSubmit={handleSubmit}>
                {/* Ruled fields with the label ABOVE the line rather than
                    floating in it. The reference shows placeholder-only
                    fields; a placeholder disappears the moment you type, so
                    the label stays and the placeholder is dropped. */}
                <label className="cp-field">
                  <span>Name and surname</span>
                  <input type="text" value={form.name} onChange={set("name")} placeholder="Your name"
                         autoComplete="name" required />
                </label>

                <label className="cp-field">
                  <span>Email address</span>
                  <input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com"
                         autoComplete="email" required />
                </label>

                <label className="cp-field">
                  <span>Phone number</span>
                  <input type="tel" value={form.phone} onChange={set("phone")} placeholder="Optional"
                         autoComplete="tel" />
                </label>

                {/* The site's own listbox, not a native <select>: the browser
                    draws a native option list itself, white, and CSS cannot
                    reach it. */}
                <div className="cp-select">
                  <SelectMenu
                    label="Subject"
                    value={form.reason}
                    options={REASONS.map((r) => ({ value: r, label: r }))}
                    onChange={(reason) => setForm((f) => ({ ...f, reason }))}
                  />
                </div>

                <label className="cp-field">
                  <span>Message</span>
                  <textarea rows={3} value={form.message} onChange={set("message")}
                            placeholder="Tell us how we can help…" />
                </label>

                {/* The same control as the home page's call to action: one
                    champagne pill with the arrow disc riding inside its own
                    padding, so the two pages ask in the same voice. */}
                <button type="submit" className="btn-hero cp-send">
                  Send message
                  <span className="btn-hero-disc" aria-hidden="true">
                    <IconArrow size={16} />
                  </span>
                </button>
              </form>
            </>
          )}
        </section>

        <aside className="cp-details">
          {/* Overlapping rings as a watermark, in the same spirit as the
              outlined numerals on the About cards: faint champagne outlines,
              large, bleeding off the corner. Decorative only. */}
          <svg className="cp-details-mark" viewBox="0 0 260 260" aria-hidden="true" focusable="false">
            <circle cx="168" cy="150" r="104" />
            <circle cx="168" cy="150" r="76" className="is-faint" />
            <circle cx="66" cy="104" r="48" />
            <circle cx="92" cy="216" r="26" className="is-faint" />
            <circle cx="214" cy="56" r="14" />
          </svg>

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
        </aside>
      </div>
    </div>
  );
}
