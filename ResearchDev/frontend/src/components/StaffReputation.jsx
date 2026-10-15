/* Rendered on SalonDetail, fed by the staff_reputation block the provider
   endpoint returns. */
import { useState } from "react";
import { StaffReviewsDrawer } from "./StaffReviewsDrawer";
import { RingChart } from "./RingChart";
import { getScoreStyle } from "../lib/scoreScale";

/* Each ring takes its colour from the site-wide score scale, read on the
   person's positive rate (0-100), so staff and salon scores share one key. */

/** Staff named in this business's reviews. Display only, never scored. */
export function StaffReputation({ data, placeId }) {
  const staff = data?.staff ?? [];
  const [open, setOpen] = useState(null);

  /* An absent section leaves the reader unsure whether nobody was named or
     the feature failed. Saying so, with the rule that produced it, answers
     that — the same reasoning as the dimmed sentiment chips. */
  if (staff.length === 0) {
    return (
      <section id="staff-reputation" className="staff-mentions">
        <h3 className="staff-head">Staff mentioned in feedbacks</h3>
        <p className="staff-note">
          No one is named in enough feedbacks here. A name is listed once it
          appears in at least 3 feedbacks — across all salons, extraction found
          a name on about one in three.
        </p>
      </section>
    );
  }

  return (
    <section id="staff-reputation" className="staff-mentions">
      <h3 className="staff-head">Staff mentioned in feedbacks</h3>
      <p className="staff-note">
        Counts reflect feedbacks naming each person. Attribution is at the
        feedback level, not statement level: each feedback counts by its
        overall sentiment.
      </p>
      <ul className="staff-list">
        {staff.map((s) => {
          const pct = Math.round(s.positive / s.reviews * 100);
          const st = getScoreStyle(pct);
          return (
            <li key={s.name} className="staff-item" data-band={st.cls}>
              <RingChart
                size={56}
                stroke={7}
                center={`${pct}%`}
                label={`${pct}% positive, from ${s.reviews} feedbacks`}
                segments={[{ value: pct, color: st.color, label: "positive" },
                           { value: 100 - pct, color: "transparent", label: "rest" }]}
              />
              <div className="staff-item-body">
                <button
                  type="button"
                  className="staff-name-link"
                  onClick={() => setOpen(s.name)}
                >
                  {s.name}
                </button>
                <div className="staff-counts">
                  {s.positive} positive
                  {s.mixed ? ` · ${s.mixed} neutral` : ""}
                  {` · ${s.negative} negative · ${s.reviews} relevant feedback${s.reviews === 1 ? "" : "s"}`}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
