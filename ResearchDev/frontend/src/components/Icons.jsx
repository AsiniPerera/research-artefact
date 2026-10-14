/* Small stroke icons, sized by the `size` prop and coloured by currentColor. */

const base = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export function IconArrow({ size = 14 }) {
  return (
    <svg {...base(size)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* Evidence — reviewers' words, read and weighed. */
export function IconQuote({ size = 20 }) {
  return (
    <svg {...base(size)}>
      <path d="M7 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3v3a2 2 0 0 1-2 2" />
      <path d="M18 7h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3v3a2 2 0 0 1-2 2" />
    </svg>
  );
}

/* No paid rankings — a balance held level. */
export function IconScale({ size = 20 }) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v18M7 21h10M5 7h14l-3 5a3 3 0 0 1-6 0L5 7Z" />
      <path d="M12 4 5 7M12 4l7 3" />
    </svg>
  );
}

/* 19 parameters — a considered grid of signals. */
export function IconGrid({ size = 20 }) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/* Opening hours — a clock. */
export function IconClock({ size = 20 }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

/* Account — a single figure, shoulders and head. */
export function IconUser({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

/* Saved — a heart, outlined until it's filled. */
/* Drawn on the same 24 grid as the rest, so it carries the same stroke
   weight at the same size. The nav's own version was a 16-grid SVG at 14px,
   which put its lines a fifth heavier than its neighbours'. */
export function IconSearch({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8 21 21" />
    </svg>
  );
}

export function IconHeart({ size = 16, filled = false }) {
  return (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6c0 4.8-7 9.4-7 9.4Z" />
    </svg>
  );
}

/* Upcoming — a calendar with the date ruled off. */
export function IconCalendar({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

/* Past bookings — a clock turning back on itself. */
export function IconHistory({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4.2l2.8 1.7" />
    </svg>
  );
}

/* Sign up — a figure with a plus. */
export function IconUserPlus({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 11.3-4.4M18 14.5v5M20.5 17h-5" />
    </svg>
  );
}

/* Sign in — an arrow entering a door. */
export function IconLogIn({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <path d="M14 3.5h4a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4" />
      <path d="M10 16l4-4-4-4M14 12H3.5" />
    </svg>
  );
}

/* Alerts — a bell. */
export function IconBell({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/* Disclosure — a chevron that flips when its menu opens. */
export function IconChevron({ size = 14 }) {
  return (
    <svg {...base(size)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* Location — a map pin. */
export function IconPin({ size = 20 }) {
  return (
    <svg {...base(size)}>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/* Instagram. */
export function IconInstagram({ size = 18 }) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* Facebook — plain outline icon (used in nav/footer). */
export function IconFacebook({ size = 18 }) {
  return (
    <svg {...base(size)}>
      <path d="M14 8.5h2.5V5.5H14A3 3 0 0 0 11 8.5V11H8.5v3H11v6h3v-6h2.3l.5-3H14V8.7Z" />
    </svg>
  );
}

/* Facebook — branded circle for auth buttons. */
export function IconFacebookBrand({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#1877F2" />
      <path fill="#fff" d="M21 16h-3v9h-4v-9h-2v-3.5h2v-2A3.5 3.5 0 0 1 17.5 7H21v3.5h-2a.9.9 0 0 0-1 1v1h3L21 16Z" />
    </svg>
  );
}

/* Google — coloured G for auth buttons. */
export function IconGoogleBrand({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#fff" />
      <path fill="#4285F4" d="M25.6 16.2c0-.6-.1-1.2-.2-1.8H16v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1Z" />
      <path fill="#34A853" d="M16 26c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H7v2.6A10 10 0 0 0 16 26Z" />
      <path fill="#FBBC05" d="M10.4 18a6 6 0 0 1 0-4V11.4H7a10 10 0 0 0 0 9.2L10.4 18Z" />
      <path fill="#EA4335" d="M16 10a5.4 5.4 0 0 1 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 16 6a10 10 0 0 0-9 5.4L10.4 14A6 6 0 0 1 16 10Z" />
    </svg>
  );
}

/* Instagram — gradient icon for auth buttons. */
export function IconInstagramBrand({ size = 32 }) {
  const id = "ig-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="130%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="10%" stopColor="#fdf497" />
          <stop offset="25%" stopColor="#fd5949" />
          <stop offset="50%" stopColor="#d6249f" />
          <stop offset="75%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <rect x="8" y="8" width="16" height="16" rx="4.5" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="4" stroke="#fff" strokeWidth="1.8" />
      <circle cx="20.8" cy="11.2" r="1" fill="#fff" />
    </svg>
  );
}

/* Newsletter / contact — an envelope. */
export function IconMail({ size = 20 }) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

/* Weighted to you — sliders set to a personal balance. */
export function IconSliders({ size = 20 }) {
  return (
    <svg {...base(size)}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

/* Information, not an error — a plain lower-case i in a ring. */
export function IconInfo({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h0" />
    </svg>
  );
}

/* A warning triangle — only shown when a salon carries a caution, so it is
   the exception that catches the eye, not decoration on every card. */
export function IconAlert({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4M12 17h0" />
    </svg>
  );
}
