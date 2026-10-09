import { SelectMenu } from "./SelectMenu";
import { IconClock, IconPin } from "./Icons";
import { CITIES } from "../constants/cities";

/* Google's business status: no opening hours are held, so "Open" means
   operating and "Closed" means listed as permanently or temporarily closed —
   not open or closed at this hour. Open is the default: a closed salon is
   rarely what anyone is looking for. */
const AVAILABILITY = [
  { value: "open",   label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "any",    label: "Any" },
];

/**
 * The constraints you re-try while reading results, sitting directly above
 * them rather than down the rail. Both narrow who is listed and never change
 * how anyone scores or ranks.
 */
export function QuickFilters({
  filters,
  onChange,
  onReset,
  isDefault = true,
  includeNearby = false,
  onIncludeNearbyChange,
}) {
  const options = [
    { value: "", label: "All cities" },
    ...CITIES.map((c) => ({ value: c, label: c })),
  ];
  /* Nearby means "just outside the chosen city", so it only has meaning once
     a city is chosen — "All cities" already shows everyone. */
  const nearbyReady = Boolean(filters.city);

  return (
    <div className="quick-filters">
      {/* Always rendered, hidden rather than absent: the line keeps its height
          so nothing below it moves, and the control leaves the tab order and
          the accessibility tree while there is nothing to clear. */}
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
          label="City"
          icon={<IconPin size={14} />}
          value={filters.city}
          options={options}
          onChange={(city) => onChange({ ...filters, city })}
        />

        {/* Sits beside the city it depends on. Inert until a city is picked —
            there is no "outside" of "All cities" to be near. */}
        <label
          className="qf-field qf-toggle qf-toggle--nearby"
          aria-disabled={!nearbyReady}
          title={nearbyReady
            ? "Also show salons just outside this city, nearest first"
            : "Pick a city first to see what's nearby"}
        >
          <span className="filter-toggle-icon" aria-hidden="true"><IconPin size={14} /></span>
          <span className="qf-field-label">Nearby areas</span>
          <span className="toggle">
            <input
              type="checkbox"
              checked={nearbyReady && includeNearby}
              disabled={!nearbyReady}
              onChange={(e) => onIncludeNearbyChange?.(e.target.checked)}
            />
            <span className="toggle-track" />
          </span>
        </label>

        <SelectMenu
          label="Availability"
          icon={<IconClock size={14} />}
          value={filters.availability}
          options={AVAILABILITY}
          onChange={(availability) => onChange({ ...filters, availability })}
        />
      </div>
    </div>
  );
}
