/* The services mega menu, opened from Explore in the top nav. */
import { useState } from "react";
import { DOMAINS, groupsFor } from "../constants/taxonomy";

/**
 * The four categories as a row, and the services of whichever one is being
 * read beneath it.
 *
 * A category tab only switches what the panel shows; hovering it must not
 * pick. Any of the three levels can be ranked, each by its own click: "Rank
 * all of Hair" for the whole category, a group heading (Haircuts) for a
 * service, or a leaf (Haircut & Trim) for one sub-service.
 *
 * It reports a pick rather than performing one — onPick(family, leafValue,
 * groupId) — so the caller decides whether that routes or sets a filter.
 * Opening, closing and placement belong to the caller too: this is the panel
 * and nothing else.
 */
export function ServicesMegaPanel({ activeFamily, activeSub, activeGroup, onPick, ...rest }) {
  /* Opens on the category being ranked, so the panel starts where the reader
     already is. The panel unmounts when it closes, so this re-reads on every
     open rather than going stale. */
  const [shown, setShown] = useState(
    () => (DOMAINS.some((d) => d.value === activeFamily) ? activeFamily : DOMAINS[0].value),
  );
  const groups = groupsFor(shown);
  const shownDomain = DOMAINS.find((d) => d.value === shown);

  return (
    <div className="svcmega" {...rest}>
      <div className="svcmega-bar">
        <span className="svcmega-label">Services</span>
        <ul className="svcmega-tabs">
          {DOMAINS.map(({ id, value, label }) => (
            <li key={id}>
              <button
                type="button"
                className={`svcmega-tab ${shown === value ? "is-shown" : ""} ${
                  activeFamily === value ? "is-active" : ""
                }`}
                aria-pressed={shown === value}
                onMouseEnter={() => setShown(value)}
                onFocus={() => setShown(value)}
                onClick={() => setShown(value)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Rank the whole category at once. Passed as the category code in the
          group slot (e.g. "HR"); Rankings reads a dot-free code there as a
          whole-category pick. */}
      {shownDomain && (
        <button
          type="button"
          className={`svcmega-all ${activeGroup === shownDomain.id ? "is-on" : ""}`}
          aria-current={activeGroup === shownDomain.id ? "true" : undefined}
          onClick={() => onPick(shown, null, shownDomain.id)}
        >
          All {shownDomain.label}
        </button>
      )}

      <div className="svcmega-groups">
        {groups.map((group) => (
          <div className="svcmega-group" key={group.id}>
            {/* The heading is pickable: choosing a group means "any service
                under this one", which is a real thing to want and is
                otherwise unreachable. */}
            <button
              type="button"
              className={`svcmega-grouphead ${activeGroup === group.id ? "is-on" : ""}`}
              onClick={() => onPick(shown, null, group.id)}
            >
              {group.label}
            </button>
            <ul>
              {group.leaves.map((leaf) => (
                <li key={leaf.value}>
                  <button
                    type="button"
                    className={activeSub === leaf.value ? "is-on" : ""}
                    aria-current={activeSub === leaf.value ? "true" : undefined}
                    onClick={() => onPick(shown, leaf.value)}
                  >
                    {leaf.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
