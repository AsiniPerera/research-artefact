import { useState, useEffect } from "react";
import { SalonCard } from "../components/SalonCard";
import { FallbackNotice } from "../components/FallbackNotice";
import { rankingFallback } from "../api/client";
import { servicePath } from "../utils/servicePath";
import { IconChevron } from "../components/Icons";

const PER_PAGE = 6;

// How many unranked salons to show before asking. Long enough to be a useful
// sample, short enough not to bury the ranked list under 130 chips.
const UNRANKED_PREVIEW = 10;

/** A provider listed but not ranked: name, city, review count, link to profile.
 *
 *  `preview` caps the list until asked for the rest. It is opt-in rather than
 *  the default: the safety-concern list uses this same component, and a salon
 *  people were hurt at should not be the one hidden behind a "see more".
 */
function UnrankedList({ rows, onSelectSalon, preview }) {
  const [showAll, setShowAll] = useState(false);
  const capped = preview > 0 && rows.length > preview;
  const shown = capped && !showAll ? rows.slice(0, preview) : rows;

  return (
    <>
      <ul className="salon-chips">
        {shown.map((r) => (
          <li key={r.place_id}>
            <button type="button" className="salon-chip" onClick={() => onSelectSalon?.(r.place_id)}>
              <span className="salon-chip-name">{r.provider_name}</span>
              <span className="salon-chip-meta">
                {r.city ? `${r.city} · ` : ""}
                {r.evidence_reviews} {r.evidence_reviews === 1 ? "review" : "reviews"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {capped && (
        <button
          type="button"
          className="btn-text unranked-more"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? `Show first ${preview}` : `See all ${rows.length}`}
          <span className="unranked-more-caret" aria-hidden="true"><IconChevron size={12} /></span>
        </button>
      )}
    </>
  );
}

/**
 * The three sections of a ranking, in the order the API returns them:
 * ranked, available but not ranked, safety concern. Order within each is the
 * API's (score.rank_providers) — nothing here sorts.
 */
export function Results({
  filters,
  serviceChosen,
  submitted,
  data,
  loading,
  error,
  onSelectSalon,
  onSearchAllCities,
  nearby,
}) {
  const [page, setPage] = useState(1);

  // A fresh ranking is a fresh list — never strand the user on a page that no longer exists.
  useEffect(() => { setPage(1); }, [data]);

  if (!submitted) {
    return (
      <div className="empty-state empty-state--ready">
        <p className="empty-title">
          {serviceChosen ? "Your ranking will appear here" : "Choose a service"}
        </p>
        <p>
          {serviceChosen
            ? "Set your priorities, then press Rank Salons."
            : "Pick a specific service from the menu above, set your priorities, then press Rank Salons."}
        </p>
      </div>
    );
  }

  // A skeleton in the shape of the real grid — the page doesn't jump when
  // results land, and the wait reads as progress rather than a stall.
  if (loading && !data) {
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
  if (!data) return null;

  const ranked = data.ranked ?? [];
  const notRanked = data.available_but_not_ranked ?? [];
  const safety = data.safety_concern ?? [];
  /* Null unless the API answered above the service asked for. The notice says
     so; nothing here re-scores or re-orders because of it. */
  const fallback = rankingFallback(data);

  const pageCount = Math.ceil(ranked.length / PER_PAGE);
  const current = ranked.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const path = servicePath(filters);

  return (
    <div className="results-page" aria-busy={loading}>
      {path && (
        <nav className="svc-path" aria-label="Chosen service">
          {path.map((crumb, i) => (
            <span key={crumb.label}>
              {i > 0 && <i aria-hidden="true">›</i>}
              <span>{crumb.label}</span>
            </span>
          ))}
        </nav>
      )}
      <div className="results-head">
        <p className="summary">
          <strong>{ranked.length}</strong> ranked {ranked.length === 1 ? "salon" : "salons"}
          {filters.city ? ` in ${filters.city}` : ""}
        </p>
        {/* The legend reads a score ring. With no cards there is none to read. */}
        {ranked.length > 0 && (
          <p className="results-legend">
            <span className="legend-ring" aria-hidden="true" />
            <span><strong>Score</strong> — 0 to 100, 50 is neutral, with its 80% range</span>
          </p>
        )}
      </div>

      {fallback && (
        <FallbackNotice
          fallback={fallback}
          city={filters.city}
          onSearchAllCities={onSearchAllCities}
        />
      )}

      {ranked.length === 0 ? (
        /* "Nothing at any level" is already said in full by the notice —
           one message, not two. */
        fallback?.level === "none" ? null : (
          <div className="empty-state">
            No salon has enough review evidence to be ranked for this service yet.
          </div>
        )
      ) : (
        <div className="salon-grid">
          {current.map((row) => (
            <SalonCard
              key={row.place_id}
              salon={row}
              onSelect={onSelectSalon}
              /* The score is for a broader service than the one asked for;
                 the card says which, so no one reads it as the exact one. */
              ratedFor={fallback && fallback.level !== "none" ? fallback.shown?.name : null}
            />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Results pages">
          <button type="button"
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            ‹
          </button>

          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button type="button"
              key={n}
              className={`page-btn ${page === n ? "page-btn--active" : ""}`}
              onClick={() => setPage(n)}
              aria-current={page === n ? "page" : undefined}
            >
              {n}
            </button>
          ))}

          <button type="button"
            className="page-btn"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}

      {/* Nearby sits directly under the matches, before the unranked tail:
          both are real ranked salons the reader can go to, so they belong
          together, above the "not enough evidence" and safety lists. Driven by
          the "Nearby areas" toggle up by the city filter — idle renders
          nothing; otherwise it shows its own loading, empty and loaded states. */}
      {nearby && nearby.status && nearby.status !== "idle" && (
        <NearbySection city={filters.city} nearby={nearby} onSelectSalon={onSelectSalon} />
      )}

      {notRanked.length > 0 && (
        <section className="no-review-section">
          <h4>Available but not ranked ({notRanked.length})</h4>
          <p>
            These salons offer this service, but their reviews hold too little
            evidence for a service of this risk level to rank them fairly.
          </p>
          <UnrankedList rows={notRanked} onSelectSalon={onSelectSalon} preview={UNRANKED_PREVIEW} />
        </section>
      )}

      {safety.length > 0 && (
        <section className="no-review-section no-review-section--safety">
          <h4>Not ranked: safety concern ({safety.length})</h4>
          <p>
            Reviews report reactions, unsafe methods or work that had to be fixed
            elsewhere. These salons are never ranked, whatever their score.
          </p>
          <UnrankedList rows={safety} onSelectSalon={onSelectSalon} />
        </section>
      )}
    </div>
  );
}

/* Salons just outside the chosen city, shown as the same cards with a distance
   on each. `nearby` is the request state lifted to the page:
   { status: loading|done|error, data, error }. */
function NearbySection({ city, nearby, onSelectSalon }) {
  const { status, data, error } = nearby;
  const rows = data?.nearby ?? [];

  return (
    <section className="nearby-section nearby-section--open">
      <div className="nearby-head">
        <h4>Salons near {city}</h4>
        {status === "done" && rows.length > 0 && (
          <p>Just outside {city}, ranked for the same service — nearest first.</p>
        )}
      </div>

      {status === "loading" && <p className="nearby-note">Finding salons near {city}…</p>}
      {status === "error" && <p className="error">{error}</p>}
      {status === "done" && rows.length === 0 && (
        <p className="nearby-note">No ranked salons within reach of {city} for this service.</p>
      )}

      {status === "done" && rows.length > 0 && (
        <div className="salon-grid">
          {rows.map((row) => (
            <SalonCard key={row.place_id} salon={row} onSelect={onSelectSalon} />
          ))}
        </div>
      )}
    </section>
  );
}
