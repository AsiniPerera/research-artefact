/* Opened from StaffReputation when a staff member's row is clicked. */
import { useEffect, useState } from "react";
import { getStaffReviews } from "../api/client";

const LANG = {
  english: "English",
  sinhala: "Sinhala",
  english_sinhala_mix: "English and Sinhala",
};

/** The reviews naming one staff member, in a drawer over the profile.
 *
 *  Shaped like the nav drawer — scrim, slide in from the right, Escape to
 *  close — so the app has one side-panel behaviour rather than two.
 */
export function StaffReviewsDrawer({ placeId, staffName, onClose }) {
  const [state, setState] = useState({ status: "loading", reviews: [], error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: "loading", reviews: [], error: null });
    getStaffReviews(placeId, staffName, { signal: ctrl.signal })
      .then((d) => setState({ status: "done", reviews: d.reviews ?? [], error: null }))
      .catch((e) => {
        if (e.name === "AbortError") return;
        setState({ status: "error", reviews: [], error: e.message });
      });
    return () => ctrl.abort();
  }, [placeId, staffName]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="staff-drawer-scrim is-open" onClick={onClose} aria-hidden="true" />
      <aside
        className="staff-drawer is-open"
        role="dialog"
        aria-label={`Reviews mentioning ${staffName}`}
      >
        <div className="staff-drawer-head">
          <h3>Reviews mentioning {staffName}</h3>
          <button type="button" className="staff-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {state.status === "loading" && <p className="staff-drawer-note">Loading…</p>}
        {state.status === "error" && <p className="staff-drawer-note">{state.error}</p>}
        {state.status === "done" && state.reviews.length === 0 && (
          <p className="staff-drawer-note">No reviews name {staffName} at this salon.</p>
        )}

        {state.reviews.length > 0 && (
          <div className="staff-drawer-list">
            {state.reviews.map((r) => (
              <article className="staff-review" key={r.review_id}>
                <div className="staff-review-head">
                  <span className={`staff-review-outcome ${r.outcome}`} title={r.outcome} />
                  <span>{"★".repeat(r.stars)}</span>
                  {r.published_at && <span>{r.published_at.slice(0, 10)}</span>}
                  {LANG[r.language] && <span>{LANG[r.language]}</span>}
                </div>
                {r.text && <p className="staff-review-text">{r.text}</p>}
              </article>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
