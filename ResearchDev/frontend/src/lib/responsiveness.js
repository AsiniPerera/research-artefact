/* Category 3 — Management Responsiveness — as one figure for the salon profile.

   Category 3 is reported only: it has no weight in the ranking. Its headline
   figure is the mean of whichever of its five parts have evidence, the same
   arithmetic the profile's category-3 card has always used. It lives here, as
   a pure function, so the card's verdict word and the ring in the
   "Responsiveness and adaptability" section are computed once and cannot
   disagree.

   Parts (sub-points), each 0..1 when there is evidence for it:
     3.1  share of complaints the owner replied to
     3.2  how specific the replies were (a partly-specific reply counts half)
     3.3  stance toward the complaint, blended with whether a remedy was offered
     3.4  share of tested promises that were kept
     3.5  positive share of customers' accounts of how a problem was put right
          (a free redo or refund is positive; mixed = half)
*/

import { getScoreStyle } from "./scoreScale";

export const PART_LABELS = {
  "3.1": "Replies to complaints",
  "3.2": "Replies address the concern",
  "3.3": "Takes responsibility",
  "3.4": "Follows through on commitments",
  "3.5": "Puts things right when it goes wrong",
};

/** The verdict for a 0..100 figure, from the site-wide score scale, or null
 *  when there is none. */
export function verdictFor(share) {
  const s = getScoreStyle(share);
  return s && { word: s.label, cls: s.cls, color: s.color, ink: s.ink };
}

/** Positive / negative statement mass for part 3.5 only (3.1-3.4 come from
 *  owner replies, not from statements). A mixed statement is half and half. */
export function statementMass(checks, subPointBy) {
  let pos = 0;
  let neg = 0;
  for (const c of checks ?? []) {
    if (c.code !== "3.5") continue;
    const n = subPointBy?.[c.code];
    pos += (n?.positive ?? 0) + 0.5 * (n?.mixed ?? 0);
    neg += (n?.negative ?? 0) + 0.5 * (n?.mixed ?? 0);
  }
  return { pos, neg };
}

/**
 * @param rq        the reply-quality block (or null while it is not loaded)
 * @param totalPos  positive mass for 3.5
 * @param totalNeg  negative mass for 3.5
 * @returns { share, parts }  share is 0..100 or null; parts lists the parts
 *          that had evidence, each { code, label, value } with value 0..100.
 *          Without reply-quality data the figure falls back to the statement
 *          share alone and `parts` is empty.
 */
export function responsivenessFigure(rq, totalPos, totalNeg) {
  const total = Math.round(totalPos + totalNeg);
  const posShare = total ? Math.round((totalPos / (totalPos + totalNeg)) * 100) : null;
  if (!rq) return { share: posShare, parts: [] };

  const sp = rq.specificity ?? {};
  const st = rq.stance ?? {};
  const pr = rq.promises ?? {};
  const nSpec = (sp.specific ?? 0) + (sp.partly ?? 0) + (sp.generic ?? 0);
  const nSt = (st.accepts ?? 0) + (st.mixed ?? 0) + (st.disputes ?? 0) + (st.neither ?? 0);
  const tested = (pr.kept ?? 0) + (pr.broken ?? 0);

  const raw = [
    ["3.1", rq.complaints > 0 ? rq.complaints_replied / rq.complaints : null],
    ["3.2", nSpec ? ((sp.specific ?? 0) + 0.5 * (sp.partly ?? 0)) / nSpec : null],
    ["3.3", nSt
      ? (((st.accepts ?? 0) + 0.75 * (st.mixed ?? 0) + 0.5 * (st.disputes ?? 0)
          + 0.25 * (st.neither ?? 0)) / nSt + Math.min(1, (rq.remedy ?? 0) / nSt)) / 2
      : null],
    ["3.4", tested ? (pr.kept ?? 0) / tested : null],
    ["3.5", total ? totalPos / (totalPos + totalNeg) : null],
  ].filter(([, v]) => v != null);

  return {
    share: raw.length ? Math.round((raw.reduce((a, [, v]) => a + v, 0) / raw.length) * 100) : null,
    parts: raw.map(([code, v]) => ({ code, label: PART_LABELS[code], value: Math.round(v * 100) })),
  };
}
