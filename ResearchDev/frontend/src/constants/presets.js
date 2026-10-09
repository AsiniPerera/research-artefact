// Values are the four doubling levels: 1 Low · 2 Medium · 4 High · 8 Very high.
// The ranking normalises proportionally, so these are relative importance —
// not a fixed budget.
//
// SEVEN keys each, matching WEIGHTED_KEYS in WeightLevels. Framework v4's
// eighth category, Overall Verdict, is reported only: it carries no weight, so
// it has no key here and no preset can tilt towards it.

export const PRESETS = {
  balanced: {
    quality_of_work:        2,
    consultation_aftercare: 2,
    owner_responsiveness:   2,
    customer_trust:         2,
    staff_customer_service: 2,
    value_price_honesty:    2,
    safety_hygiene:         2,
  },

  /* Best work: the result itself, and whether it lasts. Consultation sits above
     the middle deliberately — in chemical and colour work, the salon that
     checks your hair first is the one that gets the result right, so it is
     part of quality rather than a courtesy beside it. */
  quality: {
    quality_of_work:        8,
    consultation_aftercare: 4,
    owner_responsiveness:   1,
    customer_trust:         2,
    staff_customer_service: 2,
    value_price_honesty:    1,
    safety_hygiene:         2,
  },

  /* Best value: price against what you actually get. Quality of Work is High,
     not Low — work that has to be redone in a fortnight is the expensive kind
     of cheap, and value that ignores durability is not value. Price honesty
     carries the preset, because a quote that moves is the way a cheap salon
     stops being cheap. */
  budget: {
    quality_of_work:        4,
    consultation_aftercare: 1,
    owner_responsiveness:   1,
    customer_trust:         1,
    staff_customer_service: 2,
    value_price_honesty:    8,
    safety_hygiene:         2,
  },

  /* Clean & safe. Safety, Hygiene & Facilities is one category in v4, so this
     preset is a single clear tilt rather than the spread it needed before. */
  hygiene: {
    quality_of_work:        2,
    consultation_aftercare: 2,
    owner_responsiveness:   2,
    customer_trust:         2,
    staff_customer_service: 4,
    value_price_honesty:    1,
    safety_hygiene:         8,
  },

  /* Bridal: one appointment, no second chance. Quality of Work is Very high
     because the result has to survive a whole day, and consultation rises with
     it — this is the client most likely to need a fix, and least able to
     absorb one going wrong. Trust is High: a bride books on other brides'
     word, not on a price list. */
  bridal: {
    quality_of_work:        8,
    consultation_aftercare: 4,
    owner_responsiveness:   2,
    customer_trust:         4,
    staff_customer_service: 2,
    value_price_honesty:    1,
    safety_hygiene:         2,
  },
};
