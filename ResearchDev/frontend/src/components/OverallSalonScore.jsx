/* "Overall salon score": the whole salon, every category and the Overall
   Verdict together. Opens the profile's Summary tab.

   Display only. The API computes it from the extraction rows with the scorer's
   per-statement maths (backend/api/overall.py): a weighted average of the
   salon's whole-feedback category scores, weighted by the visitor's priorities,
   with the Overall Verdict at a fixed Medium weight. It is not stored and does
   not enter the ranking, where the Overall Verdict is reported only.
   Management Responsiveness is not part of it (owner replies, reported-only). */
import { useEffect, useState } from "react";
import { getOverall } from "../api/client";
import { verdictFor } from "../lib/responsiveness";

const TITLE = "Overall salon score";

export function OverallSalonScore({ placeId, window = "anytime", weights = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const key = weights ? weights.join(",") : "";

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError(null);
    getOverall(placeId, { weights, window }, { signal: ctrl.signal })
      .then(setData)
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => ctrl.abort();
  }, [placeId, window, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const shell = (children) => (
    <div className="evsum-score">
      <p className="evsum-label">{TITLE}</p>
      {children}
    </div>
  );

  if (error) return shell(<p className="evsum-note">{error}</p>);
  if (!data) return shell(<p className="evsum-note">Working out the overall score…</p>);
  if (data.score == null) {
    return shell(<p className="evsum-note">No feedbacks to score yet, so there is nothing to show.</p>);
  }

  const value = Math.round(data.score * 100);
  const verdict = verdictFor(value);

  return shell(
    <>
      <p className="evsum-figure">
        <span className="evsum-num" style={{ color: verdict.ink }}>{value}</span>
        <span className="evsum-word" style={{ color: verdict.ink }}>{verdict.word}</span>
      </p>

      {/* The score on its own 0-100 scale, with the neutral midpoint marked:
          a number alone does not say how far from neutral it sits. */}
      <div className="evsum-scale">
        <span
          className="evsum-scale-track"
          role="img"
          aria-label={`${value} out of 100, ${verdict.word}. 50 is neutral.`}
        >
          <span className="evsum-scale-fill" style={{ width: `${value}%`, background: verdict.color }} />
          <span className="evsum-scale-mid" />
          <span className="evsum-scale-mark" style={{ left: `${value}%`, background: verdict.ink }} />
        </span>
        <span className="evsum-scale-ends" aria-hidden="true">
          <span>0</span><span className="evsum-scale-neutral">50 · neutral</span><span>100</span>
        </span>
      </div>

      <p className="evsum-note">
        Every category, weighted by the priorities you set. Shown for information
        — it does not change the ranking.
      </p>
    </>
  );
}
