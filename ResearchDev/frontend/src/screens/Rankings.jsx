/* The main ranking screen: service picker (ServicesNav) + filters
   (QuickFilters) + priorities (WeightLevels) on one side, the ranked list
   (Results) on the other. Owns the filter/weight state and the useRanking
   call; everything else here renders from it. */
import { useEffect, useMemo, useState } from "react";
import { QuickFilters, DEFAULT_CONSISTENCY_WINDOW } from "../components/QuickFilters";
import { ServicesNav } from "../components/ServicesNav";
import { WeightLevels, toWeightList } from "../components/WeightLevels";
import { Results } from "./Results";
import { useRanking } from "../hooks/useRanking";
import { getServices, getNearbyRankings } from "../api/client";
import { PRESETS } from "../constants/presets";
import { DOMAINS, GROUP_BY_ID, LEAF_BY_CODE, LEAF_BY_VALUE } from "../constants/taxonomy";

/* "HR.CUT.01" -> the domain slug its tab uses. */
const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d.value]));

/* Every category at the same level: equal weights, the API's default. */
/* consistency_window rides in the same object; toWeightList reads only the
   seven category keys, so it never reaches the weights list. */
const DEFAULT_WEIGHTS = { ...PRESETS.balanced, consistency_window: DEFAULT_CONSISTENCY_WINDOW };

const DEFAULT_FILTERS = {
  serviceFamily: "hair",
  subGroup: "",
  subService: "",
  city: "",
  availability: "open",
  audience: "",
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
  /* What the visible results were ranked FOR, set by the Rank Salons button.
     Controls can change afterwards and the list does not follow until the
     button is pressed again — so the page says when they disagree. */
  const [submitted, setSubmitted] = useState(null);
  /* The services with the most ranked salons, offered as shortcuts on the
     empty state. Taken from /services rather than hard-coded, so they can
     never name a service that has nothing to show. */
  const [popular, setPopular] = useState([]);

  /* Rankings exist per sub-service, so only a leaf can be ranked. A domain or
     group pick narrows the menu; Results asks for a specific service. */
  const code = LEAF_BY_VALUE[filters.subService]?.id ?? null;
  const weightList = useMemo(() => toWeightList(weights), [weights]);
  const cw = weights.consistency_window ?? DEFAULT_CONSISTENCY_WINDOW;
  const querySig = JSON.stringify({ code, weightList, cw, city: filters.city, availability: filters.availability });
  const stale = submitted !== null && submitted.sig !== querySig;
  const cwUsed = submitted?.cw ?? cw;
  const { results, loading, error } = useRanking(
    submitted?.code ?? null,
    submitted?.weightList ?? weightList,
    submitted?.city ?? "",
    submitted?.availability ?? "open",
    cwUsed
  );
  /* The profile shows the badge for the same window as the list it was opened from. */
  const openSalon = (id) => onSelectSalon(id, cwUsed);

  /* Salons just outside the chosen city. Shown automatically once a city is
     picked and the list has been ranked; with "All cities" there is no outside
     to be near, so it stays idle. Keyed on the SUBMITTED query, not the live
     filters, so the nearby set always matches the ranked list on screen. */
  const [nearby, setNearby] = useState({ status: "idle", data: null, error: null });

  useEffect(() => {
    if (!submitted?.city || !results) {
      setNearby({ status: "idle", data: null, error: null });
      return undefined;
    }
    let active = true;
    const ctrl = new AbortController();
    setNearby({ status: "loading", data: null, error: null });
    getNearbyRankings(
      submitted.code, submitted.weightList, submitted.city, submitted.availability, submitted.cw,
      { signal: ctrl.signal },
    )
      .then((d) => { if (active) setNearby({ status: "done", data: d, error: null }); })
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (active) setNearby({ status: "error", data: null, error: e.message });
      });
    return () => { active = false; ctrl.abort(); };
  }, [results, submitted?.city, submitted?.code]);

  useEffect(() => {
    const ctrl = new AbortController();
    getServices({ signal: ctrl.signal })
      .then((tree) => {
        const all = [];
        for (const cat of tree ?? [])
          for (const svc of cat.services ?? [])
            for (const sub of svc.sub_services ?? [])
              if (sub.ranked_providers > 0)
                all.push({ code: sub.code, name: sub.name, ranked: sub.ranked_providers });
        all.sort((a, b) => b.ranked - a.ranked);
        setPopular(
          all.slice(0, 5)
            .map((x) => ({ ...x, value: LEAF_BY_CODE[x.code]?.value }))
            .filter((x) => x.value)
        );
      })
      .catch(() => { /* shortcuts are a nicety; the page works without them */ });
    return () => ctrl.abort();
  }, []);

  /* A shortcut picks the service and ranks it in one go, at the default
     equal weights. */
  function startWith(item) {
    const next = {
      ...filters,
      serviceFamily: DOMAIN_BY_ID[item.code.split(".")[0]] ?? filters.serviceFamily,
      subGroup: "",
      subService: item.value,
    };
    setFilters(next);
    setSubmitted({
      sig: JSON.stringify({ code: item.code, weightList, cw, city: next.city, availability: next.availability }),
      code: item.code,
      weightList,
      cw,
      city: next.city,
      availability: next.availability,
      filters: next,
    });
  }

  /* The notice's "Search all cities": drop the city and rank again at once,
     because widening the area is the one thing that may find the exact
     service. Everything else about the query is kept. */
  function searchAllCities() {
    const base = submitted?.filters ?? filters;
    const next = { ...base, city: "" };
    const weightsUsed = submitted?.weightList ?? weightList;
    const codeUsed = submitted?.code ?? code;
    if (!codeUsed) return;
    setFilters(next);
    setSubmitted({
      sig: JSON.stringify({ code: codeUsed, weightList: weightsUsed, cw: cwUsed, city: "", availability: next.availability }),
      code: codeUsed,
      weightList: weightsUsed,
      cw: cwUsed,
      city: "",
      availability: next.availability,
      filters: next,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!code) return;
    setSubmitted({ sig: querySig, code, weightList, cw, city: filters.city, availability: filters.availability, filters });
  }

  return (
    /* One form: the service, the city and the priorities are a single query. */
    <form onSubmit={handleSubmit}>
    <div className="page-body page-body--explore">
      <header className="page-head page-head--bar">
        <div>
          <p className="eyebrow">Explore</p>
          <h1 className="page-head-title page-head-title--small">
            Ranked for <em>you.</em>
          </h1>
        </div>

        <QuickFilters
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters({ ...filters, city: "", availability: DEFAULT_FILTERS.availability, audience: "" })}
          isDefault={!filters.city && !filters.audience && filters.availability === DEFAULT_FILTERS.availability}
          consistencyWindow={cw}
          audience={filters.audience}
          onAudienceChange={(audience) => setFilters({ ...filters, audience })}
          onConsistencyWindowChange={(v) => setWeights({ ...weights, consistency_window: v })}
        />
      </header>

      <div className="discover">
        {/* ── Sidebar: HOW to rank ───────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-scroll">
            <section className="priority-panel priority-panel--rail">
              <div className="priority-panel-head">
                <div>
                  <h3>Your priorities</h3>
                </div>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setWeights({ ...DEFAULT_WEIGHTS, consistency_window: cw })}
                  title="Set every priority back to the same level"
                >
                  Reset
                </button>
              </div>
              <WeightLevels
                weights={weights}
                onChange={setWeights}
              />
            </section>
          </div>

          <div className="sidebar-foot">
            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%" }}
              disabled={!code}
              title={code ? undefined : "Pick a specific service first"}
            >
              {stale ? "Update ranking" : "Rank Salons"}
            </button>

            {/* Only when the list has fallen behind the controls. */}
            {!code && <p className="rank-note">Pick a service above to rank salons for it.</p>}
            {code && stale && (
              <p className="rank-note">
                Choices changed — the list shows the last ranking.
              </p>
            )}
          </div>
        </aside>

        {/* ── Results column ─────────────────────────── */}
        <section>
          {/* WHAT to rank. It sets the filter in place rather than routing, so
              the priorities set in the rail survive a change of service. */}
          <ServicesNav
            activeFamily={filters.serviceFamily}
            onPick={(fam, leaf, groupId) =>
              setFilters({
                ...filters,
                serviceFamily: fam,
                subGroup: groupId ?? "",
                subService: leaf ?? "",
              })
            }
          />

          {!code && filters.subGroup && (
            <div className="info-banner">
              Rankings are per service. Pick one under{" "}
              {GROUP_BY_ID[filters.subGroup]?.label} to see who ranks for it.
            </div>
          )}

          <Results
            filters={submitted?.filters ?? filters}
            serviceChosen={Boolean(code)}
            submitted={submitted !== null}
            popular={popular}
            onStartWith={startWith}
            data={results}
            loading={loading}
            error={error}
            onSelectSalon={openSalon}
            onSearchAllCities={searchAllCities}
            nearby={nearby}
            audience={filters.audience}
          />
        </section>
      </div>
    </div>
    </form>
  );
}
