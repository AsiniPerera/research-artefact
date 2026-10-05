import { SelectMenu } from "./SelectMenu";
import { DISTANCE_STEPS } from "../constants/taxonomy";

/* Three states, not a switch. A toggle can only say "open now" or "not
   filtering"; it has no way to ask for the opposite, and people looking for
   somewhere to book tomorrow do want the opposite. Any is the middle, and the
   default, because a filter that hides most of the results before you have
   asked for anything is the wrong first impression. */
const AVAILABILITY = [
  { value: "any",    label: "Any" },
  { value: "open",   label: "Open Now" },
  { value: "closed", label: "Closed Now" },
];

const DISTANCE_OPTIONS = DISTANCE_STEPS.map((km) => ({
  value: km,
  label: `within ${km} km`,
}));

/**
 * The three constraints you change most while reading results — who it is
 * for, how far, and whether they are open — sitting directly above them
 * rather than down the rail. All three are hard filters: they decide who is
 * eligible at all.
 *
 * Order runs widest to narrowest: client focus rules most salons out, the
 * radius fewer, availability fewest and most transiently.
 */
export function QuickFilters({ filters, onChange, onReset, isDefault = true }) {
  return (
    <div className="quick-filters">
      {/* Above the pills, on its own line. It is not a filter, so standing in
          the row with them made it read as a fourth one — and mounting only
          when something was non-default pushed every pill sideways the first
          time you touched a gender.

          Still always rendered, hidden rather than absent: the line keeps its
          height so nothing below it moves, and the control leaves the tab
          order and the accessibility tree while there is nothing to clear. */}
      {onReset && (
        <button
          type="button"
          className={`btn-text qf-clear ${isDefault ? "qf-clear--idle" : ""}`}
          onClick={onReset}
          aria-hidden={isDefault}
          tabIndex={isDefault ? -1 : 0}
        >
          Clear all
        </button>
      )}

      <div className="qf-row">
        <SelectMenu
          label="Distance"
          value={filters.maxDistance}
          options={DISTANCE_OPTIONS}
          onChange={(km) => onChange({ ...filters, maxDistance: km })}
        />

        <SelectMenu
          label="Availability"
          value={filters.availability}
          options={AVAILABILITY}
          onChange={(v) => onChange({ ...filters, availability: v })}
        />
      </div>
    </div>
  );
}
