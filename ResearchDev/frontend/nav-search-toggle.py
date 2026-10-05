# -*- coding: utf-8 -*-
"""The nav search collapses to its icon and opens on click.

The field held ~220px of nav at all times for something used occasionally.
Now the icon is a button; clicking it grows the field and puts the cursor in
it. It closes again on Escape, or on clicking away, but NOT while it still
holds text — closing a box someone has typed into throws their work away, and
they have no way of knowing that is about to happen.

Three things this has to keep working:

  Cmd/Ctrl-K already focused the field. Focusing an input the CSS has
  collapsed to 0 width does nothing visible, so the shortcut now opens it
  first and focuses on the next frame — the input has to be laid out before
  focus will land on it.

  The <form> stays a form. Enter submitting a search is the browser doing it,
  not a handler, and swapping to a plain div to make the animation simpler
  would quietly cost that.

  Collapsed, the input is aria-hidden and taken out of the tab order.
  Otherwise it stays a tab stop with no visible box — the classic invisible
  focus trap — and screen readers announce a text field nobody can see.

Idempotent. Re-run after a revert:   python nav-search-toggle.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, 'src', 'App.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ App.jsx ════════════════════════════════════
s = io.open(APP, encoding='utf-8').read()
if 'searchOpen' in s:
    skipped.append('App.jsx')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'App expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    # ── state + the open helper ─────────────────────────────────
    sub("""  const searchRef = useRef(null);""",
        """  const searchRef = useRef(null);
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
  };""")

    # ── the shortcut opens before it focuses ────────────────────
    sub("""      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }""",
        """      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
      /* Escape closes it, but only when empty — see the click-away note. */
      if (e.key === "Escape" && !draftQuery) setSearchOpen(false);""")

    sub("""    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);""",
        """    window.addEventListener("keydown", onKey);
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
  }, [searchOpen, draftQuery]);""")

    # ── the markup ──────────────────────────────────────────────
    sub("""            <form className="nav-search" onSubmit={handleSearch} role="search">
              <svg
                className="nav-search-icon"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" strokeLinecap="round" />
              </svg>

              <input
                ref={searchRef}
                type="search"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="Search salons…"
                aria-label="Search salons by name"
              />""",
        """            {/* Still a form: Enter submitting is the browser's doing, and a
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
                <svg
                  className="nav-search-icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5 14 14" strokeLinecap="round" />
                </svg>
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
              />""")

    assert s.count('searchOpen') >= 8
    io.open(APP, 'w', encoding='utf-8').write(s)
    done.append('App.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.nav-search-toggle' in s:
    skipped.append('index.css')
else:
    def csub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'CSS expected %d got %d: %r' % (cnt, n, old[:70])
        s = s.replace(old, new)

    csub(""".nav-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: auto;
  min-width: 220px;
  padding: 0 0 0.35rem 0.65rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(26, 24, 21, 0.18);
  border-radius: 0;
  transition: border-color 0.2s var(--ease);
}
.nav-search:hover { border-bottom-color: var(--gold-300); }
.nav-search:focus-within {
  border-bottom-color: var(--gold);
}

.nav-search-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;""",
         """/* Collapsed to its icon until asked for. The rule under it is drawn only
   when open — a 20px underline beside an icon reads as a rendering fault,
   not as a closed field. */
.nav-search {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  padding: 0 0 0.35rem 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  border-radius: 0;
  transition: border-color 0.25s var(--ease), gap 0.3s var(--ease),
              padding 0.3s var(--ease);
}
.nav-search.is-open {
  gap: 0.5rem;
  padding-left: 0.65rem;
  border-bottom-color: rgba(26, 24, 21, 0.18);
}
.nav-search.is-open:hover { border-bottom-color: var(--gold-300); }
.nav-search.is-open:focus-within { border-bottom-color: var(--gold); }

/* The icon is the control now, so it needs a real target — 14px of SVG is
   under any sane minimum. The padding does that without changing how it
   looks, and the negative margin keeps the row from growing. */
.nav-search-toggle {
  display: grid;
  place-items: center;
  padding: 0.5rem;
  margin: -0.5rem;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

.nav-search-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;""")

    csub(""".nav-search:hover .nav-search-icon,
.nav-search:focus-within .nav-search-icon { color: var(--gold-600); }""",
         """.nav-search:hover .nav-search-icon,
.nav-search:focus-within .nav-search-icon { color: var(--gold-600); }""")

    csub("""/* Bare input — the wrapper draws the rule and the focus state. */
.nav-search input[type="search"] {
  flex: 1;
  min-width: 0;""",
         """/* Bare input — the wrapper draws the rule and the focus state.

   Width, not display:none: a box that is removed cannot be animated, and it
   cannot be focused on the frame the shortcut opens it. It stays in the
   layout at zero width instead. */
.nav-search input[type="search"] {
  width: 0;
  opacity: 0;
  flex: 0 1 auto;
  min-width: 0;
  transition: width 0.32s var(--ease), opacity 0.22s var(--ease);""")

    csub(""".nav-search input[type="search"]::placeholder { color: var(--ink-600); }""",
         """.nav-search.is-open input[type="search"] {
  width: clamp(9rem, 15vw, 13rem);
  opacity: 1;
}
.nav-search input[type="search"]::placeholder { color: var(--ink-600); }""")

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
