/* Nine categories in the framework. Categories 1-7 and 9 are scored.
   Category 8, Overall Verdict, is stored but never shown.
   Category 3 is reported only (weight 0) — shown on profiles but not ranked.
   Category 9 is fixed at Medium weight — no user slider.
   Every screen reads these, so the wording cannot differ between pages. */
export const CATEGORY_INFO = {
  1: { name: "Quality of the Result",            short: "Quality",      description: "Good results that match what you asked for and last" },
  2: { name: "Consultation & Aftercare",         short: "Care",         description: "They look after you before and after" },
  3: { name: "Management Responsiveness",        short: "Management",   description: "How the business deals with complaints and mistakes" },
  4: { name: "Trust & Recommendation",           short: "Trust",        description: "Customers recommend it and come back" },
  5: { name: "Staff & Customer Service",         short: "Staff",        description: "How the staff treat you" },
  6: { name: "Value & Price Honesty",            short: "Value",        description: "Fair price, as agreed" },
  7: { name: "Safety, Hygiene & Facilities",     short: "Safety",       description: "A clean, safe, comfortable place" },
  9: { name: "Service Expertise & Consistency",  short: "Expertise & Consistency",  description: "How reliably they deliver good results over time" },
};

export const isShownCategory = (no) => {
  const n = Number(no);
  return (n >= 1 && n <= 7) || n === 9;
};
