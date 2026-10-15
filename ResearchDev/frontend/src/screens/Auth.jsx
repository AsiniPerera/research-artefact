/* Sign-in / sign-up, opened as a modal from the header (App.jsx). One
   component for both modes, switched by the `mode` prop and keyed off COPY
   below for the text that differs between them. */
import { useState } from "react";
import logoMark from "../assets/images/logo/logo-mark.png";
import authBg   from "../assets/images/Auth/bridal.jpg";
import { IconGoogleBrand } from "../components/Icons";
import { signIn, signUp } from "../api/client";

const COPY = {
  signin: {
    eyebrow: "Sign in",
    title: "Welcome back",
    sub: "Sign in to see salons ranked for you.",
    submit: "Log in",
    google: "Sign in with Google",
    switchText: "Don't have an account?",
    switchCta: "Sign Up",
    switchTo: "signup",
  },
  signup: {
    eyebrow: "Join Amore",
    title: "Create your account",
    sub: "Save favourites and get rankings that remember you.",
    submit: "Sign Up",
    google: "Sign up with Google",
    switchText: "Already have an account?",
    switchCta: "Log in",
    switchTo: "signin",
  },
};

/* ── Validation rules ──────────────────────────────────────────────── */
function validate(mode, form) {
  const errs = {};
  if (mode === "signup") {
    if (!form.name.trim())               errs.name = "Full name is required.";
    else if (form.name.trim().length < 2) errs.name = "Name must be at least 2 characters.";
  }
  if (!form.email.trim())                errs.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                         errs.email = "Enter a valid email address.";
  if (!form.password)                    errs.password = "Password is required.";
  else if (mode === "signup" && form.password.length < 8)
                                         errs.password = "Password must be at least 8 characters.";
  return errs;
}

/* ── Field component with inline error ─────────────────────────────── */
function Field({ id, label, type = "text", value, onChange, onBlur, autoComplete, error, children }) {
  return (
    <div className="auth-field-wrap">
      <div className={`auth-field-control ${error ? "has-error" : ""}`}>
        {/* The placeholder is a single space: it lets CSS tell an empty field
            from a filled one (:placeholder-shown) so the label can float. */}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder=" "
          aria-describedby={error ? `${id}-err` : undefined}
          aria-invalid={!!error}
        />
        <label className="auth-float" htmlFor={id}>{label}</label>
        {children}
      </div>
      {error && (
        <p className="auth-field-error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Auth({ mode, onSwitch, onHome, onSignedIn }) {
  const c = COPY[mode];
  const [form, setForm]       = useState({ name: "", email: "", password: "" });
  const [fieldErrs, setFieldErrs] = useState({});
  const [showPw, setShowPw]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [googleNote, setGoogleNote] = useState("");

  /* Reset field errors when mode switches */
  const switchMode = (to) => { setFieldErrs({}); setApiError(""); onSwitch(to); };

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    /* Clear that field's error as soon as the user starts fixing it */
    if (fieldErrs[k]) setFieldErrs((fe) => ({ ...fe, [k]: "" }));
    setApiError("");
  };

  /* Validate a single field on blur */
  const blur = (k) => () => {
    const errs = validate(mode, form);
    if (errs[k]) setFieldErrs((fe) => ({ ...fe, [k]: errs[k] }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(mode, form);
    if (Object.keys(errs).length) { setFieldErrs(errs); return; }

    setApiError("");
    setLoading(true);
    try {
      const result = mode === "signup"
        ? await signUp(form.name, form.email, form.password)
        : await signIn(form.email, form.password);
      onSignedIn?.(result.token, result.user, mode === "signin" ? remember : true);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <p className="auth-chip" aria-hidden="true"><span className="auth-chip-dot">A</span>amorebeauty.app</p>
      <div className="auth-card">
        {/* ── Image panel ─────────────────────────── */}
        <aside
          className="auth-visual has-photo"
          style={{ backgroundImage: `url(${authBg})` }}
          aria-hidden="true"
        >
          <div className="auth-visual-copy">
            <p className="eyebrow">The pinnacle of beauty standards</p>
            <p className="auth-quote">Chosen on evidence,<br />never on averages.</p>
            <ul className="auth-points">
              <li>Every written feedback read, not star averages</li>
              <li>No sponsored placement, ever</li>
              <li>Ranked around what matters to you</li>
            </ul>
          </div>
        </aside>

        {/* ── Form panel ──────────────────────────── */}
        <div className="auth-form-panel">
          <div className="auth-form">
            <button className="auth-brand" onClick={onHome} aria-label="Amore Beauty — home">
              <img src={logoMark} alt="Amore Beauty" />
            </button>

            <p className="auth-eyebrow">{c.eyebrow}</p>
            <h1 className="auth-title">{c.title}</h1>
            <p className="auth-sub">{c.sub}</p>

            {/* API-level error (wrong password, server down, etc.) */}
            {apiError && (
              <p className="auth-error" role="alert">{apiError}</p>
            )}

            {/* Google first, then the email and password form. Real Google
                sign-in needs a Google client ID and a server-side check of the
                ID token; until those exist the button says so rather than
                pretending to work. */}
            <button
              type="button"
              className="auth-google"
              onClick={() => setGoogleNote("Google sign-in isn't connected yet. Please use your email below.")}
            >
              <IconGoogleBrand size={20} />
              {c.google}
            </button>
            {/* The message takes the divider's place rather than adding a line. */}
            {googleNote ? (
              <p className="auth-google-note" role="status">{googleNote}</p>
            ) : (
              <p className="auth-or" aria-hidden="true"><span>or use your email</span></p>
            )}

            <form onSubmit={handleSubmit} className="auth-fields" noValidate>
              {mode === "signup" && (
                <Field
                  id="auth-name"
                  label="Full name"
                  placeholder="e.g. Ananya Perera"
                  value={form.name}
                  onChange={set("name")}
                  onBlur={blur("name")}
                  autoComplete="name"
                  error={fieldErrs.name}
                />
              )}

              <Field
                id="auth-email"
                label="Email address"
                placeholder="you@example.com"
                type="email"
                value={form.email}
                onChange={set("email")}
                onBlur={blur("email")}
                autoComplete="email"
                error={fieldErrs.email}
              />

              <Field
                id="auth-password"
                label="Password"
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                onBlur={blur("password")}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                error={fieldErrs.password}
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

              {/* Password strength hint on signup */}
              {mode === "signup" && form.password && (
                <PasswordStrength password={form.password} />
              )}

              {mode === "signin" && (
                <div className="auth-row">
                  <label className="auth-remember">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Remember me
                  </label>
                  <button type="button" className="auth-forgot">Forgot password?</button>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Please wait…" : c.submit}
              </button>

              {mode === "signup" && (
                <p className="auth-terms">
                  By continuing you agree to our{" "}
                  <button type="button">Terms</button> and{" "}
                  <button type="button">Privacy Policy</button>.
                </p>
              )}
            </form>

            <p className="auth-corner">
              {c.switchText}{" "}
              <button type="button" onClick={() => switchMode(c.switchTo)}>{c.switchCta}</button>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Password strength meter ──────────────────────────────────────── */
function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][score];
  const color = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"][score];

  return (
    <div className="auth-pw-strength">
      <div className="auth-pw-bars">
        {checks.map((ok, i) => (
          <span key={i} className="auth-pw-bar" style={{ background: i < score ? color : undefined }} />
        ))}
      </div>
      <span className="auth-pw-label" style={{ color }}>{label}</span>
    </div>
  );
}
