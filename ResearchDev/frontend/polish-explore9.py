# -*- coding: utf-8 -*-
"""1. Distance options past the first became unclickable.
   2. Less air between Show more and Rank Salons.

Idempotent. Re-run after a revert:   python polish-explore9.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(ROOT, 'src', 'components', 'DistanceSelect.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ 1. The menu was closing itself ══════════════════════════════
s = io.open(DS, encoding='utf-8').read()
if 'scrolling of the PAGE' in s:
    skipped.append('DistanceSelect.jsx')
else:
    OLD = """    /* Scroll closes it: the panel is positioned against the button, and a
       page that moves under an open menu strands it.
       Named, not inline — addEventListener and removeEventListener must be
       handed the SAME reference or the listener is never taken off. */
    const onScroll = () => setOpen(false);"""
    assert s.count(OLD) == 1, 'scroll handler not found'
    s = s.replace(OLD, """    /* Scroll closes it — but only scrolling of the PAGE.
       The option list is itself scrollable, and the effect that keeps the
       active option in view scrolls it. That scroll bubbled into this
       capture-phase handler and shut the menu the instant the highlight moved
       past the first option, so every option below "1 km" was unclickable:
       the list vanished before the mouse could come down on it.
       Named, not inline — addEventListener and removeEventListener must be
       handed the SAME reference or the listener is never taken off. */
    const onScroll = (e) => {
      if (listRef.current && listRef.current.contains(e.target)) return;
      setOpen(false);
    };""")

    # And do not scroll at all unless the option is genuinely out of view.
    OLD_SCROLL = """  /* Keep the active option in view when arrowing past the panel's edge. */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, active]);"""
    assert s.count(OLD_SCROLL) == 1, 'scrollIntoView effect not found'
    s = s.replace(OLD_SCROLL, """  /* Keep the active option in view when arrowing past the panel's edge, and
     ONLY then — scrollIntoView on an option that is already visible still
     fires a scroll event, and there is no reason to move a list that does
     not need moving. */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const list = listRef.current;
    const el = list.children[active];
    if (!el) return;
    const above = el.offsetTop < list.scrollTop;
    const below = el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight;
    if (above || below) el.scrollIntoView({ block: "nearest" });
  }, [open, active]);""")

    io.open(DS, 'w', encoding='utf-8').write(s)
    done.append('DistanceSelect.jsx')

# ══ 2. Close the gap above Rank Salons ══════════════════════════
s = io.open(CSS, encoding='utf-8').read()
OLD_FOOT = """  /* ~1.5cm of air above the button. At 96dpi that is 3.5rem, and the point
     of it is that the button ENDS the panel rather than continuing the list
     — close to the last slider it read as one more row. */
  margin-top: 3.5rem;
  padding-top: 1.35rem;"""
if OLD_FOOT not in s:
    skipped.append('index.css')
else:
    s = s.replace(OLD_FOOT, """  /* Enough to end the panel, not enough to strand the button. 3.5rem plus
     the rule's own padding left roughly 5rem of empty glass between the last
     control and the action, which read as a gap rather than a separation. */
  margin-top: 1.15rem;
  padding-top: 1rem;""")
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
