/* The search screen reached from the header's name search (App.jsx). Looks up
   providers by name, independent of the ranking flow — no service, city or
   weights involved, just a name match. */
import { useEffect, useState } from "react";
import { searchProviders } from "../api/client";

export function Lookup({ query, onSelectSalon }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query) return undefined;
    const ctrl = new AbortController();

    setLoading(true);
    setError(null);
    searchProviders(query, { signal: ctrl.signal })
      .then((data) => { setResults(Array.isArray(data) ? data : data.providers ?? []); setLoading(false); })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });

    return () => ctrl.abort();
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
            <li key={s.place_id}>
              <div className="lookup-row">
                <button type="button" className="lookup-name" onClick={() => onSelectSalon?.(s.place_id)}>
                  {s.name ?? s.provider_name}
                </button>
                {s.city && <span className="lookup-division">{s.city}</span>}
              </div>
              {s.google_rating != null && (
                <span className="lookup-rating">
                  <span className="star" aria-hidden="true">★</span> {s.google_rating}
                  <span className="lookup-count">({s.google_review_count})</span>
                </span>
              )}
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
