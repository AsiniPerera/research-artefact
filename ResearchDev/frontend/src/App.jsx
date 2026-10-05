import { useState, useEffect, useRef } from "react";
import logoMark from "./assets/images/logo/logo-mark.png";
import { AccountMenu } from "./components/AccountMenu";
import { NotificationsMenu } from "./components/NotificationsMenu";
import { IconHeart, IconSearch } from "./components/Icons";
import { useFavorites } from "./hooks/useFavorites";
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

const NAV = [
  { key: "home",        label: "Home" },
  { key: "ourservices", label: "Services" },
  { key: "services",    label: "Explore" },
  { key: "offers",      label: "Offers & Promotions" },
  { key: "about",       label: "About" },
  { key: "contact",     label: "Contact" },
];


export default function App() {
  const [route, setRoute] = useState("home");
  const [selectedSalon, setSelectedSalon] = useState(null);
  /* Seeded by the services bar when a specific service is picked, so the
     ranking opens on that service rather than just its domain. */
  const [sub, setSub] = useState(null);
  // Set when a service card sends you to the ranking pre-filtered.
  const [family, setFamily] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [draftQuery, setDraftQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
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


  function go(next, nextFamily = null, nextSub = null) {
    setRoute(next);
    setFamily(nextFamily);
    setSub(nextSub);
    setSelectedSalon(null);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }

  // The landing's CTAs: no argument means "go rank something".
  function explore(target = "services", nextFamily = null) {
    go(target, nextFamily);
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
        <nav className={`nav ${isLanding ? "nav--landing" : ""} ${scrolled ? "nav--scrolled" : ""}`}>
          <button
            className="nav-brand"
            onClick={() => go("home")}
            aria-label="Amore Beauty — home"
          >
            <img src={logoMark} alt="Amore Beauty" className="nav-logo" />
          </button>

          <div className="nav-links">
            {NAV.map(({ key, label }) => (
              <button
                key={key}
                className={`nav-link ${route === key ? "nav-link--active" : ""}`}
                onClick={() => go(key)}
                aria-current={route === key ? "page" : undefined}
              >
                {label}
              </button>
            ))}
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

              <AccountMenu onAuth={openAuth} />
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
        </nav>

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

          <button
            className="btn-hero nav-drawer-cta"
            onClick={() => openAuth("signin")}
            tabIndex={menuOpen ? 0 : -1}
          >
            Sign In
          </button>
        </aside>

        <main className={`page ${isLanding || isAuth || isServices ? "page--flush" : ""}`}>
          {selectedSalon ? (
            <SalonDetail salonId={selectedSalon} onBack={() => setSelectedSalon(null)} />
          ) : route === "auth" ? (
            <Auth mode={authMode} onSwitch={openAuth} onHome={() => go("home")} />
          ) : route === "contact" ? (
            <Contact />
          ) : route === "home" || route === "offers" || route === "ourservices" ? (
            <Landing
              onExplore={explore}
              scrollToOffers={route === "offers"}
              scrollToServices={route === "ourservices"}
            />
          ) : route === "services" ? (
            /* Remount on family change so a card's choice seeds the filters. */
            <Rankings
              key={`${family ?? "all"}-${sub ?? ""}`}
              initialFamily={family}
              initialSubService={sub}
              onSelectSalon={setSelectedSalon}
            />
          ) : route === "favorites" ? (
            <Favorites
              onSelectSalon={setSelectedSalon}
              onExplore={() => go("services")}
            />
          ) : route === "account" ? (
            /* Wired but unlinked: the dashboard is a signed-in surface, and
               there's no session yet. Point something at go("account") once
               auth lands and it works as-is. */
            <Dashboard onExplore={() => openAuth("signin")} />
          ) : route === "search" ? (
            <Lookup query={submittedQuery} />
          ) : route === "how" ? (
            <HowItWorks />
          ) : (
            <About />
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
              <li><button onClick={() => go("services", "hair")}>Hair</button></li>
              <li><button onClick={() => go("services", "makeup_bridal")}>Bridal &amp; Makeup</button></li>
              <li><button onClick={() => go("services", "nails")}>Nails</button></li>
              <li><button onClick={() => go("services", "skin_beauty")}>Skin &amp; Beauty</button></li>
              <li><button onClick={() => go("services", "barber_grooming")}>Barber &amp; Grooming</button></li>
            </ul>
          </div>
        </div>

        <div className="footer-legal">
          © 2026 Amore Beauty · Find the salon that suits you
        </div>
      </footer>
      )}
    </div>
  );
}
