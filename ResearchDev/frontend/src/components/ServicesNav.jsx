/* The top-level service picker, mounted in App.jsx above the main content. */
import { useEffect, useRef, useState } from "react";
import { DOMAINS, groupsFor } from "../constants/taxonomy";
import { CLOSE_GRACE_MS } from "./flyoutPlacement";

/**
 * The services bar: five domains across, each opening a panel of its groups
 * and every service under them.
 *
 * It reports a pick rather than performing one, so the same component can
 * set a filter in place on the Explore page or route somewhere else — the
 * caller decides which. onPick(family, leafValue, groupId).
 *
 * The panel is positioned inside the bar rather than portalled to <body>,
 * unlike the sidebar's rails. Those had to escape a `position: sticky`
 * ancestor that trapped them in its stacking context; this bar has no such
 * parent, so a plain absolute panel is enough and keeps the markup where the
 * markup belongs.
 */
export function ServicesNav({ activeFamily, onPick }) {
  const [open, setOpen] = useState(null);
  const closeTimer = useRef(null);
  const barRef = useRef(null);

  const hold = () => clearTimeout(closeTimer.current);

  /* A grace period on the way out, so crossing the gap between a tab and its
     panel doesn't close what you were reaching for. */
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), CLOSE_GRACE_MS);
  };

  const closeNow = () => {
    clearTimeout(closeTimer.current);
    setOpen(null);
  };

  /* A pending timer must not outlive the component, or it fires setState
     against an unmounted tree. */
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeNow();
    /* Not on scroll: the panel is anchored to the bar and travels with it,
       so scrolling never strands it the way a portalled panel would. */
    const onDown = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) closeNow();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  function pick(family, sub, groupId = null) {
    closeNow();
    onPick(family, sub, groupId);
  }

  return (
    <div className="svcbar" ref={barRef} onMouseLeave={scheduleClose} onMouseEnter={hold}>
      <div className="svcbar-inner">
        <span className="svcbar-label">Services</span>

        <ul className="svcbar-tabs">
          {DOMAINS.map(({ id, value, label }) => (
            <li key={id}>
              <button
                type="button"
                className={`svcbar-tab ${activeFamily === value ? "is-active" : ""} ${
                  open === value ? "is-open" : ""
                }`}
                aria-expanded={open === value}
                aria-haspopup="true"
                onMouseEnter={() => { hold(); setOpen(value); }}
                onFocus={() => { hold(); setOpen(value); }}
                /* Click goes straight to the domain — the panel is a way to
                   go deeper, never the only way through. */
                onClick={() => pick(value, null)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <div className="svcbar-panel" onMouseEnter={hold} onMouseLeave={scheduleClose}>
          <div className="svcbar-panel-inner">
            {groupsFor(open).map((group) => (
              <div className="svcbar-col" key={group.id}>
                {/* The heading is pickable too: choosing a group means "any
                    service under this one", which is a real thing to want and
                    was otherwise only reachable from the old sidebar rail. */}
                <button
                  type="button"
                  className="svcbar-col-head"
                  onClick={() => pick(open, null, group.id)}
                >
                  <span className="svcbar-col-name">{group.label}</span>
                  <span className="svcbar-col-count">{group.leaves.length}</span>
                </button>
                <ul>
                  {group.leaves.map((leaf) => (
                    <li key={leaf.value}>
                      <button type="button" onClick={() => pick(open, leaf.value)}>
                        {leaf.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* The panel is a way to go deeper, never the only way through. */}
          <button type="button" className="svcbar-all" onClick={() => pick(open, null)}>
            Show everything in {DOMAINS.find((d) => d.value === open)?.label}
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}
