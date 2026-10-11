import { useState, useEffect, useRef } from "react";
import { getMe, updateMe } from "../api/client";
import { CATEGORIES } from "../components/WeightLevels";

const OVERALL_BLURB = "A single score that blends all 7 categories, weighted by your priorities, to give one clear number for each salon.";

/* Read an image file, shrink it to a centred square and return a small JPEG
   data URL. Keeps the stored avatar tiny (~20 KB) so it fits in the DB text
   column without any file-storage backend. */
function fileToAvatarDataURL(file, box = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => { img.src = reader.result; };
    img.onerror = () => reject(new Error("That file is not a valid image."));
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = box;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, side, side, 0, 0, box, box);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    reader.readAsDataURL(file);
  });
}

function Avatar({ name, src, size = 80, onPick, uploading }) {
  const initials = name
    ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const inputRef = useRef(null);

  return (
    <div className="pf-avatar-wrap" style={{ "--av-size": `${size}px` }}>
      <button
        type="button"
        className="pf-avatar"
        onClick={() => inputRef.current?.click()}
        aria-label="Change profile picture"
        title="Change profile picture"
      >
        {src ? <img src={src} alt="" className="pf-avatar-img" /> : <span>{initials}</span>}
        <span className="pf-avatar-overlay" aria-hidden="true">
          {uploading ? "…" : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
    </div>
  );
}

function Field({ label, id, children }) {
  return (
    <div className="pf-field">
      <label className="pf-field-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function Profile({ token, onSignOut }) {
  const [user, setUser]     = useState(null);
  const [form, setForm]     = useState({ full_name: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function handleAvatarPick(file) {
    if (file.size > 8 * 1024 * 1024) { setError("Image is too large (max 8 MB)."); return; }
    setError(""); setUploading(true);
    try {
      const dataUrl = await fileToAvatarDataURL(file);
      const updated = await updateMe(token, { avatar_url: dataUrl });
      setUser((u) => ({ ...u, ...updated }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getMe(token)
      .then((u) => { setUser(u); setForm({ full_name: u.full_name ?? "" }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); };

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError("");
    try {
      const updated = await updateMe(token, { full_name: form.full_name.trim() });
      setUser((u) => ({ ...u, ...updated }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="pf-page">
        <div className="pf-loading">
          <div className="pf-spinner" />
          <p>Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pf-page">
        <div className="pf-empty">
          <p>Could not load profile. Please sign in again.</p>
          <button className="pf-signout" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    );
  }

  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const dirty = form.full_name.trim() !== (user.full_name ?? "").trim();

  return (
    <div className="pf-page">
      {/* ── Hero strip ──────────────────────────────────── */}
      <div className="pf-hero">
        <div className="pf-hero-inner">
          <Avatar
            name={user.full_name}
            src={user.avatar_url}
            size={88}
            onPick={handleAvatarPick}
            uploading={uploading}
          />
          <div className="pf-hero-text">
            <h1 className="pf-hero-name">{user.full_name || "Your Profile"}</h1>
            <p className="pf-hero-email">{user.email}</p>
            {joined && <p className="pf-hero-joined">Member since {joined}</p>}
          </div>
        </div>
      </div>

      <div className="pf-body">
        {/* ── Scoring summary ─────────────────────────────── */}
        <section className="pf-section">
          <div className="pf-section-head">
            <h2 className="pf-section-title">How salons are scored</h2>
            <p className="pf-section-sub">Every salon is measured across 7 categories. Your priorities set how they are weighted.</p>
          </div>
          <div className="pf-score-summary">
            {CATEGORIES.map(({ no, label, tag }) => (
              <div key={no} className="pf-score-row">
                <span className="pf-score-no">{String(no).padStart(2, "0")}</span>
                <div className="pf-score-body">
                  <span className="pf-score-label">{label}</span>
                  <span className="pf-score-tag">{tag}</span>
                </div>
              </div>
            ))}
            <div className="pf-score-row pf-score-row--overall">
              <span className="pf-score-no">✦</span>
              <div className="pf-score-body">
                <span className="pf-score-label">Overall Score</span>
                <span className="pf-score-tag">{OVERALL_BLURB}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Personal details ────────────────────────────── */}
        <section className="pf-section">
          <div className="pf-section-head">
            <h2 className="pf-section-title">Personal details</h2>
            <p className="pf-section-sub">Update your name as it appears on your account.</p>
          </div>

          <form className="pf-form" onSubmit={handleSave}>
            <Field label="Full name" id="pf-name">
              <input
                id="pf-name"
                type="text"
                value={form.full_name}
                onChange={set("full_name")}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </Field>

            <Field label="Email address" id="pf-email">
              <input
                id="pf-email"
                type="email"
                value={user.email}
                readOnly
                className="pf-readonly"
                title="Email cannot be changed here"
              />
            </Field>

            {error && <p className="pf-error" role="alert">{error}</p>}

            <div className="pf-form-footer">
              {saved && <span className="pf-saved">✓ Changes saved</span>}
              <button
                type="submit"
                className="pf-save-btn"
                disabled={saving || !dirty}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        {/* ── Account info ────────────────────────────────── */}
        <section className="pf-section">
          <div className="pf-section-head">
            <h2 className="pf-section-title">Account</h2>
            <p className="pf-section-sub">Manage your session.</p>
          </div>

          <div className="pf-info-rows">
            <div className="pf-info-row">
              <span className="pf-info-label">Account created</span>
              <span className="pf-info-value">{joined ?? "—"}</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-label">Email</span>
              <span className="pf-info-value">{user.email}</span>
            </div>
          </div>

          <div className="pf-danger-zone">
            <div>
              <p className="pf-danger-label">Sign out</p>
              <p className="pf-danger-sub">You will be returned to the home page.</p>
            </div>
            <button type="button" className="pf-signout-btn" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
