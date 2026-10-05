import { useState } from "react";
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
      {/* ── Opening: headline crossing the picture ─────────── */}
      <header className="cp-hero">
        {/* Rotated, and set in the flow rather than absolutely placed, so it
            cannot end up over the headline on a narrow window. */}
        <p className="cp-hero-rail" aria-hidden="true">
          <span>Drop us a line</span>
        </p>

        <div className="cp-hero-stage">
          <div className="cp-hero-plate" aria-hidden="true" />
          {heroImage && (
            <figure className="cp-hero-media">
              <img src={heroImage} alt="" fetchPriority="high" decoding="async" />
            </figure>
          )}
          {/* Over the plate on the left and the photo on the right, which is
              the whole effect — so it needs both a dark and a light half.
              Two spans, each coloured for the ground it lands on. */}
          <h1 className="cp-hero-title">
            <span className="cp-on-plate">We&apos;d love to</span>{" "}
            <span className="cp-on-photo">hear from you</span>
          </h1>
        </div>
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
                  <input type="text" value={form.name} onChange={set("name")}
                         autoComplete="name" required />
                </label>

                <label className="cp-field">
                  <span>Email address</span>
                  <input type="email" value={form.email} onChange={set("email")}
                         autoComplete="email" required />
                </label>

                <label className="cp-field">
                  <span>Phone number</span>
                  <input type="tel" value={form.phone} onChange={set("phone")}
                         autoComplete="tel" />
                </label>

                <label className="cp-field">
                  <span>Subject</span>
                  <select value={form.reason} onChange={set("reason")}>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>

                <label className="cp-field">
                  <span>Message</span>
                  <textarea rows={3} value={form.message} onChange={set("message")} />
                </label>

                <button type="submit" className="cp-send">Send message</button>
              </form>
            </>
          )}
        </section>

        <aside className="cp-details">
          <h2 className="cp-details-name">Amore Beauty</h2>

          <div className="cp-block">
            <h3>Our office</h3>
            <p>
              Colombo 07<br />
              Western Province<br />
              Sri Lanka
            </p>
          </div>

          <div className="cp-block">
            <h3>Email us</h3>
            <p><a href="mailto:hello@amorebeauty.app">hello@amorebeauty.app</a></p>
          </div>

          <div className="cp-block">
            <h3>Support hours</h3>
            <p className="cp-hours">Monday – Saturday, 9:00 AM to 7:00 PM</p>
          </div>

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

          <ul className="cp-meta">
            <li><span aria-hidden="true"><IconPin size={14} /></span>Colombo, Sri Lanka</li>
            <li><span aria-hidden="true"><IconClock size={14} /></span>Replies within one working day</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
