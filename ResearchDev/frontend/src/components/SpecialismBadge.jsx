/** The one service this business is most reviewed for, among the services it
    offers (Category 9's 9.2). Display only, never scored or ranked. */
export function SpecialismBadge({ data }) {
  if (!data?.badge) return null;
  return <span className="chip chip-specialism">{data.badge}</span>;
}
