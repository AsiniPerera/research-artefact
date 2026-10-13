import { useState } from "react";
import { StaffReviewsDrawer } from "./StaffReviewsDrawer";

/* The band the positive rate falls in, which colours the figure and the bar.
   Three bands rather than two: a row at 60% is neither good news nor bad,
   and colouring it red would say something the number does not. */
const band = (rate) => (rate >= 0.8 ? "good" : rate >= 0.5 ? "mixed" : "poor");

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
        <h3 className="staff-head">Staff mentioned in reviews</h3>
        <p className="staff-note">
          No one is named in enough reviews here. A name is listed once it
          appears in at least 3 reviews — across all salons, extraction found
          a name on about one in three.
        </p>
      </section>
    );
  }

  return (
    <section id="staff-reputation" className="staff-mentions">
      <h3 className="staff-head">Staff mentioned in reviews</h3>
      <p className="staff-note">
        Counts reflect reviews naming each person — attribution is at the
        review level, not statement level.
      </p>
      <ul className="staff-list">
        {staff.map((s) => {
          const pct = Math.round(s.positive / s.reviews * 100);
          return (
            <li key={s.name} className="staff-item" data-band={band(s.positive / s.reviews)}>
              <div className="staff-row-head">
                <button
                  type="button"
                  className="staff-name-link"
                  onClick={() => setOpen(s.name)}
                >
                  {s.name}
                </button>
                <span className="staff-rate">{pct}% positive</span>
              </div>
              {/* One fill on a track, not a split: the question a reader
                  brings here is "how often did this go well", and a single
                  length answers it at a glance where three segments ask to
                  be compared first. The counts beneath carry the detail. */}
              <div
                className="staff-bar"
                role="img"
                aria-label={`${pct}% positive, from ${s.reviews} reviews`}
              >
                <span className="staff-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="staff-counts">
                {s.positive} positive
                {s.mixed ? ` · ${s.mixed} mixed` : ""}
                {` · ${s.negative} negative · ${s.reviews} relevant review${s.reviews === 1 ? "" : "s"}`}
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
