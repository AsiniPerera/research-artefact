/* One score scale for the whole site: list cards, profile rings, badges and
   staff. `color` paints rings, bars and badge borders; `ink` is the same hue
   dark enough to pass 4.5:1 as text on white. `cls` is a stable class hook. */
export const SCORE_SCALE = [
  { min: 85, label: "Excellent", cls: "excellent", color: "#16a34a", ink: "#15803d" },
  { min: 70, label: "Great",     cls: "great",     color: "#ca8a04", ink: "#a16207" },
  { min: 50, label: "Good",      cls: "good",      color: "#ea580c", ink: "#c2410c" },
  { min: 30, label: "Fair",      cls: "fair",      color: "#dc2626", ink: "#dc2626" },
  { min: 0,  label: "Weak",      cls: "weak",      color: "#991b1b", ink: "#991b1b" },
];

/** 0–100 score → { label, color, ink, cls }; null when there is no score. */
export function getScoreStyle(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  const v = Math.round(Number(score));
  return SCORE_SCALE.find((b) => v >= b.min);
}

/** Inline style for a verdict word: the band's readable ink, nothing else.
 *  A verdict used to be a bordered chip with a tinted fill; it is now the word
 *  alone in its band colour, the same way the ranked list shows one.
 *  Passed as a custom property because the rules in theme.css are !important;
 *  a rule there reads it (search "--verdict-ink"). */
export const verdictInk = (s) => s && ({ "--verdict-ink": s.ink });
