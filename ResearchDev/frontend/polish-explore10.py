# -*- coding: utf-8 -*-
"""Tighten the air above and below Rank Salons.

Idempotent. Re-run after a revert:   python polish-explore10.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
s = io.open(CSS, encoding='utf-8').read()

if 'margin-top: 0.7rem;\n  padding-top: 0.85rem;' in s:
    print('already applied')
    raise SystemExit


def sub(old, new):
    global s
    assert s.count(old) == 1, 'expected 1 got %d: %r' % (s.count(old), old[:60])
    s = s.replace(old, new)


# Above: three separate paddings stacked into the gap — the toggle's own
# bottom padding, the foot's margin, and the foot's padding above its rule.
sub("""  /* Enough to end the panel, not enough to strand the button. 3.5rem plus
     the rule's own padding left roughly 5rem of empty glass between the last
     control and the action, which read as a gap rather than a separation. */
  margin-top: 1.15rem;
  padding-top: 1rem;""",
    """  /* The gap above the button was three paddings stacked: the Show more
     toggle's own, this margin, and this padding above the rule. Trimmed
     together rather than one at a time, or the others just absorb it. */
  margin-top: 0.7rem;
  padding-top: 0.85rem;""")

sub(""".weight-more {
  width: 100%;
  margin-top: 0.9rem;
  padding: 0.6rem 0.5rem;""",
    """.weight-more {
  width: 100%;
  margin-top: 0.75rem;
  /* Asymmetric: it keeps its air above, where it separates from the last
     slider, and gives it back below, where the panel's own foot follows. */
  padding: 0.55rem 0.5rem 0.15rem;""")

# Below: the panel's own bottom padding, which the button was floating in.
sub("""  box-shadow: var(--sh);
  padding: 1.5rem 1.4rem;
  overflow: hidden;""",
    """  box-shadow: var(--sh);
  /* Tighter at the foot than the head: the top carries a heading that needs
     room, the bottom carries a full-width button that already fills it. */
  padding: 1.5rem 1.4rem 1.05rem;
  overflow: hidden;""")

assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied; braces %d' % s.count('{'))
