/** What this business is most reviewed for. Display only, never scored. */
export function PopularServicesBadge({ data }) {
  if (!data?.badge) return null;
  return <span className="chip chip-popular-services">{data.badge}</span>;
}
