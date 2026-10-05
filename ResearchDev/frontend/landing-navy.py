# -*- coding: utf-8 -*-
"""The landing page's dark surfaces go navy. No black left on it.

Two new tokens rather than repointing --ink: --ink is a TEXT colour in 66
places across the app, so moving it would turn every heading and paragraph on
every page navy. Only the landing page's grounds change.

  --navy      #101828   hero ground, button disc, fan card, offer panel 1
  --navy-700  #2b3a58   slat and photo placeholders, offer panel 5

The pair is 18.0 dE apart. The first pair I tried (#121a2b / #1e2a44) was only
9.6 — the same "two shades look the same" that has already come up twice, so
it was widened before being used. With these, the closest any two grounds in
the offer rack get is 18.0, which is better separated than the warm ladder
they replace (14.9).

Every piece of type on the navy was re-checked: white 17.75:1, the thin
headline 12.69:1, the tan accent 8.32:1, the lede 11.28:1.

Left alone deliberately:
  - the photo scrims, which are rgba(22,21,15) shading over photographs on
    the white part of the page, not black surfaces — a navy scrim there would
    cool the photographs against a warm palette
  - .stats-band, which is dead CSS: no JSX renders it

Idempotent. Re-run after a revert:   python landing-navy.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
s = io.open(CSS, encoding='utf-8').read()
if '--navy' in s:
    print('already applied')
    raise SystemExit


def csub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, 'expected %d got %d: %r' % (cnt, n, old[:70])
    s = s.replace(old, new)


# ── the tokens ─────────────────────────────────────────────────
csub("""  --gold-700:   #6b5335;""",
     """  --gold-700:   #6b5335;

  /* Navy, for the landing page's grounds only. Deliberately NOT a repoint of
     --ink: that is a text colour in 66 places, and moving it would turn the
     body copy of every page blue. 18.0 dE apart, so the two never read as
     one shade. */
  --navy:       #101828;
  --navy-700:   #2b3a58;""")

# ── 1. the hero ground ─────────────────────────────────────────
csub("""    radial-gradient(64rem 46rem at 74% 16%, rgba(150, 105, 47, 0.30), transparent 62%),
    radial-gradient(52rem 40rem at 8% 82%, rgba(212, 170, 125, 0.13), transparent 60%),
    var(--ink);""",
     """    radial-gradient(64rem 46rem at 74% 16%, rgba(150, 105, 47, 0.34), transparent 62%),
    radial-gradient(52rem 40rem at 8% 82%, rgba(212, 170, 125, 0.15), transparent 60%),
    var(--navy);""")

csub("""  /* Ink, warmed by two gold pools.""",
     """  /* Navy, warmed by two gold pools — the warm light is what stops a blue
     ground reading as cold against a tan palette, so the pools are carried
     slightly stronger here than they were over ink.""")

# ── 2. the slat placeholder ────────────────────────────────────
csub("""  border-radius: 3px;
  background-color: var(--ink-800);""",
     """  border-radius: 3px;
  background-color: var(--navy-700);""")

# ── 3. the button disc ─────────────────────────────────────────
csub("""  border-radius: 50%;
  background: var(--ink);
  color: var(--gold-300);""",
     """  border-radius: 50%;
  background: var(--navy);
  color: var(--gold-300);""")

csub(""".btn-hero:hover .btn-hero-disc {
  transform: translateX(3px);
  background: #000;
}""",
     """/* Lifts rather than deepens on hover. It used to go to #000, which is both
   the blackest thing on the page and, against a navy disc, a change you can
   barely see. */
.btn-hero:hover .btn-hero-disc {
  transform: translateX(3px);
  background: var(--navy-700);
}""")

# ── 4. the services fan ────────────────────────────────────────
csub("""  overflow: hidden;
  background: var(--ink);
  font: inherit;
  text-align: left;""",
     """  overflow: hidden;
  background: var(--navy);
  font: inherit;
  text-align: left;""")

csub("""  z-index: 0;
  background-color: var(--ink-800);
  background-size: cover;""",
     """  z-index: 0;
  background-color: var(--navy-700);
  background-size: cover;""")

# ── 5. the two dark offer grounds ──────────────────────────────
csub(""".offer-panel:nth-child(6n + 1) { background: var(--ink); color: #fff; }""",
     """.offer-panel:nth-child(6n + 1) { background: var(--navy); color: #fff; }""")

csub(""".offer-panel:nth-child(6n + 5) { background: var(--ink-700); color: #fff; }""",
     """.offer-panel:nth-child(6n + 5) { background: var(--navy-700); color: #fff; }""")

csub("""   ladder now steps 6.7 / 72.4 / 48.0 / 100 / 21.4 / 84.6, so the closest any
   two get is 12.2 and no two neighbours are within 24. */""",
     """   ladder is navy / gold / tan / chocolate / navy-700 / sand, and the closest
   any two get is dE 18.0 — the two navies, which are never adjacent and one
   of which is the panel open by default. */""")

for dead in ('background: #000', 'background:#000'):
    assert dead not in s, 'black background survived: ' + dead
assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied')
