# -*- coding: utf-8 -*-
"""1. openNow (boolean) becomes availability (any | open | closed).
   2. The services panel takes the same glass as the filter menus.
   3. The hero blur stops well short of the picture.
   4. The old DistanceSelect is gone, replaced by the shared SelectMenu.

Idempotent. Re-run after a revert:   python polish-explore11.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
RK = os.path.join(ROOT, 'src', 'screens', 'Rankings.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
OLD_DS = os.path.join(ROOT, 'src', 'components', 'DistanceSelect.jsx')
done, skipped = [], []

# ══ 1. Rankings: tri-state availability ═════════════════════════
s = io.open(RK, encoding='utf-8').read()
if 'availability' in s:
    skipped.append('Rankings.jsx')
else:
    assert s.count('  openNow: true,') == 1, 'default not found'
    s = s.replace("  openNow: true,",
                  """  /* "any", not "open": a filter that hides most of the results before the
     visitor has asked for anything is the wrong first impression. */
  availability: "any",""")

    assert s.count("          open_now: filters.openNow,") == 1, 'payload not found'
    s = s.replace("          open_now: filters.openNow,",
                  """          /* The API takes a boolean, so "any" is the ABSENCE of the
             filter rather than a third value it would not understand. */
          open_now: filters.availability === "any"
            ? undefined
            : filters.availability === "open",""")

    # the plain-language summary
    old_sum = """    f.openNow ? "open now" : null,"""
    if old_sum in s:
        s = s.replace(old_sum,
                      """    { any: null, open: "open now", closed: "closed now" }[f.availability],""")

    assert 'openNow' not in s, 'openNow still referenced'
    io.open(RK, 'w', encoding='utf-8').write(s)
    done.append('Rankings.jsx')

# ══ 2 + 3. CSS ══════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
changed = False

OLD_PANEL = """  border-radius: var(--radius-panel);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(26px) saturate(150%);
  -webkit-backdrop-filter: blur(26px) saturate(150%);
  box-shadow:
    inset 0 0 0 1px rgba(22, 21, 15, 0.06),
    0 20px 44px -18px rgba(22, 21, 15, 0.28);
  animation: svcbarIn 0.16s var(--ease) both;"""
if OLD_PANEL in s:
    s = s.replace(OLD_PANEL, """  border-radius: var(--radius-panel);
  /* The same glass as the filter menus: a thinner tint so the page shows
     through, and the two-rim pair — a bright inner one for dark grounds, a
     faint ink hairline for pale ones. It was 0.9 white with only the ink
     rim, which is a white card, not a pane. */
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(26px) saturate(160%);
  -webkit-backdrop-filter: blur(26px) saturate(160%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.7),
    0 0 0 1px rgba(22, 21, 15, 0.06),
    0 20px 44px -18px rgba(22, 21, 15, 0.28);
  animation: svcbarIn 0.16s var(--ease) both;""")
    changed = True

OLD_MASK = """  -webkit-mask-image: linear-gradient(90deg,
    #000 0%, #000 22%, rgba(0, 0, 0, 0.55) 40%, transparent 58%);
  mask-image: linear-gradient(90deg,
    #000 0%, #000 22%, rgba(0, 0, 0, 0.55) 40%, transparent 58%);"""
if OLD_MASK in s:
    s = s.replace(OLD_MASK, """  /* Gone by 42%, not 58%. The blur exists to give the copy a ground, and
     the copy stops well before the middle — carrying it to 58% softened a
     sixth of the photograph for nothing. The picture side is now untouched. */
  -webkit-mask-image: linear-gradient(90deg,
    #000 0%, #000 16%, rgba(0, 0, 0, 0.5) 30%, transparent 42%);
  mask-image: linear-gradient(90deg,
    #000 0%, #000 16%, rgba(0, 0, 0, 0.5) 30%, transparent 42%);""")
    changed = True

if changed:
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')
else:
    skipped.append('index.css')

# ══ 4. The single-purpose component is superseded ═══════════════
if os.path.exists(OLD_DS):
    os.remove(OLD_DS)
    done.append('DistanceSelect.jsx (deleted)')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
