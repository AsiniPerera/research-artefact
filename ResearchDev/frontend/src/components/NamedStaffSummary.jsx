/** Who this business's reviews name, in one line. Display only. */
export function NamedStaffSummary({ data }) {
  const count = data?.count ?? 0;
  const top = data?.top ?? [];
  /* An empty `top` with a count above zero would render a bare label. */
  if (count === 0 || top.length === 0) return null;

  return (
    <div className="named-staff-summary">
      <span>Named staff: {top.join(", ")}</span>
      {count > top.length && <span className="muted">+{count - top.length} more</span>}
    </div>
  );
}
