import { useState, useEffect } from "react";
import { SalonCard } from "../components/SalonCard";
import { MapView } from "../components/MapView";
import { servicePath } from "../utils/servicePath";

const PER_PAGE = 6;

export function Results({ filters, data, loading, error, userLat, userLng, maxDistanceKm, onSelectSalon }) {
  const [page, setPage] = useState(1);

  // A fresh ranking is a fresh list — never strand the user on a page that no longer exists.
  useEffect(() => { setPage(1); }, [data]);

  // A skeleton in the shape of the real grid — the page doesn't jump when
  // results land, and the wait reads as progress rather than a stall.
  if (loading) {
    return (
      <div className="salon-grid" aria-busy="true" aria-label="Ranking salons">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton-card" key={i}>
            <div className="skeleton skeleton-thumb" />
            <div className="skeleton skeleton-line skeleton-line--title" />
            <div className="skeleton skeleton-line skeleton-line--meta" />
            <div className="skeleton skeleton-line skeleton-line--body" />
          </div>
        ))}
      </div>
    );
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) {
    return (
      <div className="empty-state empty-state--ready">
        <p className="empty-title">Your ranking will appear here</p>
        <p>Set your priorities, then run the ranking to see salons matched to you.</p>
      </div>
    );
  }

  const { results, no_review_salons, total_candidates } = data;

  if (results.length === 0) {
    return (
      <div className="empty-state">
        No reviewed salons matched these filters. Try widening the distance range.
      </div>
    );
  }

  const pageCount = Math.ceil(results.length / PER_PAGE);
  const current = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const path = servicePath(filters);

  return (
    <div className="results-page">
      {path && (
        <nav className="svc-path" aria-label="Chosen service">
          {path.map((crumb, i) => {
            const last = i === path.length - 1;
            return (
              <span key={crumb.label}>
                {i > 0 && <i aria-hidden="true">›</i>}
                <span>{crumb.label}</span>
              </span>
            );
          })}
        </nav>
      )}
      <div className="results-head">
        <p className="summary">
          <strong>{results.length}</strong> ranked {results.length === 1 ? "salon" : "salons"}{" "}
          from {total_candidates} nearby
        </p>
        <p className="results-legend">
          <span className="legend-ring" aria-hidden="true" />
          <span><strong>Match</strong> — fit to your priorities</span>
        </p>
      </div>

      <MapView
        salons={results}
        userLat={userLat}
        userLng={userLng}
        maxDistanceKm={maxDistanceKm}
      />

      <div className="salon-grid">
        {current.map((salon) => (
          <SalonCard
            key={salon.salon_id}
            salon={salon}
            rank={salon.rank}
            onSelect={onSelectSalon}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Results pages">
          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            ‹
          </button>

          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`page-btn ${page === n ? "page-btn--active" : ""}`}
              onClick={() => setPage(n)}
              aria-current={page === n ? "page" : undefined}
            >
              {n}
            </button>
          ))}

          <button
            className="page-btn"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}

      {no_review_salons.length > 0 && (
        <section className="no-review-section">
          <h4>Not yet reviewed ({no_review_salons.length})</h4>
          <p>
            These salons match your filters but hold no reviews, so there is no evidence
            to rank them on. They are listed, never scored.
          </p>
          <ul className="no-review-list">
            {no_review_salons.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
