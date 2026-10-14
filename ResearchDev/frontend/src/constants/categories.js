/* Categories 1-7 are scored and shown. Category 8, Overall Verdict, is
   stored but never shown. Category 3 is reported only (weight 0) — shown
   on profiles but not ranked.

   Category 9 (Service Expertise & Consistency) no longer has an entry here:
   its ranked part, 9.1 consistency, was removed once every category became
   duration-filtered -- a reader comparing the 6-month and 3-year scores now
   answers "is quality holding up" directly, without a dedicated computed
   category for it. Its other part, 9.2 specialism, was never ranked and
   survives as a profile tag (SpecialismBadge, fed by
   backend/api/service_specialism.py) rather than a category score, so it
   does not belong in this list either. category_score still carries a
   neutral, evidence-less row for category_no 9 (weight 0 in the database);
   nothing here reads it.

   Every screen reads this file, so the wording cannot differ between pages. */
export const CATEGORY_INFO = {
  1: { name: "Quality of the Result",            short: "Quality",      description: "Good results that match what you asked for and last" },
  2: { name: "Consultation & Aftercare",         short: "Care",         description: "They look after you before and after" },
  3: { name: "Management Responsiveness",        short: "Management",   description: "How the business deals with complaints and mistakes" },
  4: { name: "Trust & Recommendation",           short: "Trust",        description: "Customers recommend it and come back" },
  5: { name: "Staff & Customer Service",         short: "Staff",        description: "How the staff treat you" },
  6: { name: "Value & Price Honesty",            short: "Value",        description: "Fair price, as agreed" },
  7: { name: "Safety, Hygiene & Facilities",     short: "Safety",       description: "A clean, safe, comfortable place" },
};

export const isShownCategory = (no) => {
  const n = Number(no);
  return n >= 1 && n <= 7;
};
