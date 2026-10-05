# -*- coding: utf-8 -*-
"""Contact becomes its own page, laid out like the reference.

Idempotent. Re-run after a revert:   python contact-page.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, 'src', 'App.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ Routing: contact stops being a scroll target ════════════════
s = io.open(APP, encoding='utf-8').read()
if 'screens/Contact' in s:
    skipped.append('App.jsx')
else:
    s = s.replace('import { Auth } from "./screens/Auth";',
                  'import { Auth } from "./screens/Auth";\nimport { Contact } from "./screens/Contact";')

    # It was a section of the landing page reached by scrolling; it has a
    # page of its own now, so the landing route no longer answers for it.
    old = """  const isLanding = (route === "home" || route === "contact" || route === "offers") && !selectedSalon;"""
    assert s.count(old) == 1, 'isLanding not found'
    s = s.replace(old, """  const isLanding = (route === "home" || route === "offers") && !selectedSalon;""")

    old2 = """          ) : route === "home" || route === "contact" || route === "offers" ? ("""
    assert s.count(old2) == 1, 'landing branch not found'
    s = s.replace(old2, """          ) : route === "contact" ? (
            <Contact />
          ) : route === "home" || route === "offers" ? (""")

    s = s.replace("""              scrollToContact={route === "contact"}\n""", "")
    assert 'scrollToContact' not in s, 'prop still passed'
    io.open(APP, 'w', encoding='utf-8').write(s)
    done.append('App.jsx')

# ══ Styling ═════════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
MARK = '/* -- Contact page -- */'
if MARK in s:
    skipped.append('index.css')
else:
    anchor = "/* ── Footer ───"
    assert s.count(anchor) == 1, 'anchor missing'

    BLOCK = MARK + """
.contactpage { padding: 0 0 4rem; }

/* ── Opening ───────────────────────────────────────────────
   A headline crossing from a white plate onto a photograph. The plate is a
   real element rather than a shadow on the image, because the type has to sit
   on it — that is what lets the line change colour halfway across. */
.cp-hero {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: center;
  padding: clamp(1.5rem, 4vw, 3.5rem) var(--gutter) clamp(2rem, 5vw, 4rem);
}
/* Rotated, and IN the flow: an absolutely placed label would ride over the
   headline the moment the window narrowed. */
.cp-hero-rail {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  justify-self: start;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.66rem;
  letter-spacing: var(--track-eyebrow);
  text-transform: uppercase;
  color: var(--muted);
  margin: 0;
}
.cp-hero-rail::after {
  content: "";
  width: 1px;
  height: 4rem;
  background: var(--gold-300);
}

.cp-hero-stage { position: relative; min-height: clamp(16rem, 30vw, 24rem); }
/* The white card the first half of the line sits on. */
.cp-hero-plate {
  position: absolute;
  left: 0;
  top: 8%;
  width: 46%;
  height: 62%;
  background: var(--card);
  border-radius: var(--radius-panel);
  box-shadow: var(--sh);
}
.cp-hero-media {
  position: relative;
  margin: 0 0 0 auto;
  width: 72%;
  aspect-ratio: 16 / 11;
  border-radius: var(--radius-panel);
  overflow: hidden;
  background: var(--surface);
}
.cp-hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cp-hero-title {
  position: absolute;
  left: 0;
  right: 8%;
  top: 26%;
  margin: 0;
  font-size: clamp(1.9rem, 5vw, 3.6rem);
  line-height: 1.1;
  letter-spacing: var(--track-display);
  text-align: center;
}
/* Two halves, two grounds. Splitting the colour is the only way one line can
   stay legible across both a white card and a photograph. */
.cp-on-plate { color: var(--ink); }
.cp-on-photo { color: #fff; text-shadow: 0 1px 12px rgba(22, 21, 15, 0.4); }

/* ── Body: card, details, and a picture bleeding in ────────── */
.cp-body {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.75fr);
  gap: clamp(1.5rem, 4vw, 4rem);
  align-items: start;
  padding: 0 var(--gutter);
  max-width: 1180px;
  margin: 0 auto;
}
/* Runs off the left edge, behind the card. Hidden below the two-column
   breakpoint: with one column there is no margin for it to bleed into. */
.cp-aside {
  position: absolute;
  left: calc(-1 * var(--gutter));
  bottom: -2rem;
  width: 15rem;
  aspect-ratio: 3 / 4;
  margin: 0;
  border-radius: 0 var(--radius-panel) var(--radius-panel) 0;
  overflow: hidden;
  z-index: 0;
}
.cp-aside img { width: 100%; height: 100%; object-fit: cover; display: block; }

.cp-card {
  position: relative;
  z-index: 1;
  background: var(--card);
  border-radius: var(--radius-panel);
  box-shadow: var(--sh-lg);
  padding: clamp(1.6rem, 3.5vw, 3rem);
}
.cp-card-title {
  font-size: clamp(1.25rem, 2.2vw, 1.6rem);
  margin-bottom: 0.4rem;
}
.cp-card-sub {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.6;
  max-width: 34ch;
  margin-bottom: 2rem;
}

.cp-form { display: flex; flex-direction: column; gap: 1.5rem; }
/* Ruled, not boxed. Five fields of drawn boxes carry more weight than the
   five short answers inside them. */
.cp-field { display: flex; flex-direction: column-reverse; gap: 0.3rem; }
.cp-field span {
  font-size: 0.72rem;
  color: var(--muted);
  transition: color 0.18s var(--ease);
}
/* column-reverse puts the label under its field in the SOURCE order the
   reference shows, while the input still comes first for a screen reader. */
.cp-field input,
.cp-field select,
.cp-field textarea {
  width: 100%;
  padding: 0.5rem 0 0.55rem;
  font: inherit;
  font-size: 0.95rem;
  color: var(--ink);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  transition: border-color 0.2s var(--ease);
}
.cp-field textarea { resize: vertical; line-height: 1.6; }
.cp-field input:hover,
.cp-field select:hover,
.cp-field textarea:hover { border-bottom-color: var(--muted); }
/* The rule IS the focus indicator. The global ring draws a box with a corner
   radius around a field that has neither. */
.cp-field input:focus-visible,
.cp-field select:focus-visible,
.cp-field textarea:focus-visible {
  outline: none;
  box-shadow: none;
  border-bottom-color: var(--gold);
}
.cp-field:focus-within span { color: var(--ink); }

/* Outlined and sized to its label, as in the reference — the card is already
   the loudest thing on the page and does not need a filled button in it. */
.cp-send {
  align-self: flex-end;
  margin-top: 0.5rem;
  padding: 0.8rem 1.6rem;
  background: none;
  border: 1px solid var(--ink);
  border-radius: 0;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink);
  transition: background 0.18s var(--ease), color 0.18s var(--ease);
}
.cp-send:hover { background: var(--ink); color: #fff; }

.cp-done { text-align: center; padding: 2rem 0; }
.cp-done h2 { font-size: 1.3rem; margin-bottom: 0.5rem; }
.cp-done p { color: var(--muted); line-height: 1.7; margin-bottom: 1.25rem; }

/* ── Details column ────────────────────────────────────────── */
.cp-details { padding-top: clamp(1rem, 3vw, 2.5rem); }
.cp-details-name {
  font-size: clamp(1.25rem, 2.2vw, 1.6rem);
  margin-bottom: 1.5rem;
}
.cp-block { margin-bottom: 1.35rem; }
.cp-block h3 {
  font-family: var(--font-text);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 0.25rem;
}
.cp-block p { font-size: 0.88rem; line-height: 1.65; color: var(--body); }
.cp-block a { color: var(--gold); text-decoration: underline; text-underline-offset: 2px; }
.cp-block a:hover { color: var(--gold-600); }
.cp-hours { font-style: italic; }

.cp-social { display: flex; gap: 0.6rem; margin: 1.5rem 0; }
.cp-social a {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink-600);
  transition: background 0.16s var(--ease), color 0.16s var(--ease);
}
.cp-social a:hover { background: var(--ink); color: #fff; }

.cp-meta { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.cp-meta li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.78rem;
  color: var(--muted);
}
.cp-meta span { display: grid; place-items: center; color: var(--gold); }

@media (max-width: 900px) {
  .cp-body { grid-template-columns: 1fr; }
  /* No margin left to bleed into once the card is full width. */
  .cp-aside { display: none; }
  .cp-hero { grid-template-columns: 1fr; }
  .cp-hero-rail { display: none; }
  .cp-hero-media { width: 100%; }
  .cp-hero-plate { display: none; }
  /* With the plate gone the whole line sits on the photograph. */
  .cp-on-plate { color: #fff; text-shadow: 0 1px 12px rgba(22, 21, 15, 0.4); }
}

"""
    s = s.replace(anchor, BLOCK + anchor)
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
