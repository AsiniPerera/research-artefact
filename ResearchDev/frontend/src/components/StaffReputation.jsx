/* Rendered on SalonDetail, fed by the staff_reputation block the provider
   endpoint returns. */
import { useState } from "react";
import { StaffReviewsDrawer } from "./StaffReviewsDrawer";
import { getScoreStyle } from "../lib/scoreScale";

/* Each bar takes its colour from the site-wide score scale, read on the
   person's positive rate (0-100), so staff and salon scores share one key. */

/** Staff named in this business's reviews. Display only, never scored. */
export function StaffReputation({ data, placeId }) {
  const staff = data?.staff ?? [];
  const [open, setOpen] = useState(null);
  /* Three people at first; the rest one click away, instead of a clipped list. */
  const [showAll, setShowAll] = useState(false);
  const SHOWN = 3;

  /* An absent section leaves the reader unsure whether nobody was named or
     the feature failed. Saying so, with the rule that produced it, answers
     that — the same reasoning as the dimmed sentiment chips. */
  if (staff.length === 0) {
    return (
      <section id="staff-reputation" className="evcard">
        <h3 className="evcard-head">Staff named in feedbacks</h3>
        <p className="evcard-note">
          No one is named in enough feedbacks here. A name is listed once it
          appears in at least 3 feedbacks — across all salons, extraction found
          a name on about one in three.
        </p>
      </section>
    );
  }

  return (
    <section id="staff-reputation" className="evcard">
      <h3 className="evcard-head">Staff named in feedbacks</h3>
      <p className="evcard-note">
        {staff.length} {staff.length === 1 ? "person is" : "people are"} named.
        The bar is the share of their mentions that are positive.
      </p>

      <ul className="evstaff">
        {(showAll ? staff : staff.slice(0, SHOWN)).map((s) => {
          const pct = Math.round(s.positive / s.reviews * 100);
          const st = getScoreStyle(pct);
          return (
            <li key={s.name} className="evstaff-row">
              <div className="evstaff-id">
                <button type="button" className="evstaff-name" onClick={() => setOpen(s.name)}>
                  {s.name}
                </button>
                <p className="evstaff-counts">
                  {s.positive} positive
                  {" · "}
                  {s.negative ? `${s.negative} negative` : "none negative"}
                  {" · "}
                  {s.reviews} mention{s.reviews === 1 ? "" : "s"}
                </p>
              </div>
              <span className="evstaff-bar" aria-hidden="true">
                <span style={{ width: `${pct}%`, background: st.color }} />
              </span>
              <span className="evstaff-pct" style={{ color: st.ink }}>{pct}%</span>
            </li>
          );
        })}
      </ul>

      {staff.length > SHOWN && (
        <button type="button" className="btn-text evcard-more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `See all ${staff.length} people`}
        </button>
      )}
      {open && (
        <StaffReviewsDrawer
          placeId={placeId}
          staffName={open}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
