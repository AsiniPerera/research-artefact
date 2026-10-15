/* The ranking list, rendered by Rankings.jsx with the API response as `data`.
   One list: the ranked salons first, then salons that have feedbacks about the
   service but whose score is not yet certain enough to rank (marked
   "Less certain"). Salons with no feedbacks about the service are left out. The
   nearby-salons section sits beneath it. */
import { useState, useEffect } from "react";
import { SalonCard } from "../components/SalonCard";
import { FallbackNotice } from "../components/FallbackNotice";
import { rankingFallback } from "../api/client";
import { servicePath } from "../utils/servicePath";
import { IconInfo } from "../components/Icons";
import { AUDIENCE } from "../constants/audience";

const PER_PAGE = 6;

/**
 * The ranked salons come first, in the API's order (score.rank_providers);
 * less-certain salons follow, best score first.
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
  audience = "",
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
  /* Below the confidence bar but with reviews about this service: listed after
     the ranked salons, ordered by score, and marked Less certain on the card.
     A salon with no feedback about this service has nothing to score and is not
     shown. */
  const provisional = (data.available_but_not_ranked ?? [])
    .filter((r) => (r.evidence_reviews ?? 0) >= 1)
    .sort((a, b) => (b.personal_score ?? 0) - (a.personal_score ?? 0));
  /* Highest score first. The API puts salons with a safety notice after every
     clear salon; the list is ordered purely by score, and a notice is shown on
     the card instead. Array.sort is stable, so equal scores keep the API's order. */
  const byScore = (a, b) => (b.personal_score ?? 0) - (a.personal_score ?? 0);
  const everyone = [...[...ranked].sort(byScore), ...provisional];
  /* The audience filter only hides salons. Positions are recounted over what is
     shown, and salons with no label are hidden when a label is chosen, which
     the line under the count says. */
  const listed = audience ? everyone.filter((r) => r.audience === audience) : everyone;
  const hiddenUnlabelled = audience ? everyone.filter((r) => !r.audience).length : 0;
  const serviceName = data.shown?.name ?? data.sub_service?.name ?? "this service";
  /* Null unless the API answered above the service asked for. The notice says
     so; nothing here re-scores or re-orders because of it. */
  const fallback = rankingFallback(data);

  const pageCount = Math.ceil(listed.length / PER_PAGE);
  const pageStart = (page - 1) * PER_PAGE;
  const current = listed.slice(pageStart, pageStart + PER_PAGE);
  /* First, last and the neighbours of the current page, with a gap marker where
     pages are skipped, so a long list does not become a wall of numbers. */
  const pageItems = (() => {
    const nums = [...new Set([1, pageCount, page - 1, page, page + 1])]
      .filter((n) => n >= 1 && n <= pageCount)
      .sort((a, b) => a - b);
    return nums.flatMap((n, i) => (i > 0 && n - nums[i - 1] > 1 ? [`gap-${n}`, n] : [n]));
  })();
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
          <strong>{listed.length}</strong> {listed.length === 1 ? "salon" : "salons"}
          {filters.city ? ` in ${filters.city}` : ""}
          {audience ? ` for ${AUDIENCE[audience].label.toLowerCase()}` : ""}
        </p>
        {audience && hiddenUnlabelled > 0 && (
          <p className="audience-note">
            {hiddenUnlabelled} {hiddenUnlabelled === 1 ? "salon" : "salons"} we could not label as
            Ladies, Gents or Unisex {hiddenUnlabelled === 1 ? "is" : "are"} not shown. Choose Everyone to see them.
          </p>
        )}
        {/* The legend reads a score ring. With no cards there is none to read. */}
        {listed.length > 0 && (
          <p className="results-legend">
            <span className="legend-ring" aria-hidden="true" />
            <span><strong>Score</strong> — 0 to 100, 50 is neutral, with its 80% range</span>
          </p>
        )}
      </div>

      {fallback?.level === "none" && listed.length > 0 ? (
        /* Nothing is ranked with confidence, but salons with a review about the
           service are still listed. Say so, instead of "no rated salons" above
           a numbered list. */
        <div className="fallback-notice" role="status">
          <span className="fallback-notice-icon" aria-hidden="true"><IconInfo size={16} /></span>
          <div className="fallback-notice-body">
            <p className="fallback-notice-msg">
              No salon has enough feedbacks to be ranked with confidence for{" "}
              <strong>{fallback.requested?.name ?? serviceName}</strong> yet. These salons have
              at least one feedback about it, listed best score first. Their scores rest mostly
              on their other feedbacks, so treat the order as a guide, not a ranking.
            </p>
          </div>
        </div>
      ) : fallback && (
        <FallbackNotice
          fallback={fallback}
          city={filters.city}
          onSearchAllCities={onSearchAllCities}
        />
      )}

      {listed.length === 0 ? (
        /* "Nothing at any level" is already said in full by the notice —
           one message, not two. */
        fallback?.level === "none" ? null : (
          <div className="empty-state">
            {audience
              ? `No ${AUDIENCE[audience].label} salon found for this service. Choose Everyone to see all salons.`
              : "No salon has any customer feedbacks for this service yet."}
          </div>
        )
      ) : (
        <div className="salon-grid">
          {current.map((row, i) => (
            <SalonCard
              key={row.place_id}
              salon={row}
              position={ranked.length > 0 ? pageStart + i + 1 : undefined}
              provisional={ranked.length > 0 && row.rank_status !== "ranked"}
              onSelect={onSelectSalon}
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

          {pageItems.map((n) =>
            typeof n === "string" ? (
              <span key={n} className="page-gap" aria-hidden="true">…</span>
            ) : (
              <button type="button"
                key={n}
                className={`page-btn ${page === n ? "page-btn--active" : ""}`}
                onClick={() => setPage(n)}
                aria-current={page === n ? "page" : undefined}
              >
                {n}
              </button>
            )
          )}

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

      {/* Nearby sits directly under the matches. Driven by the "Nearby areas"
          toggle up by the city filter — idle renders nothing; otherwise it
          shows its own loading, empty and loaded states. */}
      {nearby && nearby.status && nearby.status !== "idle" && (
        <NearbySection city={filters.city} nearby={nearby} onSelectSalon={onSelectSalon} audience={audience} />
      )}
    </div>
  );
}

/* Salons just outside the chosen city, shown as the same cards with a distance
   on each. `nearby` is the request state lifted to the page:
   { status: loading|done|error, data, error }. */
function NearbySection({ city, nearby, onSelectSalon, audience = "" }) {
  const { status, data, error } = nearby;
  const all = data?.nearby ?? [];
  const rows = audience ? all.filter((r) => r.audience === audience) : all;

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
