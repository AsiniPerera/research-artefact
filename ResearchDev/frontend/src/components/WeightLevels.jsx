/* The priorities panel (rendered in Rankings.jsx) plus the shared constants
   other screens read from it: CATEGORIES (About.jsx's category list) and
   toWeightList (the API call). The review-period control lives in
   QuickFilters.jsx now -- it narrows which reviews are read, it is not a
   priority to weigh. */
import { useState } from "react";
import { CATEGORY_INFO } from "../constants/categories";

// `label` is the category's name and `tag` a one-line plain-language gloss
// shown under it; both are display only.
//
// `no` is the backend contract: ref.framework_category.category_no. The API
// takes the seven weights as a list in category_no order; toWeightList builds
// that list from `no`, never from position. Labels and tags come from
// constants/categories.js, so every screen uses the same wording.
//
// Seven categories here, one short of the framework's nine: Category 8
// (Overall Verdict) is never shown, and Category 9 (Service Expertise &
// Consistency) has no category entry at all any more -- see
// constants/categories.js for why. Category 3 (Management Responsiveness)
// is reported only: weight 0, shown on profiles but not ranked.
export const CATEGORIES = [
  { no: 1, key: "quality_of_work" },
  { no: 2, key: "consultation_aftercare" },
  { no: 3, key: "owner_responsiveness" },
  { no: 4, key: "customer_trust" },
  { no: 5, key: "staff_customer_service" },
  { no: 6, key: "value_price_honesty" },
  { no: 7, key: "safety_hygiene" },
].map((c) => ({ ...c, label: CATEGORY_INFO[c.no].name, tag: CATEGORY_INFO[c.no].description }));

/* Category 3 is reported only (weight 0) — shown on profiles but not
   ranked, so it has no importance slider in this panel.

   CATEGORIES stays the full seven: it is what the descriptive screens read,
   and shortening it there would under-report the framework. */
const UNWEIGHTABLE = new Set([3]);

/** The categories the priorities panel offers. */
const WEIGHTABLE_CATEGORIES = CATEGORIES.filter((c) => !UNWEIGHTABLE.has(c.no));

/** How many weights the API expects — the seven weighted categories. Kept as a
    constant rather than read off CATEGORIES.length at the call site so the
    contract is named where it is relied on. */
const WEIGHT_COUNT = 7;

/** The level a category sits at until the reader moves it: Medium. */
const DEFAULT_LEVEL = 2;

/** { key: weight } → seven weights in category_no order, as the API expects.
 *
 *  The API contract is seven numbers. Built from WEIGHTABLE_CATEGORIES rather
 *  than CATEGORIES so a preset carrying a value for an unweightable category
 *  cannot set a weight behind the reader's back — what is not on screen cannot
 *  be silently in effect.
 *
 *  Anything the panel does not set falls to DEFAULT_LEVEL, which is the same
 *  value the panel displays for an untouched row and the same value
 *  rank_providers substitutes for a missing weight. All three have to agree,
 *  or the ranking is computed from numbers the reader was never shown. */
export function toWeightList(weights) {
  const list = Array(WEIGHT_COUNT).fill(DEFAULT_LEVEL);
  for (const { no, key } of WEIGHTABLE_CATEGORIES) {
    list[no - 1] = weights[key] ?? DEFAULT_LEVEL;
  }
  return list;
}

/* Four levels that double. Doubling is what makes the scale mean something:
   each step is worth exactly two of the one below, so "Very high" counts
   eight Lows.

   The slider runs on the INDEX (0–3), not the value — the stops sit at even
   distances while the weights behind them double, which is why a plain
   min/max range over 1–8 would bunch the first three stops together. */
const LEVELS = [
  { value: 1, label: "Low",       lvl: "poor"      },
  { value: 2, label: "Medium",    lvl: "fair"      },
  { value: 4, label: "High",      lvl: "good"      },
  { value: 8, label: "Very high", lvl: "excellent" },
];

/* Four, then the rest. Seven categories in a 340px rail is still a column of
   sliders taller than the viewport, and the first thing the page asks of
   someone becomes a scroll. Four is enough to show what the control IS —
   a label, a track, a named level — and to make clear there are more. */
const PREVIEW_COUNT = 4;

const indexOf = (value) => {
  const i = LEVELS.findIndex((l) => l.value === value);
  return i === -1 ? LEVELS.findIndex((l) => l.value === DEFAULT_LEVEL) : i;
};

/* Panel order: the six categories the user can weight. The review-period
   control used to have its own slot here (it was a stand-in for Category
   9's row before that); it now lives in QuickFilters, beside the other
   query constraints (city, availability) it belongs with — it narrows which
   reviews are read, it is not a priority to weigh. */
const PANEL_ORDER = [1, 7, 2, 5, 6, 4];

export function WeightLevels({ weights, onChange }) {
  const [showAll, setShowAll] = useState(true);
  /* Collapsed rows are UNMOUNTED, not hidden. The weights live in the page
     above, so nothing set is lost by folding them away — and three range
     inputs left in the tree would keep taking tab stops from a control the
     visitor has put away. */
  const rows = PANEL_ORDER.map((no) => WEIGHTABLE_CATEGORIES.find((c) => c.no === no)).filter(Boolean);
  const shown = showAll ? rows : rows.slice(0, PREVIEW_COUNT);

  return (
    <>
      <p className="weight-heading">How important is each to you?</p>
      <ul className="weight-list">
        {shown.map((row) => {
          const { key, label, tag } = row;
          const options = LEVELS;
          const idx = indexOf(weights[key] ?? DEFAULT_LEVEL);
          const id = `w-${key}`;

          return (
            <li className="weight-row" key={key} data-level={idx + 1}>
              <div className="weight-head">
                <label id={`${id}-label`} className="weight-label">{label}</label>
                <span className="weight-tag">{tag}</span>
              </div>

              <div className="lvl-group" role="radiogroup" aria-labelledby={`${id}-label`}>
                {options.map((l, i) => (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={i === idx}
                    className={`lvl-opt ${i === idx ? "is-on" : ""}`}
                    data-lvl={l.lvl}
                    onClick={() => onChange({ ...weights, [key]: l.value })}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="weight-more"
        aria-expanded={showAll}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? "Show less" : "Show more"}
      </button>
    </>
  );
}
