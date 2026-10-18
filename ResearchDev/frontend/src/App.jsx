/* The app shell: header, nav and the screen router. Every screen is mounted
   here; this file owns which one is showing and the state that crosses
   screens (auth, favorites, the URL). */
import { useState, useEffect, useRef } from "react";
import logoMark from "./assets/images/logo/logo-mark.png";
import { AccountMenu } from "./components/AccountMenu";
import { NotificationsMenu } from "./components/NotificationsMenu";
import { IconHeart, IconSearch, IconUserPlus } from "./components/Icons";
import { useFavorites } from "./hooks/useFavorites";
import { useAuth } from "./hooks/useAuth";
import { ChatWidget } from "./components/ChatWidget";
import { SurveyChat } from "./components/SurveyChat";
import { Dashboard } from "./screens/Dashboard";
import { Favorites } from "./screens/Favorites";
import { Landing } from "./screens/Landing";
import { Rankings } from "./screens/Rankings";
import { SalonDetail } from "./screens/SalonDetail";
import { Lookup } from "./screens/Lookup";
import { HowItWorks } from "./screens/HowItWorks";
import { About } from "./screens/About";
import { Auth } from "./screens/Auth";
import { Contact } from "./screens/Contact";
import { Profile } from "./screens/Profile";
import { DOMAINS } from "./constants/taxonomy";
import { ServicesMegaPanel } from "./components/ServicesNav";
import { CLOSE_GRACE_MS } from "./components/flyoutPlacement";
import { readUrl, buildUrl } from "./utils/url";

const NAV = [
  { key: "home",        label: "Home" },
  { key: "ourservices", label: "Services" },
  { key: "services",    label: "Explore" },
  { key: "offers",      label: "Offers & Promotions" },
  { key: "about",       label: "About" },
  { key: "contact",     label: "Contact" },
];


export default function App() {
  const auth = useAuth();
  /* Read once per mount, not per render: this is the state the page STARTED
     with, and re-reading it later would fight the sync effect below. */
  const initialRef = useRef(null);
  if (initialRef.current === null) initialRef.current = readUrl();
  const initial = initialRef.current;

  const [route, setRoute] = useState(initial.route);
  const [selectedSalon, setSelectedSalon] = useState(initial.salon);
  /* The consistency window the profile was opened with. Only the ranking list
     sends one; any other way in falls back to the default (1 year). */
  const [salonWindow, setSalonWindow] = useState(initial.cw);
  /* The seven priorities the list was ranked with, for the profile's overall
     score. Null from any other way in, which means Medium throughout. */
  const [salonWeights, setSalonWeights] = useState(null);
  const openSalon = (id, consistencyWindow = null, weightList = null) => {
    setSalonWindow(consistencyWindow);
    setSalonWeights(weightList);
    setSelectedSalon(id);
  };
  /* Seeded by the services bar when a specific service is picked, so the
     ranking opens on that service rather than just its domain. */
  const [sub, setSub] = useState(initial.sub);
  // Set when a service card sends you to the ranking pre-filtered.
  const [family, setFamily] = useState(initial.family);
  /* A group pick from the services menu ("any service under Hair Colour").
     Not in the URL: family and sub are the shareable pair, and a group is a
     narrowing aid rather than a destination. */
  const [subGroup, setSubGroup] = useState("");
  const [authMode, setAuthMode] = useState(initial.authMode);
  const [draftQuery, setDraftQuery] = useState(initial.q);
  const [submittedQuery, setSubmittedQuery] = useState(initial.q);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef(null);

  /* Focus has to wait a frame: the input is width:0 until the class lands,
     and focusing a box with no layout does nothing. */
  const openSearch = () => {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  };
  const favorites = useFavorites();

  /* State → address bar. The first run replaces, so arriving at "/" does not
     leave an empty entry behind that Back would return to; everything after
     pushes, so Back steps through the screens you actually visited. */
  const urlWritten = useRef(false);
  useEffect(() => {
    const next = buildUrl({
      route, family, sub, salon: selectedSalon, cw: salonWindow,
      q: submittedQuery, authMode,
    });
    if (next === window.location.hash) {
      urlWritten.current = true;
      return;
    }
    if (urlWritten.current) window.history.pushState(null, "", next);
    else window.history.replaceState(null, "", next);
    urlWritten.current = true;
  }, [route, family, sub, selectedSalon, salonWindow, submittedQuery, authMode]);

  /* Address bar → state, for Back and Forward. The effect above sees the hash
     it is given already matches and writes nothing, so the two cannot loop. */
  useEffect(() => {
    const onPop = () => {
      const s = readUrl();
      setRoute(s.route);
      setFamily(s.family);
      setSub(s.sub);
      setSelectedSalon(s.salon);
      setSalonWindow(s.cw);
      setAuthMode(s.authMode);
      setSubmittedQuery(s.q);
      setDraftQuery(s.q);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The nav is weightless at rest and earns its edge once content
  // slides beneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ⌘K / Ctrl-K jumps to search — the hint in the field is real, not decor.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
      /* Escape closes it, but only when empty — see the click-away note. */
      if (e.key === "Escape" && !draftQuery) setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draftQuery]);

  /* Click away closes it — unless there is text in it. Collapsing a field
     someone has typed into discards what they wrote, with no warning and no
     way back. An empty one costs nothing to reopen. */
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDown = (e) => {
      if (searchBoxRef.current?.contains(e.target)) return;
      if (draftQuery) return;
      setSearchOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [searchOpen, draftQuery]);

  // The landing hero is full-bleed and supplies its own padding.
  const isLanding =
    (route === "home" || route === "offers" || route === "ourservices") && !selectedSalon;
  // Auth is a focused, full-height page — no page padding, no footer.
  const isAuth = route === "auth" && !selectedSalon;
  // Services supplies its own padding via .page-body; flush avoids doubling it.
  const isServices = route === "services" && !selectedSalon;

  function openAuth(mode) {
    setAuthMode(mode);
    go("auth");
  }


  /* The services mega menu hangs off Explore in the nav. It is a child of
     <nav>, so the pointer moving from the link into the panel never leaves
     the element the close handler watches; the grace period covers the trip
     back out. */
  const [megaOpen, setMegaOpen] = useState(false);
  const megaTimer = useRef(null);
  const holdMega = () => clearTimeout(megaTimer.current);
  const openMega = () => { clearTimeout(megaTimer.current); setMegaOpen(true); };
  const closeMegaSoon = () => {
    clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaOpen(false), CLOSE_GRACE_MS);
  };
  const closeMegaNow = () => { clearTimeout(megaTimer.current); setMegaOpen(false); };
  useEffect(() => () => clearTimeout(megaTimer.current), []);
  useEffect(() => {
    if (!megaOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && closeMegaNow();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [megaOpen]);

  function go(next, nextFamily = null, nextSub = null, nextGroup = "") {
    setRoute(next);
    setFamily(nextFamily);
    setSub(nextSub);
    setSubGroup(nextGroup);
    setSelectedSalon(null);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }

  // The landing's CTAs: no argument means "go rank something". A category
  // card ("Explore by service" -> Hair) opens Explore with that whole category
  // already ranked, rather than the empty "what are you looking for?" page:
  // the reader chose a category, so the answer is that category's ranking,
  // narrowed by the menu from there. The category code goes in the group slot,
  // which Rankings reads as a whole-category pick.
  function explore(target = "services", nextFamily = null) {
    const domain = DOMAINS.find((d) => d.value === nextFamily);
    if (target === "services" && domain) go(target, nextFamily, null, domain.id);
    else go(target, nextFamily);
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!draftQuery.trim()) return;
    setSubmittedQuery(draftQuery.trim());
    setSelectedSalon(null);
    setRoute("search");
    setMenuOpen(false);
  }

  return (
    <div className="app">
      <div className={`shell ${isLanding ? "shell--landing" : ""}`}>
        <header className="site-header">
        <nav className={`nav ${isLanding ? "nav--landing" : ""} ${scrolled ? "nav--scrolled" : ""}`} aria-label="Primary" onMouseLeave={closeMegaSoon} onMouseEnter={holdMega}>
          <button
            className="nav-brand"
            onClick={() => go("home")}
            aria-label="Amore Beauty — home"
          >
            <img src={logoMark} alt="Amore Beauty" className="nav-logo" />
          </button>

          <div className="nav-links">
            {NAV.map(({ key, label }) => {
              const isExplore = key === "services";
              return (
                <button
                  key={key}
                  className={`nav-link ${route === key ? "nav-link--active" : ""}`}
                  onClick={() => { closeMegaNow(); go(key); }}
                  aria-current={route === key ? "page" : undefined}
                  aria-expanded={isExplore ? megaOpen : undefined}
                  aria-haspopup={isExplore ? "true" : undefined}
                  onMouseEnter={isExplore ? openMega : closeMegaSoon}
                  onFocus={isExplore ? openMega : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="nav-actions">
            {/* Still a form: Enter submitting is the browser's doing, and a
                plain div would animate just as well and quietly lose it. */}
            <form
              ref={searchBoxRef}
              className={`nav-search ${searchOpen ? "is-open" : ""}`}
              onSubmit={handleSearch}
              role="search"
            >
              <button
                type="button"
                className="nav-search-toggle"
                onClick={() => (searchOpen ? setSearchOpen(false) : openSearch())}
                aria-label={searchOpen ? "Close search" : "Search salons"}
                aria-expanded={searchOpen}
              >
                {/* 18, like the heart, the bell and the account glyph. */}
                <IconSearch size={18} />
              </button>

              {/* Collapsed, it is not a tab stop and not announced: a focus
                  stop with no visible box is a trap, and a screen reader
                  should not offer a field nobody can see. */}
              <input
                ref={searchRef}
                type="search"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="Search salons…"
                aria-label="Search salons by name"
                tabIndex={searchOpen ? 0 : -1}
                aria-hidden={searchOpen ? undefined : "true"}
              />

              {draftQuery && (
                <button
                  type="button"
                  className="nav-search-clear"
                  onClick={() => setDraftQuery("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </form>

            {/* Favorites earns its own button rather than a menu row — it's
                one destination, and the count is worth showing at rest. */}
            <div className="nav-icons">
              <button
                className="nav-icon-btn"
                onClick={() => go("favorites")}
                aria-label={
                  favorites.length
                    ? `Favorites, ${favorites.length} saved`
                    : "Favorites"
                }
              >
                <IconHeart size={18} filled={favorites.length > 0} />
                {favorites.length > 0 && (
                  <span className="nav-badge">
                    {favorites.length > 9 ? "9+" : favorites.length}
                  </span>
                )}
              </button>

              <NotificationsMenu />

              <AccountMenu
                onAuth={openAuth}
                user={auth.user}
                onProfile={() => go("profile")}
                onSignOut={() => { auth.clearSession(); go("home"); }}
              />
            </div>

            <button
              className={`nav-burger ${menuOpen ? "nav-burger--open" : ""}`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
          </div>

          {megaOpen && (
            <ServicesMegaPanel
              activeFamily={family}
              activeSub={sub}
              activeGroup={subGroup}
              onPick={(fam, leaf, groupId) => { closeMegaNow(); go("services", fam, leaf, groupId ?? ""); }}
            />
          )}
        </nav>
        </header>

        {/* ── Mobile navigation drawer ─────────────────────── */}
        <div
          className={`nav-drawer-scrim ${menuOpen ? "is-open" : ""}`}
          onClick={() => setMenuOpen(false)}
          aria-hidden={!menuOpen}
        />
        <aside className={`nav-drawer ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
          <form className="nav-drawer-search" onSubmit={handleSearch} role="search">
            <IconSearch size={16} />
            <input
              type="search"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder="Search salons…"
              aria-label="Search salons by name"
              tabIndex={menuOpen ? 0 : -1}
            />
          </form>

          <nav className="nav-drawer-links">
            {NAV.map(({ key, label }) => (
              <button
                key={key}
                className={`nav-drawer-link ${route === key ? "nav-drawer-link--active" : ""}`}
                onClick={() => go(key)}
                tabIndex={menuOpen ? 0 : -1}
              >
                {label}
              </button>
            ))}
          </nav>
          {/* The nav icons are hidden at this width, so Favorites lives here
              instead. The dashboard is a signed-in surface and stays out of
              reach until there's a session to reach it with. */}
          <p className="nav-drawer-label">Saved</p>
          <nav className="nav-drawer-account">
            <button onClick={() => go("favorites")} tabIndex={menuOpen ? 0 : -1}>
              <IconHeart size={15} /> Favorites
              {favorites.length > 0 && (
                <span className="nav-drawer-count">{favorites.length}</span>
              )}
            </button>
          </nav>

          {/* Both halves of the account menu, which is hidden at this width.
              The bar offers Sign in and Sign up; the drawer used to carry only
              Sign in, so on a phone there was no way to create an account at
              all. */}
          <p className="nav-drawer-label">Account</p>
          {auth.signedIn ? (
            <>
              <nav className="nav-drawer-account">
                <button onClick={() => go("profile")} tabIndex={menuOpen ? 0 : -1}>
                  <IconUserPlus size={15} /> Profile ({auth.user?.full_name?.split(" ")[0]})
                </button>
              </nav>
              <button
                className="btn-hero nav-drawer-cta"
                onClick={() => { auth.clearSession(); go("home"); }}
                tabIndex={menuOpen ? 0 : -1}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <nav className="nav-drawer-account">
                <button onClick={() => openAuth("signup")} tabIndex={menuOpen ? 0 : -1}>
                  <IconUserPlus size={15} /> Sign up
                </button>
              </nav>
              <button
                className="btn-hero nav-drawer-cta"
                onClick={() => openAuth("signin")}
                tabIndex={menuOpen ? 0 : -1}
              >
                Sign In
              </button>
            </>
          )}
        </aside>

        <main className={`page ${isLanding || isAuth || isServices ? "page--flush" : ""}`}>
          {/* Rankings stays mounted under a salon's profile rather than
              being swapped out for it. selectedSalon used to sit as the
              OUTERMOST branch of this chain, so opening a salon unmounted
              Rankings entirely — its filters, priorities and the ranked list
              itself all lived in its own useState, and Back remounted a
              blank instance instead of returning to what was there. `hidden`
              keeps the component alive and off-screen instead; reappearing
              costs nothing because nothing was thrown away. */}
          {route === "services" && (
            <div hidden={!!selectedSalon}>
              <Rankings
                key={`${family ?? "all"}-${sub ?? ""}-${subGroup}`}
                initialFamily={family}
                initialSubService={sub}
                initialSubGroup={subGroup}
                onSelectSalon={openSalon}
              />
            </div>
          )}

          {selectedSalon ? (
            <SalonDetail
              salonId={selectedSalon}
              consistencyWindow={salonWindow ?? undefined}
              weights={salonWeights}
              onBack={() => setSelectedSalon(null)}
            />
          ) : route === "services" ? null
          : route === "auth" ? (
            <Auth
              mode={authMode}
              onSwitch={openAuth}
              onHome={() => go("home")}
              onSignedIn={(token, user, remember) => { auth.saveSession(token, user, remember); go("home"); }}
            />
          ) : route === "profile" ? (
            <Profile token={auth.token} onSignOut={() => { auth.clearSession(); go("home"); }} />
          ) : route === "contact" ? (
            <Contact token={auth.token} user={auth.user} onSurvey={() => go("survey")} />
          ) : route === "home" || route === "offers" || route === "ourservices" ? (
            <Landing
              onExplore={explore}
              scrollToOffers={route === "offers"}
              scrollToServices={route === "ourservices"}
            />
          ) : route === "favorites" ? (
            <Favorites
              onSelectSalon={(id) => openSalon(id)}
              onExplore={() => go("services")}
            />
          ) : route === "account" ? (
            /* Wired but unlinked: the dashboard is a signed-in surface, and
               there's no session yet. Point something at go("account") once
               auth lands and it works as-is. */
            <Dashboard onExplore={() => openAuth("signin")} />
          ) : route === "search" ? (
            <Lookup query={submittedQuery} onSelectSalon={(id) => openSalon(id)} />
          ) : route === "how" ? (
            <HowItWorks />
          ) : route === "survey" ? (
            <article className="survey-page">
              {/* The only way here is the "Rate your experience" card on
                  Contact, so Back returns there rather than to Home. */}
              <button type="button" className="btn-text back-link" onClick={() => go("contact")}>
                ← Back
              </button>
              <p className="eyebrow">Research</p>
              <h1 className="survey-title">Usability evaluation</h1>
              <p className="survey-lede">
                Please complete this after the tasks. Your answers are anonymous and
                saved for the study.
              </p>
              <SurveyChat />
            </article>
          ) : (
            <About onExplore={() => go("services")} />
          )}
        </main>
      </div>

      {!isAuth && (
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <img src={logoMark} alt="Amore Beauty" className="footer-logo" />
            <p className="footer-blurb">
              Your guide to the salons that suit you — for hair, nails, skin, bridal
              and grooming. Compare the best, matched to what matters most to you,
              and book with confidence.
            </p>
          </div>

          <div className="footer-col">
            <h4>Discover</h4>
            <ul>
              <li><button onClick={() => go("services")}>Find a Salon</button></li>
              <li><button onClick={() => go("services")}>Browse Services</button></li>
              <li><button onClick={() => go("how")}>How It Works</button></li>
              <li><button onClick={() => go("about")}>About Us</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Services</h4>
            <ul>
              {/* The same five categories, names and order as the Explore page. */}
              {DOMAINS.map(({ value, label }) => (
                <li key={value}><button onClick={() => go("services", value)}>{label}</button></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-legal">
          © 2026 Amore Beauty · Find the salon that suits you
        </div>
      </footer>
      )}

      {/* Chat bubble everywhere except sign-in and Contact (Contact shows the same chat inline). */}
      {!isAuth && route !== "contact" && route !== "survey" && <ChatWidget token={auth.token} user={auth.user} />}
    </div>
  );
}
