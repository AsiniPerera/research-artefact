/* "Overall salon score": the whole salon, every category and the Overall
   Verdict together. Sits above "Feedbacks by language" on the profile's first
   tab.

   Display only. The API computes it from the extraction rows with the scorer's
   per-statement maths (backend/api/overall.py): a weighted average of the
   salon's whole-feedback category scores, weighted by the visitor's priorities,
   with the Overall Verdict at a fixed Medium weight. It is not stored and does
   not enter the ranking, where the Overall Verdict is reported only.
   Management Responsiveness is not part of it (owner replies, reported-only). */
import { useEffect, useState } from "react";
import { getOverall } from "../api/client";
import { RingChart } from "./RingChart";
import { verdictFor } from "../lib/responsiveness";
import { badgeStyle } from "../lib/scoreScale";

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
    <section className="language-mix overall-mix">
      <h3>{TITLE}</h3>
      {children}
    </section>
  );

  if (error) return shell(<p className="language-note">{error}</p>);
  if (!data) return shell(<p className="language-note">Working out the overall score…</p>);
  if (data.score == null) {
    return shell(
      <p className="language-note">
        No feedbacks to score yet, so there is nothing to show.
      </p>
    );
  }

  const value = Math.round(data.score * 100);
  const verdict = verdictFor(value);

  return shell(
    <>
      <p className="language-note">
        Every category and the overall verdict, from all of this salon&apos;s
        feedbacks across every service, weighted by your priorities. Shown for
        information; it does not change the ranking.
      </p>
      <div className="resp-body">
        <RingChart
          size={112}
          stroke={14}
          center={value}
          label={`${TITLE}: ${value} out of 100, ${verdict.word}`}
          segments={[
            { value, color: verdict.color, label: "score" },
            { value: 100 - value, color: "transparent", label: "rest" },
          ]}
        />
        <div className="resp-detail">
          <span className={`sum-verdict sum-verdict--${verdict.cls}`} style={badgeStyle(verdict)}>{verdict.word}</span>
        </div>
      </div>
    </>
  );
}
