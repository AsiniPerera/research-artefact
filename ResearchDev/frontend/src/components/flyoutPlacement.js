/* Shared by every sidebar flyout. The panels are portalled to <body> because
   `.sidebar` is `position: sticky`, which always creates a stacking context —
   a panel rendered inside it can never paint above the results column no
   matter what z-index it carries. Portalling means they must be positioned
   in viewport coordinates, which is what this does. */

export const GAP = 8;
export const PANEL_W = 250;

/** Keep a panel on screen: to the right of its anchor unless that overflows. */
export function place(anchorTop, fromRight) {
  let left = fromRight + GAP;
  if (left + PANEL_W > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - PANEL_W - 12);
  }
  return {
    top: anchorTop,
    left,
    width: PANEL_W,
    maxHeight: `calc(100vh - ${anchorTop + 16}px)`,
  };
}

/** How long a panel survives after the pointer leaves, so crossing the gap
    between a row and its panel doesn't close what you were reaching for. */
export const CLOSE_GRACE_MS = 160;

/** The margin a panel keeps from the viewport edge. */
const EDGE = 12;

/**
 * Lift a panel that would run off the bottom of the screen.
 *
 * `place` anchors a panel's top to its row, which is right until the row is
 * near the foot of the viewport — the last sidebar section gets a few pixels
 * of headroom and its list turns into a scroller, so its bottom entries fell
 * off the end.
 *
 * Measured rather than estimated from row counts: `scrollHeight` is the full
 * content height even while `max-height` is clipping it, so this stays correct
 * if the row metrics ever change.
 */
export function fitOnScreen(node, intended) {
  if (!node) return;
  /* Re-apply the intended placement before measuring. React skips a style
     update whose prop value is unchanged, so when one panel node is reused
     for a different row an earlier lift would otherwise stick. */
  node.style.top = `${intended.top}px`;
  node.style.maxHeight = intended.maxHeight;

  const vh = window.innerHeight;
  const want = node.scrollHeight + 2;   // + the 1px borders scrollHeight omits
  const top = node.getBoundingClientRect().top;

  if (top + want <= vh - EDGE) return;  // already fits

  // Sit as low as it can while still showing everything, but never above the
  // top margin — a panel taller than the viewport keeps scrolling, using the
  // full height instead of whatever was left below its row.
  const lifted = Math.max(EDGE, vh - EDGE - want);
  node.style.top = `${lifted}px`;
  node.style.maxHeight = `${vh - lifted - EDGE}px`;
}
