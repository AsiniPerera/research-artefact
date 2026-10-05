import { useState } from "react";
import { QuickFilters } from "../components/QuickFilters";
import { ServicesNav } from "../components/ServicesNav";
import { WeightLevels } from "../components/WeightLevels";
import { Results } from "./Results";
import { useRanking } from "../hooks/useRanking";
import { PRESETS } from "../constants/presets";
import { GROUP_BY_ID } from "../constants/taxonomy";

const DEFAULT_WEIGHTS = PRESETS.balanced;

const DEFAULT_FILTERS = {
  serviceFamily: "hair",
  gender: "unisex",
  availability: "open",
  maxDistance: 1,
  subGroup: "",
  subService: "",
};

export function Rankings({ onSelectSalon, initialFamily, initialSubService }) {
  const [filters, setFilters] = useState(() => {
    if (!initialFamily) return DEFAULT_FILTERS;
    return {
      ...DEFAULT_FILTERS,
      serviceFamily: initialFamily,
      /* A leaf is only meaningful under its own family, and the caller
         always sends the pair together. */
      subService: initialSubService ?? "",
    };
  });
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [userLocation, setUserLocation] = useState(null);
  const [geoError, setGeoError] = useState(null);
  /* What the visible results were actually ranked FOR. Filters and weights
     can be changed after a ranking, and the list underneath does not follow
     — so the page has to admit when what you are reading no longer answers
     what the controls now say. */
  const [rankedSig, setRankedSig] = useState(null);
  const { results, loading, error, rank } = useRanking();

  const querySig = JSON.stringify({ filters, weights });
  const stale = rankedSig !== null && rankedSig !== querySig;

  function handleSubmit(e) {
    e.preventDefault();
    setGeoError(null);
    /* Captured now, not in the callback: by the time geolocation answers the
       visitor may already have moved another slider. */
    const sig = querySig;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(loc);
        rank({
          service_family: filters.serviceFamily,
          gender: filters.gender,
          /* The API takes a boolean, so "any" is the ABSENCE of the
             filter rather than a third value it would not understand. */
          open_now: filters.availability === "any"
            ? undefined
            : filters.availability === "open",
          max_distance_km: filters.maxDistance,
          user_lat: loc.lat,
          user_lng: loc.lng,
          sub_service: filters.subService || undefined,
          // A group is sent as every leaf under it — match any of them.
          sub_services: filters.subGroup
            ? GROUP_BY_ID[filters.subGroup]?.leaves.map((l) => l.value)
            : undefined,
          user_weights: weights,
        });
        setRankedSig(sig);
      },
      () => setGeoError("Location permission is required to rank by distance.")
    );
  }

  return (
    /* One form: the filters and the priorities are a single query. */
    <form onSubmit={handleSubmit}>
      <div className="page-body page-body--explore">
        <header className="page-head page-head--bar">
          <div>
            <p className="eyebrow">Explore</p>
            <h1 className="page-head-title page-head-title--small">
              Ranked for <em>you.</em>
            </h1>
          </div>

          {/* The two constraints you re-try while reading sit at the masthead
              baseline — title left, controls right, like a printed folio line. */}
          <QuickFilters
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            /* Compared by value, so returning a filter to its default by hand
               also puts Clear all away again. */
            isDefault={Object.keys(DEFAULT_FILTERS).every(
              (f) => filters[f] === DEFAULT_FILTERS[f]
            )}
          />
        </header>

        <div className="discover">
          {/* ── Sidebar: HOW to rank ───────────────────── */}
          <aside className="sidebar">
            {/* Scrolls internally only if the screen is too short; the
                button below stays pinned and always visible. */}
            <div className="sidebar-scroll">
              <section className="priority-panel priority-panel--rail">
                <div className="priority-panel-head">
                  <div>
                    <h3>Your Priorities</h3>
                    <p>Each level counts double the one below, so Very high is worth eight Lows.</p>
                  </div>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => setWeights(DEFAULT_WEIGHTS)}
                  >
                    Reset
                  </button>
                </div>
                <WeightLevels weights={weights} onChange={setWeights} />
              </section>
            </div>

            <div className="sidebar-foot">
              {/* Every category now sits at Low or above, so there is no
                  all-zero state left to guard against. */}
              <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                {stale ? "Update ranking" : "Rank Salons"}
              </button>

              {/* Only when the list has fallen behind the controls. Nothing in
                  this slot otherwise — a note that is always showing is one
                  nobody reads by the time it matters. */}
              {stale && (
                <p className="rank-note">
                  Filters changed — the list below is from the last ranking.
                </p>
              )}
            </div>
          </aside>

          {/* ── Results column ─────────────────────────── */}
          <section>
          {/* WHAT to rank, under the masthead that says where you are. It sets
              the filter in place rather than routing: on this page a category
              is a filter, and routing would remount the whole screen and throw
              away the priorities the visitor has just set. */}
          <ServicesNav
            activeFamily={filters.serviceFamily}
            onPick={(fam, leaf, groupId) =>
              setFilters({
                ...filters,
                serviceFamily: fam,
                /* A group and a single service are mutually exclusive: picking
                   either clears the other. */
                subGroup: groupId ?? "",
                subService: leaf ?? "",
              })
            }
          />

            {geoError && <div className="info-banner">{geoError}</div>}

            {results?.radius_widened && (
              <div className="info-banner">
                Fewer than 3 salons matched your radius — widened to{" "}
                {results.effective_radius_km.toFixed(1)} km.
              </div>
            )}

            {(filters.subService || filters.subGroup) && (
              <div className="info-banner">
                Salons whose reviews mention{" "}
                {filters.subGroup
                  ? `anything under ${GROUP_BY_ID[filters.subGroup]?.label}`
                  : "this service"}{" "}
                rank first and are badged. Others still appear — a soft filter never
                excludes.
              </div>
            )}

            <Results
              filters={filters}
              data={results}
              loading={loading}
              error={error}
              userLat={userLocation?.lat}
              userLng={userLocation?.lng}
              maxDistanceKm={filters.maxDistance}
              onSelectSalon={onSelectSalon}
            />
          </section>
        </div>
      </div>
    </form>
  );
}
