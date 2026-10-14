/* The signed-in account's home screen, reached from the nav (App.jsx). Shows
   Upcoming and Booking history, both stated as not yet available rather than
   populated with invented data, since no booking backend exists. */
import { useState } from "react";
import { IconCalendar, IconHistory, IconUser } from "../components/Icons";

/* Favorites is its own page, reached from the nav — it isn't a booking, and
   it doesn't need an account to work. */
const TABS = [
  { key: "upcoming", label: "Upcoming",        Icon: IconCalendar },
  { key: "history",  label: "Booking history", Icon: IconHistory },
];

/* Bookings need a backend this prototype doesn't have yet, so these say so
   plainly rather than showing invented appointments. */
function Empty({ Icon, title, children }) {
  return (
    <div className="empty-state dash-empty">
      <span className="dash-empty-icon" aria-hidden="true"><Icon size={22} /></span>
      <p className="empty-title">{title}</p>
      <p>{children}</p>
    </div>
  );
}

export function Dashboard({ initialTab = "upcoming", onExplore }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="page-body">
      <header className="page-head page-head--bar">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="page-head-title page-head-title--small">
            My <em>dashboard.</em>
          </h1>
        </div>

        <div className="dash-id">
          <span className="dash-avatar" aria-hidden="true"><IconUser size={20} /></span>
          <div>
            <p className="dash-id-name">Guest</p>
            <button className="btn-text" onClick={() => onExplore("auth")}>Sign in</button>
          </div>
        </div>
      </header>

      <nav className="dash-tabs" aria-label="Dashboard sections">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`dash-tab ${tab === key ? "dash-tab--on" : ""}`}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {tab === "upcoming" && (
        <Empty Icon={IconCalendar} title="No upcoming appointments">
          Booking isn&apos;t connected in this prototype yet, so there&apos;s nothing
          scheduled. Once it is, appointments you book will appear here with the date,
          the salon and the service.
        </Empty>
      )}

      {tab === "history" && (
        <Empty Icon={IconHistory} title="No past bookings">
          Visits you&apos;ve completed will be listed here, newest first — so you can
          rebook a service, or review the salon while it&apos;s fresh.
        </Empty>
      )}

    </div>
  );
}
