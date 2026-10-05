# -*- coding: utf-8 -*-
"""1. CLEAR ALL actually renders at the size it was given.
   2. Usability: the page says when its results have gone stale, and warns
      about the location prompt before it fires.

Idempotent. Re-run after a revert:   python polish-explore12.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
RK = os.path.join(ROOT, 'src', 'screens', 'Rankings.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ 1. Cascade: .btn-text was winning ═══════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.quick-filters .qf-clear {' in s:
    skipped.append('index.css (clear)')
else:
    OLD = """/* Smaller than the pills it clears. It is an escape hatch, not a filter,
   and at the same size it competed with the controls for attention. */
.qf-clear {"""
    assert s.count(OLD) == 1, 'qf-clear rule not found'
    s = s.replace(OLD, """/* Smaller than the pills it clears. It is an escape hatch, not a filter,
   and at the same size it competed with the controls for attention.

   Scoped through .quick-filters for SPECIFICITY, not for tidiness: .btn-text
   sets font-size 0.72rem and sits 117 lines further down this file, so a bare
   .qf-clear ties on specificity and loses on order. The rail's RESET escaped
   the same fate only because its selector happens to carry three classes. */
.quick-filters .qf-clear {""")
    s = s.replace(""".qf-clear--idle { visibility: hidden; pointer-events: none; }""",
                  """.quick-filters .qf-clear--idle { visibility: hidden; pointer-events: none; }""")
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css (clear)')

# ══ 2. Stale results + location warning ═════════════════════════
s = io.open(RK, encoding='utf-8').read()
if 'rankedSig' in s:
    skipped.append('Rankings.jsx')
else:
    s = s.replace("""  const [geoError, setGeoError] = useState(null);""",
                  """  const [geoError, setGeoError] = useState(null);
  /* What the visible results were actually ranked FOR. Filters and weights
     can be changed after a ranking, and the list underneath does not follow
     — so the page has to admit when what you are reading no longer answers
     what the controls now say. */
  const [rankedSig, setRankedSig] = useState(null);""")

    s = s.replace("""  function handleSubmit(e) {
    e.preventDefault();
    setGeoError(null);""",
                  """  const querySig = JSON.stringify({ filters, weights });
  const stale = rankedSig !== null && rankedSig !== querySig;

  function handleSubmit(e) {
    e.preventDefault();
    setGeoError(null);
    /* Captured now, not in the callback: by the time geolocation answers the
       visitor may already have moved another slider. */
    const sig = querySig;""")

    s = s.replace("""          user_weights: weights,
        });
      },""",
                  """          user_weights: weights,
        });
        setRankedSig(sig);
      },""")

    s = s.replace("""              {/* Every category now sits at Low or above, so there is no
                  all-zero state left to guard against. */}
              <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                Rank Salons
              </button>""",
                  """              {/* Every category now sits at Low or above, so there is no
                  all-zero state left to guard against. */}
              <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                {stale ? "Update ranking" : "Rank Salons"}
              </button>

              {/* Two different things to say in one slot, and never both:
                  that the list has fallen behind the controls, or — before
                  there is any list — that pressing this asks the browser for
                  your location. The second is the more useful warning right
                  up until the moment it stops being true. */}
              <p className="rank-note">
                {stale
                  ? "Filters changed \\u2014 the list below is from the last ranking."
                  : "Uses your location to rank by distance."}
              </p>""")

    assert s.count('rankedSig') == 3 and 'stale' in s
    io.open(RK, 'w', encoding='utf-8').write(s)
    done.append('Rankings.jsx')

# ══ 3. The note ═════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
if '.rank-note' in s:
    skipped.append('index.css (note)')
else:
    anchor = """.sidebar-foot {"""
    assert s.count(anchor) == 1
    s = s.replace(anchor, """/* Under the button, quiet enough to be read once and then ignored. */
.rank-note {
  margin-top: 0.55rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: var(--muted);
  text-align: center;
}

""" + anchor)
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css (note)')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
