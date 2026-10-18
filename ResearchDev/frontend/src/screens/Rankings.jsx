/* The main ranking screen: filters (QuickFilters) and priorities
   (WeightLevels) above the ranked list (Results). The service itself is
   picked from the mega menu in the nav and arrives as a prop.

   There is no submit step: the ranking follows the controls, so picking a
   service or moving a priority re-ranks on its own. Owns the filter/weight
   state and the useRanking call; everything else here renders from it. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuickFilters, DEFAULT_CONSISTENCY_WINDOW } from "../components/QuickFilters";
import { WeightLevels, toWeightList } from "../components/WeightLevels";
import { IconSliders, IconChevron } from "../components/Icons";
import { SelectMenu } from "../components/SelectMenu";
import { Results } from "./Results";
import { useRanking } from "../hooks/useRanking";
import { getServices, getNearbyRankings } from "../api/client";
import { PRESETS } from "../constants/presets";
import { DOMAINS, GROUP_BY_ID, LEAF_BY_CODE, LEAF_BY_VALUE } from "../constants/taxonomy";

/* The orders the Sort control offers. */
const SORT_OPTIONS = [
  { value: "best", label: "Best match" },
  { value: "score", label: "Highest score" },
  { value: "reviewed", label: "Most reviewed" },
  { value: "name", label: "Name A–Z" },
];

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

export function Rankings({ onSelectSalon, initialFamily, initialSubService, initialSubGroup = "" }) {
  const [filters, setFilters] = useState(() => {
    if (!initialFamily) return DEFAULT_FILTERS;
    return {
      ...DEFAULT_FILTERS,
      serviceFamily: initialFamily,
      subGroup: initialSubGroup ?? "",
      /* A leaf is only meaningful under its own family, and the caller
         always sends the pair together. */
      subService: initialSubService ?? "",
    };
  });
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  /* The priorities open from a chip in the filter row rather than holding a
     rail, so the list runs the full width. */
  const [prioOpen, setPrioOpen] = useState(false);
  /* On a phone the four chips and the priorities would fill the screen before
     a single salon showed, so they fold behind one Filters button. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("best");
  /* Reported up by Results once a response is in: only it knows how many
     salons survived the filters and how many carry a confident score. */
  const [counts, setCounts] = useState({ total: 0, confident: 0 });
  const prioRef = useRef(null);
  const sortRef = useRef(null);

  /* A click or a tap outside the panel closes it — SelectMenu already does
     this for the other filter chips (QuickFilters.jsx), but the priorities
     chip builds its own panel here and had no such handler, so it was the
     one control on the row a stray click never dismissed. */
  useEffect(() => {
    if (!prioOpen) return undefined;
    const onDown = (e) => {
      if (prioRef.current && !prioRef.current.contains(e.target)) setPrioOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setPrioOpen(false); };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [prioOpen]);
  /* The services with the most ranked salons, offered as shortcuts on the
     empty state. Taken from /services rather than hard-coded, so they can
     never name a service that has nothing to show. */
  const [popular, setPopular] = useState([]);

  /* Any of the three levels can be ranked: a sub-service (Haircut & Trim), a
     service (Haircuts) or a whole category (Hair). A service pick arrives as
     its group id in subGroup ("HR.CUT"); a whole-category pick puts the
     category code there instead ("HR", which never contains a dot, so the two
     cannot be confused). A bare family with nothing picked -- the page's
     default -- ranks nothing and asks the reader to choose. */
  const pickedCategory = DOMAINS.find((d) => d.id === filters.subGroup);
  const code = LEAF_BY_VALUE[filters.subService]?.id
    ?? GROUP_BY_ID[filters.subGroup]?.id
    ?? pickedCategory?.id
    ?? null;
  /* How many priorities sit off the default level; the chip shows the number
     so a moved slider is never hidden behind a closed panel. */
  const changedPriorities = Object.keys(DEFAULT_WEIGHTS)
    .filter((k) => k !== "consistency_window" && weights[k] !== DEFAULT_WEIGHTS[k]).length;
  const weightList = useMemo(() => toWeightList(weights), [weights]);
  const cw = weights.consistency_window ?? DEFAULT_CONSISTENCY_WINDOW;
  /* The page is about one service, so it is named at the top. Without a leaf
     the reader has not chosen one yet and the page says so instead. */
  const heading = LEAF_BY_VALUE[filters.subService]?.label
    ?? GROUP_BY_ID[filters.subGroup]?.label
    ?? DOMAINS.find((d) => d.value === filters.serviceFamily)?.label
    ?? "Ranked for you";
  /* What the Filters button's badge counts: only the ones doing something, so
     a reader can see at a glance whether the list is narrowed. */
  const activeFilters =
    (filters.city ? 1 : 0)
    + (filters.audience ? 1 : 0)
    + (filters.availability !== DEFAULT_FILTERS.availability ? 1 : 0)
    + (cw !== DEFAULT_CONSISTENCY_WINDOW ? 1 : 0)
    + (changedPriorities > 0 ? 1 : 0);
  const filtersAreDefault = !filters.city && !filters.audience && filters.availability === DEFAULT_FILTERS.availability;
  /* The ranking follows the controls: picking a service or moving a priority
     re-ranks on its own. useRanking debounces and aborts, so dragging a
     slider across three stops sends one request and a slow earlier answer can
     never overwrite a newer one. */
  const { results, loading, error } = useRanking(
    code, weightList, filters.city, filters.availability, cw
  );
  /* The profile uses the same review period and the same priorities as the
     list it was opened from: the badge and the overall salon score follow them. */
  const openSalon = (id) => onSelectSalon(id, cw, weightList);


  /* Salons just outside the chosen city. Shown automatically once a city is
     picked and the list has been ranked; with "All cities" there is no outside
     to be near, so it stays idle. */
  const [nearby, setNearby] = useState({ status: "idle", data: null, error: null });

  useEffect(() => {
    if (!filters.city || !code || !results) {
      setNearby({ status: "idle", data: null, error: null });
      return undefined;
    }
    let active = true;
    const ctrl = new AbortController();
    setNearby({ status: "loading", data: null, error: null });
    getNearbyRankings(
      code, weightList, filters.city, filters.availability, cw,
      { signal: ctrl.signal },
    )
      .then((d) => { if (active) setNearby({ status: "done", data: d, error: null }); })
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (active) setNearby({ status: "error", data: null, error: e.message });
      });
    return () => { active = false; ctrl.abort(); };
  }, [results, filters.city, code]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* A shortcut picks the service; the ranking follows on its own. */
  function startWith(item) {
    setFilters({
      ...filters,
      serviceFamily: DOMAIN_BY_ID[item.code.split(".")[0]] ?? filters.serviceFamily,
      subGroup: "",
      subService: item.value,
    });
  }

  /* A category tile ranks the whole category: the category code goes in the
     group slot, which Rankings reads as a whole-category pick. */
  function startWithCategory(domain) {
    setFilters({ ...filters, serviceFamily: domain.value, subGroup: domain.id, subService: "" });
  }

  /* The notice offers to widen the area, which is the one thing that may find
     the exact service. Everything else about the query is kept. */
  function searchAllCities() {
    setFilters({ ...filters, city: "" });
  }

  return (
    <div className="page-body page-body--explore">
      <header className="page-head xp-head">
        <div className="xp-headline">
          <h1 className="page-head-title xp-title">{heading}</h1>
          <p className="xp-sub">
            {code && counts.total > 0
              ? `${counts.total} ${counts.total === 1 ? "salon" : "salons"}, ${counts.confident} ranked with confidence. Every score comes from what customers wrote.`
              : "Every score comes from what customers wrote."}
          </p>
        </div>

        <div className="xp-controls">
          {/* Phone only: the chips and the priorities live behind this. */}
          <button
            type="button"
            className={`xp-filters-btn ${filtersOpen ? "is-open" : ""}`}
            aria-expanded={filtersOpen}
            aria-controls="xp-filterset"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <IconSliders size={14} />
            Filters
            {activeFilters > 0 && <span className="xp-filters-count">{activeFilters}</span>}
          </button>

          <div className="xp-filterset" id="xp-filterset" data-open={filtersOpen ? "true" : "false"}>
          <QuickFilters
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters({ ...filters, city: "", availability: DEFAULT_FILTERS.availability, audience: "" })}
            isDefault={filtersAreDefault}
            consistencyWindow={cw}
            audience={filters.audience}
            onAudienceChange={(audience) => setFilters({ ...filters, audience })}
            onConsistencyWindowChange={(v) => setWeights({ ...weights, consistency_window: v })}
          />

          <div className="xp-prio-wrap" ref={prioRef}>
            <button
              type="button"
              className={`xp-chip ${prioOpen ? "is-open" : ""} ${changedPriorities > 0 ? "is-set" : ""}`}
              aria-expanded={prioOpen}
              aria-controls="prio-panel"
              onClick={() => setPrioOpen((v) => !v)}
            >
              <IconSliders size={14} />
              Your priorities
              {changedPriorities > 0 && <span className="xp-chip-count">{changedPriorities}</span>}
              <IconChevron size={12} />
            </button>

            {prioOpen && (
              <div className="xp-prio-panel" id="prio-panel">
                <div className="xp-prio-head">
                  <h2 className="xp-prio-title">Your priorities</h2>
                  <button
                    type="button"
                    className="btn-text xp-prio-reset"
                    onClick={() => setWeights({ ...DEFAULT_WEIGHTS, consistency_window: cw })}
                    title="Set every priority back to the same level"
                  >
                    Reset
                  </button>
                </div>
                <p className="xp-prio-note">Four levels each — tap a step. The ranking re-orders as you set them.</p>
                <WeightLevels weights={weights} onChange={setWeights} />
              </div>
            )}
          </div>
          </div>

          {/* A native <select>'s open list is drawn by the OS, not the page, so it
              stays a square system menu whatever colour the closed control is
              given — SelectMenu rebuilds the listbox in markup so it can be
              styled like the rest of the panel. */}
          <div className="xp-sort" ref={sortRef}>
            <SelectMenu
              label="Sort"
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
            />
          </div>
        </div>
      </header>

      <div className="discover discover--wide">
        <section>
          {!code && <p className="rank-note">Pick a service from Explore in the menu above.</p>}

          <Results
            priorities={weightList}
            consistencyWindow={cw}
            filters={filters}
            serviceChosen={Boolean(code)}
            sort={sort}
            onCounts={setCounts}
            popular={popular}
            onStartWith={startWith}
            onStartCategory={startWithCategory}
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
  );
}
