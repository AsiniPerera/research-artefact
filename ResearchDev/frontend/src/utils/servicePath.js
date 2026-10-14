/* Used by Results.jsx for the breadcrumb above the ranked list. */
import {
  GROUPS, GROUP_BY_ID, LEAF_LABELS, SERVICE_FAMILIES,
} from "../constants/taxonomy";

const DOMAIN_LABEL = Object.fromEntries(
  SERVICE_FAMILIES.map(({ value, label }) => [value, label])
);

/**
 * Domain › Group › Service for whatever is currently chosen.
 *
 * A service is picked inside a flyout that closes straight after, so without
 * this the choice leaves no trace in the rail. Returned only when something
 * below the domain is set — a lone "Hair" would just repeat the row already
 * highlighted underneath it.
 */
export function servicePath(filters) {
  const { serviceFamily, subGroup, subService } = filters;
  if (!subGroup && !subService) return null;

  const crumbs = [{ label: DOMAIN_LABEL[serviceFamily] }];

  if (subGroup) {
    crumbs.push({ label: GROUP_BY_ID[subGroup]?.label });
  } else {
    const group = (GROUPS[serviceFamily] ?? []).find((g) =>
      g.leaves.some((l) => l.value === subService)
    );
    if (group) crumbs.push({ label: group.label, groupId: group.id });
    crumbs.push({ label: LEAF_LABELS[subService] });
  }

  return crumbs.filter((c) => c.label);
}
