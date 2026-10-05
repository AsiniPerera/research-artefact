# -*- coding: utf-8 -*-
"""Distance becomes a glass listbox instead of a native <select>.

Idempotent. Re-run after a revert:   python polish-explore7.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
QF = os.path.join(ROOT, 'src', 'components', 'QuickFilters.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ QuickFilters swaps the select for the listbox ═══════════════
s = io.open(QF, encoding='utf-8').read()
if 'DistanceSelect' in s:
    skipped.append('QuickFilters.jsx')
else:
    OLD = """      <label className="qf-field">
        <span className="qf-field-label">Distance</span>
        <select
          value={filters.maxDistance}
          onChange={(e) => onChange({ ...filters, maxDistance: Number(e.target.value) })}
          aria-label="Maximum distance"
        >
          {DISTANCE_STEPS.map((km) => (
            <option key={km} value={km}>{km} km</option>
          ))}
        </select>
      </label>"""
    assert s.count(OLD) == 1, 'distance block not found'
    s = s.replace(OLD, """      <DistanceSelect
        value={filters.maxDistance}
        onChange={(km) => onChange({ ...filters, maxDistance: km })}
      />""")

    s = s.replace('import { IconClock } from "./Icons";',
                  'import { IconClock } from "./Icons";\nimport { DistanceSelect } from "./DistanceSelect";')
    # DISTANCE_STEPS moved into the new component
    s = s.replace('import { DISTANCE_STEPS, GENDERS } from "../constants/taxonomy";',
                  'import { GENDERS } from "../constants/taxonomy";')
    assert 'DISTANCE_STEPS' not in s, 'stale import'
    io.open(QF, 'w', encoding='utf-8').write(s)
    done.append('QuickFilters.jsx')

# ══ CSS ═════════════════════════════════════════════════════════
s = io.open(CSS, encoding='utf-8').read()
MARK = '/* -- distance listbox -- */'
if MARK in s:
    skipped.append('index.css')
else:
    anchor = '.qf-clear {'
    assert s.count(anchor) == 1, 'anchor missing'
    BLOCK = MARK + """

/* The button inside the pill. It carries no surface of its own — the pill is
   the surface — so it is only type and a caret. */
.qf-select { position: relative; }
.qf-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}
.qf-select-btn:focus-visible { outline: none; box-shadow: none; }
.qf-select-caret {
  display: grid;
  place-items: center;
  color: var(--muted);
  transition: transform 0.18s var(--ease), color 0.18s var(--ease);
}
.qf-select-btn[aria-expanded="true"] .qf-select-caret {
  transform: rotate(180deg);
  color: var(--ink);
}

/* The panel a native select could never give us: the same glass as the pill
   it drops from, with a rim that works on either ground. */
.qf-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  z-index: 40;
  min-width: 100%;
  max-height: 15rem;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.7),
    0 0 0 1px rgba(22, 21, 15, 0.06),
    0 14px 32px -12px rgba(22, 21, 15, 0.28);
  animation: qfMenuIn 0.14s var(--ease) both;
}
@keyframes qfMenuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
.qf-opt {
  padding: 0.42rem 0.75rem;
  border-radius: calc(var(--radius) - 5px);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--body);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s var(--ease), color 0.12s var(--ease);
}
/* Two states, deliberately different: is-active is where the keyboard is,
   is-on is what is actually chosen. A menu that shows only one of them
   leaves you arrowing blind or unable to see your own setting. */
.qf-opt.is-active { background: rgba(22, 21, 15, 0.06); color: var(--ink); }
.qf-opt.is-on { color: var(--ink); font-weight: 700; }
.qf-opt.is-on.is-active { background: var(--slate); color: #fff; }

"""
    s = s.replace(anchor, BLOCK + anchor, 1)
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
