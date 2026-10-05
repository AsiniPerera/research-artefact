// Values are the four doubling levels: 1 Low · 2 Medium · 4 High · 8 Very high.
// The ranking normalises proportionally, so these are relative importance —
// not a fixed budget.
//
// TEN keys each, matching WEIGHTED_KEYS in WeightLevels.

export const PRESETS = {
  balanced: {
    service_fulfillment_quality: 2,
    service_quality_trend:       2,
    consultation_aftercare:      2,
    service_durability:          2,
    external_service_recovery:   2,
    staff_customer_experience:   2,
    owner_responsiveness:        2,
    customer_trust_recommendation: 2,
    perceived_value_for_money:   2,
    hygiene_safety:              2,
  },

  /* Best work: the result, whether it holds up, and whether it holds up
     EVERY time. Consistency sits high deliberately — one excellent visit
     followed by a poor one is not what someone asking for quality means. */
  quality: {
    service_fulfillment_quality: 8,
    service_quality_trend:       4,
    consultation_aftercare:      2,
    service_durability:          4,
    external_service_recovery:   2,
    staff_customer_experience:   2,
    owner_responsiveness:        1,
    customer_trust_recommendation: 2,
    perceived_value_for_money:   1,
    hygiene_safety:              2,
  },

  /* Best value: price against what you actually get. Durability is High,
     not Low — work that has to be redone in a fortnight is the expensive
     kind of cheap, and value that ignores it is not value. */
  budget: {
    service_fulfillment_quality: 4,
    service_quality_trend:       2,
    consultation_aftercare:      1,
    service_durability:          4,
    external_service_recovery:   1,
    staff_customer_experience:   2,
    owner_responsiveness:        1,
    customer_trust_recommendation: 1,
    perceived_value_for_money:   8,
    hygiene_safety:              2,
  },

  /* Clean & safe. This replaces the old "convenience" preset, which anchored
     on a convenience/accessibility category the ten-category taxonomy does
     not have. */
  hygiene: {
    service_fulfillment_quality: 2,
    service_quality_trend:       2,
    consultation_aftercare:      2,
    service_durability:          1,
    external_service_recovery:   1,
    staff_customer_experience:   4,
    owner_responsiveness:        2,
    customer_trust_recommendation: 2,
    perceived_value_for_money:   1,
    hygiene_safety:              8,
  },

  /* Bridal: one appointment, no second chance. Durability matches the result
     itself because it has to survive a whole day, and aftercare and recovery
     both rise — this is the client most likely to need a fix, and least able
     to absorb one going wrong. */
  bridal: {
    service_fulfillment_quality: 8,
    service_quality_trend:       4,
    consultation_aftercare:      4,
    service_durability:          8,
    external_service_recovery:   4,
    staff_customer_experience:   2,
    owner_responsiveness:        2,
    customer_trust_recommendation: 4,
    perceived_value_for_money:   1,
    hygiene_safety:              2,
  },
};
