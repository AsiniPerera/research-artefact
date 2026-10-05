"""Single taxonomy source — imported everywhere, never duplicated."""

# ---------------------------------------------------------------------------
# Quality parameters — 19 total (17 review-mined + 2 computed)
# These are the CLOSED vocabulary. The LLM maps only to these names.
# ---------------------------------------------------------------------------

CATEGORIES = {
    "service_excellence": {
        "label": "Service Excellence",
        "parameters": ["result_quality", "technical_skill", "consistency_with_request", "durability"],
    },
    "staff_experience": {
        "label": "Staff & Service Experience",
        "parameters": ["friendliness", "professionalism", "attentiveness"],
    },
    "ambiance_facilities": {
        "label": "Ambiance & Facilities",
        "parameters": ["cleanliness", "ambiance_comfort", "equipment_products"],
    },
    "value": {
        "label": "Value",
        "parameters": ["value_for_money", "perceived_affordability", "pricing_transparency"],
    },
    "convenience_accessibility": {
        "label": "Convenience & Accessibility",
        "parameters": ["proximity", "wait_time", "booking_ease", "hours_coverage"],
    },
    "reputation_reliability": {
        "label": "Reputation & Reliability",
        "parameters": ["repeat_loyalty", "recommendation"],
    },
}

# Parameters computed from structured data — never sent to the LLM
COMPUTED_PARAMS = {"proximity", "hours_coverage"}

# Parameters the LLM extracts from review text (17)
REVIEW_PARAMS = [
    p
    for cat in CATEGORIES.values()
    for p in cat["parameters"]
    if p not in COMPUTED_PARAMS
]

ALL_PARAMS = [p for cat in CATEGORIES.values() for p in cat["parameters"]]

PARAM_DEFINITIONS = {
    "result_quality":            "The final quality of the work done (haircut, nails, makeup, etc.).",
    "technical_skill":           "The expertise and skill level of the stylist or technician.",
    "consistency_with_request":  "How well the result matched what the customer asked for.",
    "durability":                "How long the result lasted after the visit.",
    "friendliness":              "How warm and polite the staff were.",
    "professionalism":           "How professionally the staff conducted themselves.",
    "attentiveness":             "How well the staff listened to and understood the customer.",
    "cleanliness":               "The cleanliness and hygiene standards of the salon.",
    "ambiance_comfort":          "The atmosphere, decor, and comfort of the space.",
    "equipment_products":        "The quality of tools, equipment, and products used.",
    "value_for_money":           "Whether the price felt worth it for the service received.",
    "perceived_affordability":   "How affordable the customer perceived the salon to be.",
    "pricing_transparency":      "Whether pricing was clear and communicated upfront.",
    "wait_time":                 "Wait times, delays, or punctuality of appointments.",
    "booking_ease":              "How easy it was to book an appointment.",
    "repeat_loyalty":            "Whether the customer returned or plans to return.",
    "recommendation":            "Whether the customer recommended the salon to others.",
}

PRICE_PARAMS = {"value_for_money", "perceived_affordability", "pricing_transparency"}

# ---------------------------------------------------------------------------
# Service taxonomy — 5 families, 20 sub-service tags
# Used for hard filter (family) and soft filter (sub-service tags).
# NEVER scored.
# ---------------------------------------------------------------------------

SERVICE_FAMILIES = {
    "hair": {
        "label": "Hair",
        "sub_services": {
            "haircut":                   "Haircut",
            "hair_colour_highlights":    "Hair Colour & Highlights",
            "hair_treatments":           "Hair Treatments (Keratin / Protein / Spa)",
            "straightening_rebonding":   "Straightening & Rebonding",
            "hair_styling_blowdry":      "Hair Styling & Blow-dry",
        },
    },
    "makeup_bridal": {
        "label": "Makeup & Bridal",
        "sub_services": {
            "bridal_makeup_dressing":    "Bridal Makeup & Dressing",
            "party_occasion_makeup":     "Party & Occasion Makeup",
        },
    },
    "nails": {
        "label": "Nails",
        "sub_services": {
            "manicure":          "Manicure",
            "pedicure":          "Pedicure",
            "gel_acrylic_nails": "Gel & Acrylic Nails",
            "nail_art":          "Nail Art",
            "nail_extensions":   "Nail Extensions",
        },
    },
    "skin_beauty": {
        "label": "Skin & Beauty",
        "sub_services": {
            "facials_cleanups":       "Facials & Clean-ups",
            "skin_treatments":        "Skin Treatments",
            "threading_brows_lashes": "Threading, Brows & Lashes",
            "waxing":                 "Waxing",
        },
    },
    "barber_grooming": {
        "label": "Barber & Grooming",
        "sub_services": {
            "mens_haircut":       "Men's Haircut",
            "beard_grooming":     "Beard Grooming",
            "mens_colour":        "Men's Colour",
            "grooming_packages":  "Grooming Packages",
        },
    },
}

GENDER_MAP = {
    "hair":            "unisex",
    "makeup_bridal":   "female",
    "nails":           "female",
    "skin_beauty":     "unisex",
    "barber_grooming": "male",
}

ALL_TAGS = [
    tag
    for fam in SERVICE_FAMILIES.values()
    for tag in fam["sub_services"]
]

TAG_LABELS = {
    tag: label
    for fam in SERVICE_FAMILIES.values()
    for tag, label in fam["sub_services"].items()
}
