# -*- coding: utf-8 -*-
"""Explore page, second pass on the sidebar layout.

  1. The service bar moves INTO the results column. Full-width above the grid
     it ran under the sticky sidebar, whose backdrop-filter creates a
     stacking context and painted over its left half -- hiding the SERVICES
     label and leaving the tabs looking orphaned mid-page.
  2. The page's ambient wash goes. At this size it renders as two soft blobs
     behind the empty state rather than as light.
  3. The results column gets a top edge that lines up with the rail.

Idempotent. Re-run after a revert:   python polish-explore2.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
CSS = os.path.join(ROOT, 'src', 'index.css')
JSX = os.path.join(ROOT, 'src', 'screens', 'Rankings.jsx')
done, skipped = [], []

# ── 1. Move ServicesNav into the results column ───────────────────
s = io.open(JSX, encoding='utf-8').read()
if 'results-head' in s:
    skipped.append('Rankings.jsx')
else:
    lines = s.split('\n')
    a = next(i for i, l in enumerate(lines) if l.strip().startswith('{/* WHAT to rank'))
    b = next(i for i, l in enumerate(lines) if i > a and l.strip() == '/>')
    block = lines[a:b + 1]
    del lines[a:b + 2]                       # the bar and the blank line after it

    # re-indent by two, it is one level deeper now
    block = ['  ' + l if l.strip() else l for l in block]

    c = next(i for i, l in enumerate(lines)
             if l.strip() == '<section>' and 'Results column' in lines[i - 1])
    lines[c + 1:c + 1] = block + ['']
    s = '\n'.join(lines)
    assert s.count('<ServicesNav') == 1
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('Rankings.jsx')

# ── 2 + 3. CSS ────────────────────────────────────────────────────
s = io.open(CSS, encoding='utf-8').read()
MARK = '/* -- explore polish 2 -- */'
if MARK in s:
    skipped.append('index.css')
else:
    old_wash = """  /* One warm wash, not three pastels. The old pink/butter/mint trio was the
     loudest feminine cue left on the tool pages, and three hues fighting
     under a frosted pane is what made the glass look stained. */
  background:
    radial-gradient(52rem 34rem at 12% 0%, rgba(107, 93, 62, 0.05), transparent 64%),
    radial-gradient(46rem 30rem at 96% 82%, rgba(107, 93, 62, 0.035), transparent 62%);
  background-attachment: fixed;"""
    assert s.count(old_wash) == 1, 'ambient wash not found'
    s = s.replace(old_wash,
                  """  /* No ambient wash. Two oversized radials at 3-5% alpha were meant to read
     as light for the frosted panels to sit in; at this page size they land
     as two soft blobs behind the empty results column instead, which looks
     like a rendering fault rather than atmosphere. The panels carry their
     own gradients and hold up perfectly well on plain paper. */""")

    anchor = '/* -- explore polish -- */'
    add = MARK + """

/* The bar lives in the results column now, so it aligns with the cards it
   filters and can never be overlapped by the sticky rail beside it. */
.discover > section > .svcbar {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--line);
}
.discover > section > .svcbar .svcbar-inner { padding-bottom: 0.8rem; }

"""
    if anchor in s:
        s = s.replace(anchor, add + anchor)
    else:
        btn = "/* ── Buttons ───"
        assert s.count(btn) == 1
        s = s.replace(btn, add + btn)

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
