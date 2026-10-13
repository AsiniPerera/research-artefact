/* Categories 1-7 as the prototype shows them: the screen name and the
   customer description from section 2 of salon_quality_framework_v5.md.
   Every screen reads these, so the wording cannot differ between pages.
   Category 8, Overall Verdict, is stored and scored but never shown. */
export const CATEGORY_INFO = {
  1: { name: "Quality of the Result",        short: "Quality",    description: "Good results that match what you asked for and last" },
  2: { name: "Consultation & Aftercare",     short: "Care",       description: "They look after you before and after" },
  3: { name: "Responsiveness and Adaptability", short: "Management", description: "How the business deals with complaints and mistakes" },
  4: { name: "Trust & Recommendation",       short: "Trust",      description: "Customers recommend it and come back" },
  5: { name: "Staff & Customer Service",     short: "Staff",      description: "How the staff treat you" },
  6: { name: "Value & Price Honesty",        short: "Value",      description: "Fair price, as agreed" },
  7: { name: "Safety, Hygiene & Facilities", short: "Safety",     description: "A clean, safe, comfortable place" },
};

export const isShownCategory = (no) => Number(no) >= 1 && Number(no) <= 7;
