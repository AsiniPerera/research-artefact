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
// Framework v6: nine categories. Category 8 (Overall Verdict) is never shown.
// Category 3 (Management Responsiveness) is reported only: weight 0, shown on
// profiles but not ranked. Category 9 (Service Expertise & Consistency) is
// fixed at Medium weight — computed from review data, not adjustable.
export const CATEGORIES = [
  { no: 1, key: "quality_of_work" },
  { no: 2, key: "consultation_aftercare" },
  { no: 3, key: "owner_responsiveness" },
  { no: 4, key: "customer_trust" },
  { no: 5, key: "staff_customer_service" },
  { no: 6, key: "value_price_honesty" },
  { no: 7, key: "safety_hygiene" },
  { no: 9, key: "service_expertise_consistency" },
].map((c) => ({ ...c, label: CATEGORY_INFO[c.no].name, tag: CATEGORY_INFO[c.no].description }));

/* Category 3 is reported only (weight 0) — shown on profiles but not ranked.
   Category 9 is fixed at Medium (weight 2) — it measures consistency and
   specialisation from review data and is not something a customer chooses.
   Both are excluded from the priorities panel sliders.

   CATEGORIES stays the full eight: it is what the descriptive screens read,
   and shortening it there would under-report the framework. */
const UNWEIGHTABLE = new Set([3, 9]);

/** The categories the priorities panel offers. */
export const WEIGHTABLE_CATEGORIES = CATEGORIES.filter((c) => !UNWEIGHTABLE.has(c.no));

/** How many weights the API expects — the seven weighted categories. Kept as a
    constant rather than read off CATEGORIES.length at the call site so the
    contract is named where it is relied on. */
export const WEIGHT_COUNT = 7;

/** { key: weight } → seven weights in category_no order, as the API expects.
 *
 *  The API contract is unchanged: seven numbers. A category the panel does not
 *  offer keeps the 1 it is filled with, so it still counts, at neutral. Built
 *  from WEIGHTABLE_CATEGORIES rather than CATEGORIES so a preset carrying a
 *  value for an unweightable category cannot set a weight behind the reader's
 *  back — what is not on screen cannot be silently in effect. */
export function toWeightList(weights) {
  const list = Array(WEIGHT_COUNT).fill(1);
  for (const { no, key } of WEIGHTABLE_CATEGORIES) list[no - 1] = weights[key] ?? 1;
  return list;
}

/* Four levels that double. Doubling is what makes the scale mean something:
   each step is worth exactly two of the one below, so "Very high" counts
   eight Lows.

   The slider runs on the INDEX (0–3), not the value — the stops sit at even
   distances while the weights behind them double, which is why a plain
   min/max range over 1–8 would bunch the first three stops together. */
export const LEVELS = [
  { value: 1, label: "Low",       lvl: "poor"      },
  { value: 2, label: "Medium",    lvl: "fair"      },
  { value: 4, label: "High",      lvl: "good"      },
  { value: 8, label: "Very high", lvl: "excellent" },
];

/* Exported so the About page can describe the real seven rather than keeping
   its own copy — it had drifted to a stale six, which is exactly what a
   second hand-maintained list does. */

/** Every key that carries a weight — all seven. Kept as its own export so a
    caller never has to derive it from CATEGORIES, and so reintroducing an
    exception later is a change in one place. */
export const WEIGHTED_KEYS = CATEGORIES.map((c) => c.key);

/* Four, then the rest. Seven categories in a 340px rail is still a column of
   sliders taller than the viewport, and the first thing the page asks of
   someone becomes a scroll. Four is enough to show what the control IS —
   a label, a track, a named level — and to make clear there are more. */
const PREVIEW_COUNT = 4;

const DEFAULT_LEVEL = 2;

const indexOf = (value) => {
  const i = LEVELS.findIndex((l) => l.value === value);
  return i === -1 ? LEVELS.findIndex((l) => l.value === DEFAULT_LEVEL) : i;
};

export const CONSISTENCY_WINDOWS = [
  { value: "6m", label: "6 months", lvl: "poor" },
  { value: "1y", label: "1 year", lvl: "fair" },
  { value: "3y", label: "3 years", lvl: "good" },
  { value: "anytime", label: "Anytime", lvl: "excellent" },
];
export const DEFAULT_CONSISTENCY_WINDOW = "1y";

/* Panel order: the categories the user can weight, plus Category 9 which shows
   the window selector (6m / 1y / 3y / Anytime) instead of importance buttons.
   Category 9 is in CATEGORIES (for profiles) and UNWEIGHTABLE (no importance
   slider), so it needs its own lookup against CATEGORIES. */
const CAT9_ROW = CATEGORIES.find((c) => c.no === 9);
const PANEL_ORDER = [1, 9, 7, 2, 5, 6, 4];

export function WeightLevels({ weights, onChange, consistencyWindow, onConsistencyWindowChange }) {
  const [showAll, setShowAll] = useState(true);
  /* Collapsed rows are UNMOUNTED, not hidden. The weights live in the page
     above, so nothing set is lost by folding them away — and three range
     inputs left in the tree would keep taking tab stops from a control the
     visitor has put away. */
  const rows = PANEL_ORDER
    .map((k) => {
      if (k === 9) return (CAT9_ROW && onConsistencyWindowChange)
        ? { ...CAT9_ROW, isWindow: true } : null;
      return WEIGHTABLE_CATEGORIES.find((c) => c.no === k);
    })
    .filter(Boolean);
  const shown = showAll ? rows : rows.slice(0, PREVIEW_COUNT);

  return (
    <>
      <p className="weight-heading">How important is each to you?</p>
      <ul className="weight-list">
        {shown.map((row) => {
          const { key, label, tag, isWindow } = row;
          const options = isWindow ? CONSISTENCY_WINDOWS : LEVELS;
          const idx = isWindow
            ? Math.max(0, CONSISTENCY_WINDOWS.findIndex((w) => w.value === consistencyWindow))
            : indexOf(weights[key] ?? DEFAULT_LEVEL);
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
                    onClick={() => (isWindow
                      ? onConsistencyWindowChange(l.value)
                      : onChange({ ...weights, [key]: l.value }))}
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
