import { useState, useCallback } from "react";
import { API } from "../constants/api";

export function useRanking() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rank = useCallback(async (request) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, rank };
}
