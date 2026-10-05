# -*- coding: utf-8 -*-
"""The four nav icons become one set.

The search glyph was not on the same grid as the other three. They come from
Icons.jsx — a 24 viewBox at strokeWidth 1.5, rendered at 18px, so their lines
land at 1.125px on screen. The search was a hand-rolled SVG on a 16 viewBox
at 14px, which puts its lines at 1.31px. Smaller AND heavier: two different
kinds of wrong at once, which is why it reads as not belonging.

Patching the numbers would fix today and drift again the next time anything
changes, so it moves onto the shared system instead — IconSearch, same base(),
same 24 grid, same 18px as its neighbours.

The vertical alignment goes with it. The form carried `padding-bottom` and a
border to draw the field's underline, which lifted its contents above a 38px
.nav-icon-btn that centres its glyph. The underline moves onto the input,
where it belongs, and the toggle takes the same 38x38 box as its neighbours.

Colour moves to the button too: the SVG strokes with currentColor, so the
.nav-search-icon class has nothing left to do and goes.

Idempotent. Re-run after a revert:   python nav-icons-align.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(ROOT, 'src', 'components', 'Icons.jsx')
APP = os.path.join(ROOT, 'src', 'App.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══════════════════ Icons.jsx ══════════════════════════════════
s = io.open(ICONS, encoding='utf-8').read()
if 'IconSearch' in s:
    skipped.append('Icons.jsx')
else:
    old = """export function IconHeart({ size = 16, filled = false }) {"""
    assert s.count(old) == 1, 'IconHeart not found'
    s = s.replace(old, """/* Drawn on the same 24 grid as the rest, so it carries the same stroke
   weight at the same size. The nav's own version was a 16-grid SVG at 14px,
   which put its lines a fifth heavier than its neighbours'. */
export function IconSearch({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8 21 21" />
    </svg>
  );
}

export function IconHeart({ size = 16, filled = false }) {""")
    io.open(ICONS, 'w', encoding='utf-8').write(s)
    done.append('Icons.jsx')

# ══════════════════ App.jsx ════════════════════════════════════
s = io.open(APP, encoding='utf-8').read()
if 'IconSearch' in s:
    skipped.append('App.jsx')
else:
    s = s.replace('import { IconHeart } from "./components/Icons";',
                  'import { IconHeart, IconSearch } from "./components/Icons";')

    old_svg = """                <svg
                  className="nav-search-icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5 14 14" strokeLinecap="round" />
                </svg>"""
    assert s.count(old_svg) == 1, 'nav search svg not found'
    s = s.replace(old_svg, """                {/* 18, like the heart, the bell and the account glyph. */}
                <IconSearch size={18} />""")

    # the drawer's copy, for the same reason
    old_drawer = """            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5 14 14" strokeLinecap="round" />
            </svg>"""
    if s.count(old_drawer) == 1:
        s = s.replace(old_drawer, """            <IconSearch size={16} />""")

    assert 'viewBox="0 0 16 16"' not in s, 'a 16-grid search svg survived'
    io.open(APP, 'w', encoding='utf-8').write(s)
    done.append('App.jsx')

# ══════════════════ index.css ══════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if 'width: 38px;\n  height: 38px;\n  padding: 0;' in s:
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
.nav-search.is-open:focus-within { border-bottom-color: var(--gold); }""",
         """/* The form keeps no box of its own. The padding and border it used to have
   were only there to draw the field's underline, and both lifted the icon
   above the other three — a 38px .nav-icon-btn centres its glyph, a form
   with bottom padding does not. The underline belongs on the input anyway:
   it is the text field that is underlined, not the row. */
.nav-search {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  padding: 0;
  background: transparent;
  border: none;
  transition: gap 0.3s var(--ease);
}
.nav-search.is-open { gap: 0.4rem; }""")

    csub("""/* The icon is the control now, so it needs a real target — 14px of SVG is
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
}""",
         """/* The same 38x38 box as .nav-icon-btn, so all four sit on one centre line
   and share one hit area. Colour lives here rather than on the glyph: the
   SVG strokes with currentColor and inherits it. */
.nav-search-toggle {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: none;
  color: var(--ink-700);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease);
}
.nav-search-toggle:hover { background: var(--gold-50); color: var(--gold-600); }
.nav-search:focus-within .nav-search-toggle { color: var(--gold-600); }""")

    # the glyph class has nothing left to do
    a = s.index(""".nav-search-icon {""")
    b = s.index(""".nav-search:hover .nav-search-icon,""")
    b = s.index('\n', s.index('color: var(--gold-600); }', b)) + 1
    s = s[:a] + s[b:]

    csub("""  transition: width 0.32s var(--ease), opacity 0.22s var(--ease);""",
         """  padding-bottom: 0.3rem;
  border-bottom: 1px solid transparent;
  transition: width 0.32s var(--ease), opacity 0.22s var(--ease),
              border-color 0.2s var(--ease);""")

    csub(""".nav-search.is-open input[type="search"] {
  width: clamp(9rem, 15vw, 13rem);
  opacity: 1;
}""",
         """.nav-search.is-open input[type="search"] {
  width: clamp(9rem, 15vw, 13rem);
  opacity: 1;
  border-bottom-color: rgba(26, 24, 21, 0.18);
}
.nav-search.is-open:hover input[type="search"] { border-bottom-color: var(--gold-300); }
.nav-search.is-open:focus-within input[type="search"] { border-bottom-color: var(--gold); }""")

    assert '.nav-search-icon' not in s, 'glyph class survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
