/* Shared nav-icon-button shell, used by AccountMenu and NotificationsMenu
   (both mounted in App.jsx's header). Owns open/close state and the
   click-away/Escape handling; the two callers supply only the icon and the
   panel contents. */
import { useEffect, useRef, useState } from "react";

/**
 * An icon button in the nav that drops a panel beneath it.
 *
 * Shared shell for the profile and notification menus — the click-away and
 * Escape handling is the fiddly part, and having it in two places is how the
 * two menus drift out of step.
 *
 * `children` is a function receiving `close`, so an item can dismiss the menu
 * as it acts.
 */
export function NavMenu({ icon, label, badge = 0, children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="nav-menu-wrap" ref={wrapRef}>
      <button
        className={`nav-icon-btn ${open ? "nav-icon-btn--on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {icon}
        {badge > 0 && (
          <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>
        )}
      </button>

      {open && (
        <div className="nav-menu" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
