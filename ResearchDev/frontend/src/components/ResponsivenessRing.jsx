/* "Putting things right": what happens after a complaint. Sits beside the
   staff card on the salon profile's Summary tab.

   It is category 3 (Management Responsiveness), which is reported only: it is
   shown for information and carries no weight in the ranking. Display only.

   The figures are measured against the complaints only — the feedbacks that
   raised something — never against every feedback. A salon with 2 complaints
   and 2 replies is answering everyone; one with 2 replies out of 200 is not,
   and dividing by the whole set would hide the difference. */
import { responsivenessFigure, statementMass } from "../lib/responsiveness";

const TITLE = "Putting things right";

export function ResponsivenessRing({ replyQuality, subPointBy, checks }) {
  const { pos, neg } = statementMass(checks, subPointBy);
  const { share } = responsivenessFigure(replyQuality, pos, neg);
  const rq = replyQuality ?? {};
  const complaints = rq.complaints ?? 0;
  const replied = rq.complaints_replied ?? 0;
  /* 3.5 is "put it right afterwards": the positive statement mass against the
     complaints that raised it. */
  const putRight = Math.round(pos);

  /* Say why the section is empty rather than dropping it: an absent section
     leaves the reader unsure whether nothing was found or the feature failed. */
  if (share == null && complaints === 0) {
    return (
      <section className="evcard">
        <h3 className="evcard-head">{TITLE}</h3>
        <p className="evcard-note">
          No complaints, owner replies or feedbacks about management yet, so
          there is nothing to report.
        </p>
      </section>
    );
  }

  const rows = [
    { label: "Replied to the complaint", n: replied, of: complaints },
    { label: "Put it right afterwards", n: putRight, of: complaints },
  ];

  return (
    <section className="evcard">
      <div className="evcard-top">
        <h3 className="evcard-head">{TITLE}</h3>
        <span className="evcard-tag">Not in your ranking</span>
      </div>
      <p className="evcard-note">
        What happens after a complaint — measured only against the feedbacks
        that raised one.
      </p>

      {complaints > 0 && replied === 0 && (
        <p className="evcard-alert" role="status">
          <b>{complaints} complaint{complaints === 1 ? "" : "s"}, none answered.</b>{" "}
          No public reply and no sign of a fix.
        </p>
      )}

      <ul className="evbars">
        {rows.map((r) => {
          const pct = r.of > 0 ? Math.round((r.n / r.of) * 100) : 0;
          return (
            <li key={r.label} className="evbars-row">
              <span className="evbars-label">{r.label}</span>
              <span className="evbars-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="evbars-n">
                {r.of > 0 ? <>{r.n} of<br />{r.of}</> : "—"}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="evcard-foot">
        A salon with no complaints at all would show “—” here, not a zero.
      </p>
    </section>
  );
}
