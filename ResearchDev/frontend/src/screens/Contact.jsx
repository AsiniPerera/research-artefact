/* The contact form, reached from the nav/footer. Posts to
   backend/api/contact.py; attributed to the signed-in user automatically if
   there is a valid token, anonymous otherwise. */
import { useState } from "react";
import { SelectMenu } from "../components/SelectMenu";
import { submitInquiry } from "../api/client";
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

function validateContact(form) {
  const errs = {};
  if (!form.name.trim())          errs.name    = "Your name is required.";
  else if (form.name.trim().length < 2) errs.name = "Name must be at least 2 characters.";
  if (!form.email.trim())         errs.email   = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                  errs.email   = "Enter a valid email address.";
  if (form.phone && !/^[\d\s\+\-\(\)]{7,15}$/.test(form.phone))
                                  errs.phone   = "Enter a valid phone number.";
  if (!form.message.trim())       errs.message = "Please write a message.";
  else if (form.message.trim().length < 10)
                                  errs.message = "Message must be at least 10 characters.";
  return errs;
}

export function Contact({ token }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", reason: REASONS[0], message: "",
  });
  const [fieldErrs, setFieldErrs] = useState({});
  const [sent, setSent]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState("");

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (fieldErrs[k]) setFieldErrs((fe) => ({ ...fe, [k]: "" }));
    setApiError("");
  };

  const blur = (k) => () => {
    const errs = validateContact(form);
    if (errs[k]) setFieldErrs((fe) => ({ ...fe, [k]: errs[k] }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateContact(form);
    if (Object.keys(errs).length) { setFieldErrs(errs); return; }
    setApiError("");
    setLoading(true);
    try {
      await submitInquiry(form, token);
      setSent(true);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
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

              <form className="cp-form" onSubmit={handleSubmit} noValidate>

                <div className="cp-field-wrap">
                  <label className={`cp-field ${fieldErrs.name ? "cp-field--err" : ""}`}>
                    <span>Name and surname</span>
                    <input type="text" value={form.name} onChange={set("name")} onBlur={blur("name")}
                           placeholder="Your name" autoComplete="name"
                           aria-invalid={!!fieldErrs.name} />
                  </label>
                  {fieldErrs.name && <p className="cp-field-error">{fieldErrs.name}</p>}
                </div>

                <div className="cp-field-wrap">
                  <label className={`cp-field ${fieldErrs.email ? "cp-field--err" : ""}`}>
                    <span>Email address</span>
                    <input type="email" value={form.email} onChange={set("email")} onBlur={blur("email")}
                           placeholder="you@example.com" autoComplete="email"
                           aria-invalid={!!fieldErrs.email} />
                  </label>
                  {fieldErrs.email && <p className="cp-field-error">{fieldErrs.email}</p>}
                </div>

                <div className="cp-field-wrap">
                  <label className={`cp-field ${fieldErrs.phone ? "cp-field--err" : ""}`}>
                    <span>Phone number <span className="cp-optional">(optional)</span></span>
                    <input type="tel" value={form.phone} onChange={set("phone")} onBlur={blur("phone")}
                           placeholder="+94 77 000 0000" autoComplete="tel"
                           aria-invalid={!!fieldErrs.phone} />
                  </label>
                  {fieldErrs.phone && <p className="cp-field-error">{fieldErrs.phone}</p>}
                </div>

                <div className="cp-select">
                  <SelectMenu
                    label="Subject"
                    value={form.reason}
                    options={REASONS.map((r) => ({ value: r, label: r }))}
                    onChange={(reason) => setForm((f) => ({ ...f, reason }))}
                  />
                </div>

                <div className="cp-field-wrap">
                  <label className={`cp-field ${fieldErrs.message ? "cp-field--err" : ""}`}>
                    <span>Message</span>
                    <textarea rows={4} value={form.message} onChange={set("message")} onBlur={blur("message")}
                              placeholder="Tell us how we can help…"
                              aria-invalid={!!fieldErrs.message} />
                  </label>
                  {fieldErrs.message && <p className="cp-field-error">{fieldErrs.message}</p>}
                  <p className="cp-char-count" aria-live="polite">
                    {form.message.length} / 1000
                  </p>
                </div>

                {apiError && <p className="auth-error" role="alert">{apiError}</p>}

                <button type="submit" className="btn-hero cp-send" disabled={loading}>
                  {loading ? "Sending…" : "Send message"}
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
