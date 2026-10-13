import { useEffect, useState } from "react";
import { getRankings } from "../api/client";

/**
 * Ranking for one sub-service, re-fetched whenever the code, weights or city
 * change. The order is the API's (score.rank_providers) and is shown as-is.
 *
 * A short debounce so dragging a slider across three stops sends one request,
 * and an abort so a slow earlier answer can never overwrite a newer one.
 */
export function useRanking(code, weights, city, status, consistencyWindow) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const key = weights.join(",");

  useEffect(() => {
    if (!code) {
      setResults(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      getRankings(code, key.split(",").map(Number), city, status, consistencyWindow, { signal: ctrl.signal })
        .then((data) => {
          console.group("[ranking] results for weights:", key);
          (data.ranked ?? []).forEach((r, i) =>
            console.log(`  #${i + 1}`, r.provider_name, "→ score:", Number(r.personal_score).toFixed(4))
          );
          console.groupEnd();
          setResults(data); setLoading(false);
        })
        .catch((e) => {
          if (e.name === "AbortError") return;
          setError(e.message);
          setLoading(false);
        });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [code, key, city, status, consistencyWindow]);

  return { results, loading, error };
}
