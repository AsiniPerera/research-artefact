/* "Responsiveness and adaptability": how the business handles complaints and
   mistakes, as a ring with the parts behind it. Sits beside the staff and
   language sections on the salon profile's Summary tab.

   It is category 3 (Management Responsiveness), which is reported only: it is
   shown for information and carries no weight in the ranking. Display only. */
import { RingChart } from "./RingChart";
import { PART_LABELS, responsivenessFigure, statementMass, verdictFor } from "../lib/responsiveness";
import { badgeStyle } from "../lib/scoreScale";

const TITLE = "Responsiveness and adaptability";

export function ResponsivenessRing({ replyQuality, subPointBy, checks }) {
  const { pos, neg } = statementMass(checks, subPointBy);
  const { share, parts } = responsivenessFigure(replyQuality, pos, neg);
  const verdict = verdictFor(share);

  /* Say why the section is empty rather than dropping it: an absent section
     leaves the reader unsure whether nothing was found or the feature failed. */
  if (share == null) {
    return (
      <section className="language-mix resp-mix">
        <h3>{TITLE}</h3>
        <p className="language-note">
          No complaints, owner replies or feedbacks about management yet, so
          there is nothing to score.
        </p>
      </section>
    );
  }

  const reading = `${TITLE}: ${share} out of 100, ${verdict.word}`;

  return (
    <section className="language-mix resp-mix">
      <h3>{TITLE}</h3>
      <p className="language-note">
        How the business handles complaints and mistakes. Shown for
        information; it does not change the ranking.
      </p>
      <div className="resp-body">
        <RingChart
          size={112}
          stroke={14}
          center={share}
          label={reading}
          segments={[
            { value: share, color: verdict.color, label: "score" },
            { value: 100 - share, color: "transparent", label: "rest" },
          ]}
        />
        <div className="resp-detail">
          <span className={`sum-verdict sum-verdict--${verdict.cls}`} style={badgeStyle(verdict)}>{verdict.word}</span>
          {parts.length > 0 && (
            <ul className="resp-parts">
              {parts.map((p) => (
                <li key={p.code}>
                  <span>{PART_LABELS[p.code]}</span>
                  <strong>{p.value}%</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
