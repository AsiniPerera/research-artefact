import { useState } from "react";

// `label` is the category's name and `tag` a one-line plain-language gloss
// shown under it; both are display only.
//
// `no` is the backend contract: ref.framework_category.category_no. The API
// takes the seven weights as a list in category_no order; toWeightList builds
// that list from `no`, never from position. Labels are the framework's own
// category names (frozen, as in the database), shown in framework order.
//
// Framework v4 has EIGHT categories, but category 8 — Overall Verdict — is
// reported only: it carries weight 0 in ref.framework_category, summarises the
// other seven, and would double-count if someone could weight it too. It is
// deliberately absent from this list, which is the weighting control. The
// verdict itself is still shown on a salon's card, from the API's own category
// scores.
export const CATEGORIES = [
  { no: 1, key: "quality_of_work",         label: "Quality of the Result",                              tag: "Good work, and it lasts." },
  { no: 2, key: "consultation_aftercare",  label: "Consultation, Care & Aftercare",                     tag: "They check first and advise after." },
  { no: 3, key: "owner_responsiveness",    label: "Management Responsiveness & Continuous Improvement", tag: "The owner answers and improves." },
  { no: 4, key: "customer_trust",          label: "Customer Trust & Recommendation",                    tag: "Customers recommend and return." },
  { no: 5, key: "staff_customer_service",  label: "Staff & Customer Service",                           tag: "Friendly, gentle, on time." },
  { no: 6, key: "value_price_honesty",     label: "Value & Price Honesty",                              tag: "Fair price, no surprises." },
  { no: 7, key: "safety_hygiene",          label: "Safety, Hygiene & Facilities",                       tag: "Clean, safe, well equipped." },
];

/** How many weights the API expects — the seven weighted categories. Kept as a
    constant rather than read off CATEGORIES.length at the call site so the
    contract is named where it is relied on. */
export const WEIGHT_COUNT = 7;

/** { key: weight } → seven weights in category_no order, as the API expects. */
export function toWeightList(weights) {
  const list = Array(WEIGHT_COUNT).fill(1);
  for (const { no, key } of CATEGORIES) list[no - 1] = weights[key] ?? 1;
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

export function WeightLevels({ weights, onChange }) {
  const [showAll, setShowAll] = useState(false);
  /* Collapsed rows are UNMOUNTED, not hidden. The weights live in the page
     above, so nothing set is lost by folding them away — and three range
     inputs left in the tree would keep taking tab stops from a control the
     visitor has put away. */
  const shown = showAll ? CATEGORIES : CATEGORIES.slice(0, PREVIEW_COUNT);

  return (
    <>
      <p className="weight-heading">How important is each to you?</p>
      <ul className="weight-list">
        {shown.map(({ key, label, tag }) => {
          const idx = indexOf(weights[key] ?? DEFAULT_LEVEL);
          const id = `w-${key}`;

          return (
            /* data-level drives the row's colour in CSS — the ramp lives in the
               stylesheet rather than as hex strings passed from here. */
            <li className="weight-row" key={key} data-level={idx + 1}>
              <div className="weight-head">
                <label id={`${id}-label`} className="weight-label">{label}</label>
                <span className="weight-tag">{tag}</span>
              </div>

              {/* Four buttons, not a drag — there are exactly four levels and
                  no value between them, so a continuous slider was asking for
                  a gesture the control could never actually use. A radio
                  group names its own stops and needs no reading of a ramp or
                  a thumb position; picking Low or Very high is one press
                  either way, nothing to drag past the others to reach. */}
              <div className="lvl-group" role="radiogroup" aria-labelledby={`${id}-label`}>
                {LEVELS.map((l, i) => (
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
