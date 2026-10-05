import { useState } from "react";

// Keys are the backend contract — only the plain-language labels and the
// short identifiers beside them change. The `tag` is deliberately two or
// three words: it has to sit on the same line as the label without pushing
// the row to two.
//
// All ten are weighted. Customer Trust & Recommendation was held out as
// validation-only and shown without a slider; it ranks like the rest now, so
// there is no exception left in this list.
export const CATEGORIES = [
  { key: "service_fulfillment_quality", label: "Service Fulfillment Quality", tag: "did the work deliver" },
  { key: "service_quality_trend",       label: "Quality Trend & Consistency", tag: "same standard each visit" },
  { key: "consultation_aftercare",      label: "Consultation & Aftercare",    tag: "advice before & after" },
  { key: "service_durability",          label: "Service Durability",          tag: "how long it lasts" },
  { key: "external_service_recovery",   label: "Service Recovery & Repair", tag: "fixing others' work" },
  { key: "staff_customer_experience",   label: "Staff & Customer Experience", tag: "the people" },
  { key: "owner_responsiveness",        label: "Owner Responsiveness",        tag: "listens & improves" },
  { key: "customer_trust_recommendation", label: "Customer Trust & Recommendation", tag: "repeat & referral" },
  { key: "perceived_value_for_money",   label: "Perceived Value for Money",   tag: "what it costs" },
  { key: "hygiene_safety",              label: "Hygiene & Safety",            tag: "clean & safe" },
];

/* Four levels that double. Doubling is what makes the scale mean something:
   each step is worth exactly two of the one below, so "Very high" counts
   eight Lows.

   The slider runs on the INDEX (0–3), not the value — the stops sit at even
   distances while the weights behind them double, which is why a plain
   min/max range over 1–8 would bunch the first three stops together. */
export const LEVELS = [
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 4, label: "High" },
  { value: 8, label: "Very high" },
];

/* Exported so the About page can describe the real ten rather than keeping
   its own copy — it had drifted to a stale six, which is exactly what a
   second hand-maintained list does. */

/** Every key that carries a weight — all ten. Kept as its own export so a
    caller never has to derive it from CATEGORIES, and so reintroducing an
    exception later is a change in one place. */
export const WEIGHTED_KEYS = CATEGORIES.map((c) => c.key);

/* Four, then the rest. Ten categories in a 340px rail is a column of
   sliders taller than the viewport, and the first thing the page asks of
   someone becomes a scroll. Four is enough to show what the control IS —
   a label, a track, a named level — and to make clear there are more. */
const PREVIEW_COUNT = 4;

const DEFAULT_LEVEL = 2;
const LAST = LEVELS.length - 1;

const indexOf = (value) => {
  const i = LEVELS.findIndex((l) => l.value === value);
  return i === -1 ? LEVELS.findIndex((l) => l.value === DEFAULT_LEVEL) : i;
};

/** How far along the track the thumb sits, 0–1. A native range fills nothing
    by default and reports no progress to CSS, so the stylesheet paints the
    fill from this. The colours are the row's, set per level in CSS. */
function trackPos(idx) {
  return { "--pos": String(idx / LAST) };
}

export function WeightLevels({ weights, onChange }) {
  const [showAll, setShowAll] = useState(false);
  /* Collapsed rows are UNMOUNTED, not hidden. The weights live in the page
     above, so nothing set is lost by folding them away — and six range
     inputs left in the tree would keep taking tab stops from a control the
     visitor has put away. */
  const shown = showAll ? CATEGORIES : CATEGORIES.slice(0, PREVIEW_COUNT);

  return (
    <>
      <ul className="weight-list">
        {shown.map(({ key, label, tag }) => {
          const idx = indexOf(weights[key] ?? DEFAULT_LEVEL);
          const level = LEVELS[idx];
          const id = `w-${key}`;

          return (
            /* data-level drives the row's colour in CSS — the ramp lives in the
               stylesheet rather than as hex strings passed from here. */
            <li className="weight-row" key={key} data-level={idx + 1}>
              <div className="weight-head">
                <label className="weight-label" htmlFor={id}>{label}</label>
                <span className="weight-tag">{tag}</span>
              </div>

              <div className="lvl">
                <input
                  id={id}
                  type="range"
                  min={0}
                  max={LAST}
                  step={1}
                  value={idx}
                  style={trackPos(idx)}
                  aria-valuetext={`${level.label} — counts ${level.value}× a Low`}
                  onChange={(e) =>
                    onChange({ ...weights, [key]: LEVELS[Number(e.target.value)].value })
                  }
                />

                {/* The scale names itself, so there is no read-out to put at
                    the end of the row. aria-hidden because the input already
                    announces the same thing through aria-valuetext. */}
                <span className="lvl-scale" aria-hidden="true">
                  {LEVELS.map((l, i) => (
                    <i key={l.value} className={i === idx ? "is-on" : ""}>{l.label}</i>
                  ))}
                </span>
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
