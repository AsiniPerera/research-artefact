/** "Who serves you matters": the named staff at this business are spoken
 *  about differently from one another. Display only, never scored.
 *
 *  On the profile it links to the staff list, so the claim is one click from
 *  the evidence behind it. On a card there is no list to link to, so it is
 *  plain text rather than a link that would go nowhere.
 */
export function StaffDependentChip({ show, linkTo }) {
  if (!show) return null;

  const label = "Who serves you matters";
  const title = "Who serves you varies — read the staff list";

  if (!linkTo) {
    return <span className="chip chip-staff-dependent" title={title}>{label}</span>;
  }
  return (
    <a href={linkTo} className="chip chip-staff-dependent" title={title}>
      {label}
    </a>
  );
}
