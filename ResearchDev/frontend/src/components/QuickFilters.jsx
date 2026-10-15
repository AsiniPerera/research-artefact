/* Rendered by Rankings.jsx above the Results list. */
import { SelectMenu } from "./SelectMenu";
import { IconCalendar, IconClock, IconPin, IconUser } from "./Icons";
import { AUDIENCE, AUDIENCE_OPTIONS } from "../constants/audience";
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

/* How far back reviews are read from, for every category score and the
   specialism indicator alike (06_run_scoring.py section 4) -- a query
   constraint like city or availability, not a priority to weigh, which is
   why it sits here rather than in the priorities rail. "anytime" is this
   app's name for it; the API accepts it directly and stores it as "all"
   (see backend/api/main.py's _window). */
export const CONSISTENCY_WINDOWS = [
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "3y", label: "3 years" },
  { value: "anytime", label: "All time" },
];
export const DEFAULT_CONSISTENCY_WINDOW = "anytime";

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
  consistencyWindow = DEFAULT_CONSISTENCY_WINDOW,
  onConsistencyWindowChange,
  audience = "",
  onAudienceChange,
}) {
  const options = [
    { value: "", label: "All cities" },
    ...CITIES.map((c) => ({ value: c, label: c })),
  ];

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
        {/* Who the salon is for: the first filter. It hides salons on screen at
            once and never changes a score or a rank. */}
        {onAudienceChange && (
          <SelectMenu
            label="For"
            icon={<IconUser size={14} />}
            value={audience}
            options={AUDIENCE_OPTIONS}
            display={AUDIENCE[audience]?.label ?? "Everyone"}
            onChange={onAudienceChange}
          />
        )}

        <SelectMenu
          label="City"
          icon={<IconPin size={14} />}
          value={filters.city}
          options={options}
          onChange={(city) => onChange({ ...filters, city })}
        />

        <SelectMenu
          label="Availability"
          icon={<IconClock size={14} />}
          value={filters.availability}
          options={AVAILABILITY}
          onChange={(availability) => onChange({ ...filters, availability })}
        />

        {/* Only reviews published inside this period count toward any score —
            every category, the final ranking and the specialism indicator
            alike. Sits beside the other query constraints, not in the
            priorities rail: it narrows which feedbacks are read, it is not a
            priority to weigh. */}
        {onConsistencyWindowChange && (
          <SelectMenu
            label="Feedbacks from"
            icon={<IconCalendar size={14} />}
            value={consistencyWindow}
            options={CONSISTENCY_WINDOWS}
            onChange={onConsistencyWindowChange}
          />
        )}
      </div>
    </div>
  );
}
