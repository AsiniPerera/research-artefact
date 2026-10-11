import { useState } from "react";
import logoMark from "../assets/images/logo/logo-mark.png";
import authBg   from "../assets/images/Auth/bridal.jpg";
import { IconFacebookBrand, IconGoogleBrand, IconInstagramBrand } from "../components/Icons";
import { signIn, signUp } from "../api/client";

const COPY = {
  signin: {
    title: "Welcome Back!",
    sub: "Sign in to your account",
    submit: "Log in",
    switchText: "Don't have an account?",
    switchCta: "Sign Up",
    switchTo: "signup",
  },
  signup: {
    title: "Create Account",
    sub: "Fill in your details to get started",
    submit: "Sign Up",
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
      <label className="auth-field" htmlFor={id}>
        <span className="auth-field-label sr-only">{label}</span>
        <div className={`auth-field-control ${error ? "has-error" : ""}`}>
          <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            autoComplete={autoComplete}
            placeholder={label}
            aria-describedby={error ? `${id}-err` : undefined}
            aria-invalid={!!error}
          />
          {children}
        </div>
      </label>
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
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

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
      onSignedIn?.(result.token, result.user);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
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
          </div>
        </aside>

        {/* ── Form panel ──────────────────────────── */}
        <div className="auth-form-panel">
          <div className="auth-form">
            <button className="auth-brand" onClick={onHome} aria-label="Amore Beauty — home">
              <img src={logoMark} alt="Amore Beauty" />
            </button>

            <h1 className="auth-title">{c.title}</h1>
            <p className="auth-sub">{c.sub}</p>

            {/* API-level error (wrong password, server down, etc.) */}
            {apiError && (
              <p className="auth-error" role="alert">{apiError}</p>
            )}

            <form onSubmit={handleSubmit} className="auth-fields" noValidate>
              {mode === "signup" && (
                <Field
                  id="auth-name"
                  label="Full name"
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
                  <button type="button" className="auth-forgot">Forgot your password?</button>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Please wait…" : c.submit}
              </button>

              <p className="auth-or" aria-hidden="true">Or continue with</p>

              <div className="auth-social">
                <button type="button" className="auth-social-btn" aria-label="Continue with Facebook" disabled title="Coming soon">
                  <IconFacebookBrand size={36} />
                </button>
                <button type="button" className="auth-social-btn" aria-label="Continue with Google" disabled title="Coming soon">
                  <IconGoogleBrand size={36} />
                </button>
                <button type="button" className="auth-social-btn" aria-label="Continue with Instagram" disabled title="Coming soon">
                  <IconInstagramBrand size={36} />
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

            <p className="auth-switch">
              {c.switchText}{" "}
              <button type="button" onClick={() => switchMode(c.switchTo)}>
                {c.switchCta}
              </button>
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
