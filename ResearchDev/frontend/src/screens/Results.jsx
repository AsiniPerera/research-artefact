/* The ranking list, rendered by Rankings.jsx with the API response as `data`.
   One list: the ranked salons first, then salons that have feedbacks about the
   service but whose score is not yet certain enough to rank (marked
   "Less certain"). Salons with no feedbacks about the service are left out. The
   nearby-salons section sits beneath it. */
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { SalonCard } from "../components/SalonCard";
import { FallbackNotice } from "../components/FallbackNotice";
import { GeneralFeedbackSection } from "../components/GeneralFeedbackSection";
import { ChooseService } from "../components/ChooseService";
import { rankingFallback } from "../api/client";
import { servicePath } from "../utils/servicePath";
import { IconInfo } from "../components/Icons";
import { AUDIENCE } from "../constants/audience";

const PER_PAGE = 6;

/* The orders the Sort control offers, beyond the ranking itself. */
const SORTS = {
  score: (a, b) => (b.personal_score ?? 0) - (a.personal_score ?? 0),
  reviewed: (a, b) => (b.evidence_reviews ?? 0) - (a.evidence_reviews ?? 0),
  name: (a, b) => String(a.provider_name ?? "").localeCompare(String(b.provider_name ?? "")),
};

/* Nearby is a supporting list, not a second ranking: it shows six and says
   how many more there are rather than paginating on its own. */
const NEARBY_SHOWN = 6;

/**
 * The ranked salons come first, in the API's order (score.rank_providers);
 * less-certain salons follow, best score first.
 */
export function Results({
  filters,
  serviceChosen,
  data,
  loading,
  error,
  onSelectSalon,
  onSearchAllCities,
  nearby,
  audience = "",
  priorities,
  consistencyWindow,
  popular = [],
  onStartWith,
  onStartCategory,
  sort = "best",
  onCounts,
}) {
  const [page, setPage] = useState(1);
  /* Written during render, reported after it: telling the parent mid-render
     would set state on it while this one is still rendering. */
  const countsRef = useRef({ total: 0, confident: 0 });
  const counts = countsRef.current;
  useEffect(() => {
    onCounts?.(counts);
  }, [onCounts, counts.total, counts.confident]); // eslint-disable-line react-hooks/exhaustive-deps

  /* When a change of priorities re-orders the list, each card glides from its old
     place to its new one, so the reader sees what their change did. Positions are
     measured against the grid, so scrolling between renders does not matter, and
     a card that was not on screen before simply appears. */
  const gridRef = useRef(null);
  const lastTops = useRef(new Map());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const next = new Map();
    if (grid) {
      const base = grid.getBoundingClientRect().top;
      const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      for (const el of grid.querySelectorAll(":scope > [data-id]")) {
        const top = el.getBoundingClientRect().top - base;
        next.set(el.dataset.id, top);
        const was = lastTops.current.get(el.dataset.id);
        if (!calm && was != null && Math.abs(was - top) > 2 && el.animate) {
          el.animate(
            [{ transform: `translateY(${was - top}px)` }, { transform: "none" }],
            { duration: 450, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
          );
        }
      }
    }
    lastTops.current = next;
  });

  // A fresh ranking is a fresh list — never strand the user on a page that no longer exists.
  useEffect(() => { setPage(1); }, [data]);
  // Re-sorting starts from the top too: page 3 of one order is not page 3 of another.
  useEffect(() => { setPage(1); }, [sort]);

  if (!serviceChosen) {
    return <ChooseService popular={popular} onStartWith={onStartWith} onStartCategory={onStartCategory} />;
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
  /* Below the confidence bar but with reviews about this service: still
     listed, and marked Less certain on the card. A salon with no feedback
     about this service has nothing to score and is not shown. */
  const provisional = (data.available_but_not_ranked ?? [])
    .filter((r) => (r.evidence_reviews ?? 0) >= 1);
  /* One list, highest score first, whether or not a salon is ranked with
     confidence: the reader sees the order of the scores they are shown. The
     "Less certain" mark on a card is what says the evidence behind it is thin.
     The API's own order -- ranked first, then safety -- is deliberately not
     used for display. Array.sort is stable, so equal scores keep the API's
     order. */
  const byScore = (a, b) => (b.personal_score ?? 0) - (a.personal_score ?? 0);
  const everyone = [...ranked, ...provisional].sort(byScore);
  /* The audience filter only hides salons. Positions are recounted over what is
     shown, and salons with no label are hidden when a label is chosen, which
     the line under the count says. */
  const shown = audience ? everyone.filter((r) => r.audience === audience) : everyone;
  /* Sorting reorders what is already on screen; it never re-asks the server,
     so the scores and the confidence behind them are untouched. "Best match"
     is the ranking itself, which is what `shown` already is. */
  const listed = sort === "best" ? shown : [...shown].sort(SORTS[sort] ?? (() => 0));
  const hiddenUnlabelled = audience ? everyone.filter((r) => !r.audience).length : 0;
  const serviceName = data.shown?.name ?? data.sub_service?.name ?? "this service";
  /* Null unless the API answered above the service asked for. The notice says
     so; nothing here re-scores or re-orders because of it. */
  const fallback = rankingFallback(data);

  /* The header says how many salons there are and how many carry a confident
     score; both are known only once the response is in. */
  countsRef.current = { total: listed.length, confident: ranked.length };

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
      {/* One line: which service, how many salons, and how to read a score. */}
      <div className="results-head">
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
        {audience && hiddenUnlabelled > 0 && (
          <p className="audience-note">
            {hiddenUnlabelled} {hiddenUnlabelled === 1 ? "salon" : "salons"} we could not label as
            Ladies, Gents or Unisex {hiddenUnlabelled === 1 ? "is" : "are"} not shown. Choose Everyone to see them.
          </p>
        )}
      </div>

      {fallback?.level === "none" && listed.length > 0 ? (
        /* Nothing is ranked with confidence, but salons with a review about the
           service are still listed. Say so, instead of "no rated salons" above
           a numbered list. */
        <p className="fallback-notice" role="status">
          <span className="fallback-notice-icon" aria-hidden="true"><IconInfo size={15} /></span>
          <span className="fallback-notice-msg">
            None has enough feedbacks about{" "}
            <strong>{fallback.requested?.name ?? serviceName}</strong>, or about anything above
            it, to be ranked with confidence, so treat the order as a guide rather than a ranking.
          </span>
        </p>
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
        <div className="salon-grid" ref={gridRef}>
          {current.map((row, i) => (
            <SalonCard
              key={row.place_id}
              salon={row}
              position={ranked.length > 0 ? pageStart + i + 1 : undefined}
              provisional={ranked.length > 0 && row.rank_status !== "ranked"}
              onSelect={onSelectSalon}
              priorities={priorities}
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

      {/* Salons whose feedback names no service are in no ranking, so they
          are offered here, scored on the same priorities. */}
      {serviceChosen && (
        <GeneralFeedbackSection
          priorities={priorities}
          city={filters.city}
          availability={filters.availability}
          consistencyWindow={consistencyWindow}
          audience={audience}
          onSelectSalon={onSelectSalon}
        />
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
  /* Best first, not nearest first. The API returns these in distance order,
     and each card shows the rank it holds in the wider list — so the five
     nearest read as 28, 9, 17, 12, 8 and the section looked broken. Ordering
     by that same rank makes the numbers climb and puts the best five on show
     rather than an arbitrary five. */
  const shown = [...rows]
    .sort((a, b) => (a.rank_no ?? Infinity) - (b.rank_no ?? Infinity))
    .slice(0, NEARBY_SHOWN);
  const more = rows.length - shown.length;

  return (
    <section className="nearby-section nearby-section--open">
      <div className="nearby-head">
        <h4>Salons near {city}</h4>
        {status === "done" && rows.length > 0 && (
          <p>Just outside {city}, ranked for the same service — best first.</p>
        )}
      </div>

      {status === "loading" && <p className="nearby-note">Finding salons near {city}…</p>}
      {status === "error" && <p className="error">{error}</p>}
      {status === "done" && rows.length === 0 && (
        <p className="nearby-note">No ranked salons within reach of {city} for this service.</p>
      )}

      {status === "done" && rows.length > 0 && (
        <div className="salon-grid">
          {/* Numbered 1-5 for this list, not by the rank each holds in the
              wider one: five rows reading 1, 2, 8, 9, 10 look like a list with
              gaps in it. */}
          {shown.map((row, i) => (
            <SalonCard key={row.place_id} salon={row} position={i + 1} onSelect={onSelectSalon} />
          ))}
        </div>
      )}

      {status === "done" && more > 0 && (
        <p className="nearby-note">
          {more} more ranked salon{more === 1 ? "" : "s"} near {city}. Choose that city to see {more === 1 ? "it" : "them"}.
        </p>
      )}
    </section>
  );
}
