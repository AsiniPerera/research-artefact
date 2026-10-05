import { useState } from "react";
import { IconFacebook, IconInstagram } from "../components/Icons";
import logoMark from "../assets/images/logo/logo-mark.png";

/* Side image — a dedicated auth.* if present, else the hero, else gradient. */
const authFiles = import.meta.glob("../assets/images/auth.{jpg,jpeg,png,webp}", {
  eager: true, import: "default",
});
/* heroroom.webp, not hero.png — see the note in Landing.jsx: the PNG master
   is 5.1 MB and an eager glob would ship it just for this fallback. */
const heroFiles = import.meta.glob("../assets/images/heroroom.webp", {
  eager: true, import: "default",
});
const sideImage = Object.values(authFiles)[0] ?? Object.values(heroFiles)[0] ?? null;

const COPY = {
  signin: {
    title: "Welcome Back!",
    sub: "Enter your details below",
    submit: "Log in",
    google: "Log in with Google",
    switchText: "Don't have an account?",
    switchCta: "Sign Up",
    switchTo: "signup",
  },
  signup: {
    title: "Create Account",
    sub: "Enter your details below",
    submit: "Sign Up",
    google: "Sign up with Google",
    switchText: "Already have an account?",
    switchCta: "Log in",
    switchTo: "signin",
  },
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function Field({ id, label, type = "text", value, onChange, autoComplete, children }) {
  return (
    <label className="auth-field" htmlFor={id}>
      {/* Visually hidden, not removed: the placeholder below is the visible
          name, but a placeholder is not an accessible one. It is not read by
          every screen reader and it vanishes as soon as anything is typed,
          so the label stays for both. */}
      <span className="auth-field-label sr-only">{label}</span>
      <div className="auth-field-control">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={label}
          required
        />
        {children}
      </div>
    </label>
  );
}

export function Auth({ mode, onSwitch, onHome }) {
  const c = COPY[mode];
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function handleSubmit(e) {
    e.preventDefault();
    // Prototype: no auth backend is wired yet. Acknowledge rather than
    // pretend a session was created.
    setDone(true);
  }

  return (
    <div className="auth">
      <div className="auth-card">
        {/* ── Image panel (left) ─────────────────────── */}
        <aside
          className={`auth-visual ${sideImage ? "has-photo" : ""}`}
          style={sideImage ? { backgroundImage: `url(${sideImage})` } : undefined}
          aria-hidden="true"
        >
          <div className="auth-visual-copy">
            <p className="eyebrow">The pinnacle of beauty standards</p>
            <p className="auth-quote">
              Chosen on evidence,<br />never on averages.
            </p>
          </div>
        </aside>

        {/* ── Form panel (right) ─────────────────────── */}
        <div className="auth-form-panel">
          <div className="auth-form">
            <button className="auth-brand" onClick={onHome} aria-label="Amore Beauty — home">
              <img src={logoMark} alt="Amore Beauty" />
            </button>

            <h1 className="auth-title">{c.title}</h1>
            <p className="auth-sub">{c.sub}</p>

            {done ? (
              <div className="auth-note">
                Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""} — accounts aren't
                connected in this prototype yet, so there's nothing to sign into.
                <button type="button" className="link-arrow" onClick={onHome}>
                  Back to home
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-fields">
                {mode === "signup" && (
                  <Field
                    id="auth-name"
                    label="Full name"
                    value={form.name}
                    onChange={set("name")}
                    autoComplete="name"
                  />
                )}

                <Field
                  id="auth-email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                />

                <Field
                  id="auth-password"
                  label="Password"
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                >
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7c2 0 3.8.6 5.3 1.5M22 12s-3.5 7-10 7c-2 0-3.8-.6-5.3-1.5" />
                        <path d="m4 4 16 16" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </Field>

                {mode === "signin" && (
                  <div className="auth-row">
                    <button type="button" className="auth-forgot">
                      Forgot your password?
                    </button>
                  </div>
                )}

                <button type="submit" className="auth-submit">{c.submit}</button>

                <p className="auth-or" aria-hidden="true">Or</p>

                <div className="auth-social">
                  <button type="button" aria-label={c.google.replace("Google", "Facebook")}
                          onClick={() => setDone(true)}>
                    <IconFacebook size={16} />
                  </button>
                  <button type="button" aria-label={c.google} onClick={() => setDone(true)}>
                    <GoogleIcon />
                  </button>
                  <button type="button" aria-label={c.google.replace("Google", "Instagram")}
                          onClick={() => setDone(true)}>
                    <IconInstagram size={16} />
                  </button>
                </div>

                {mode === "signup" && (
                  <p className="auth-terms">
                    By continuing you agree to our{" "}
                    <button type="button">Terms</button> and{" "}
                    <button type="button">Privacy Policy</button>.
                  </p>
                )}
              </form>
            )}

            <p className="auth-switch">
              {c.switchText}{" "}
              <button type="button" onClick={() => onSwitch(c.switchTo)}>
                {c.switchCta}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
