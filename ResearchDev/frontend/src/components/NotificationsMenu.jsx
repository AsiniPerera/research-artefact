/* Mounted in App.jsx's header, next to AccountMenu. Built on NavMenu for the
   open/close shell. */
import { NavMenu } from "./NavMenu";
import { IconBell } from "./Icons";

/**
 * Alerts. There is no notification source yet — no accounts, no bookings —
 * so this states that rather than showing a badge over an invented list.
 */
export function NotificationsMenu() {
  return (
    <NavMenu icon={<IconBell size={18} />} label="Notifications">
      {() => (
        <>
          <p className="nav-menu-label">Notifications</p>
          <div className="nav-menu-empty">
            <span className="nav-menu-empty-icon" aria-hidden="true">
              <IconBell size={20} />
            </span>
            <p className="nav-menu-empty-title">You&apos;re all caught up</p>
            <p>
              Booking reminders and replies from salons will arrive here once
              accounts are connected.
            </p>
          </div>
        </>
      )}
    </NavMenu>
  );
}
