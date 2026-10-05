import { useEffect, useState } from "react";
import { API } from "../constants/api";

export function Lookup({ query }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    fetch(`${API}/salons?name=${encodeURIComponent(query)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Search failed (${r.status})`);
        return r.json();
      })
      .then((data) => { if (!cancelled) setResults(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="lookup">
      <header className="lookup-head">
        <p className="eyebrow">Search</p>
        <h1 className="lookup-title">{query}</h1>
        <p className="subtle">
          {loading
            ? "Searching the directory…"
            : `${results.length} ${results.length === 1 ? "salon" : "salons"} matching that name`}
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      {!loading && !error && results.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">Nothing found</p>
          <p>No salon in the directory matches “{query}”.</p>
        </div>
      )}

      {results.length > 0 && (
        <ul className="lookup-results">
          {results.map((s) => (
            <li key={s.id}>
              <div className="lookup-row">
                <span className="lookup-name">{s.name}</span>
                {s.division && <span className="lookup-division">{s.division}</span>}
              </div>
              <span className="lookup-rating">
                <span className="star" aria-hidden="true">★</span> {s.rating}
                <span className="lookup-count">({s.review_count})</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {results.length > 0 && (
        <p className="lookup-note">
          Star ratings are Google's, shown for reference only — never an input to our ranking.
        </p>
      )}
    </div>
  );
}
