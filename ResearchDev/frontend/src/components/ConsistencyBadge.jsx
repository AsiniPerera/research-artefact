const LABELS = {
  consistent_results: "Consistent results",
  mostly_consistent: "Mostly consistent",
  variable_results: "Variable results",
  not_enough_evidence: "Not enough evidence",
};

/** Service Expertise Consistency: a display badge, never part of the score. */
export function ConsistencyBadge({ c }) {
  if (!c) return null;
  return (
    <span className="consistency">
      <span className={`badge badge--consistency-${c.badge}`}>{LABELS[c.badge]}</span>
      <span className="consistency-note">{c.review_count} reviews {c.window_label}</span>
    </span>
  );
}
