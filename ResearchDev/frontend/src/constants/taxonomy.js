/* ============================================================
   Salon Service Taxonomy v4 — Sri Lanka
   5 domains → 17 groups → 65 variants.

   `id`     — v4 code (HR, HR.CUT), the join key with extraction output.
   `value`  — wire slug sent to the API. Domain slugs are unchanged from
              v1 because they match `salons.service_family` in the database.
   `gender` — the CLIENT FACET: F female · M male · U unisex · K kids.

   THE RULE that shapes this file: a service exists as exactly ONE node, and
   gender is a facet on it — never a second node. A man booking a haircut is
   booking HR.CUT/haircut_trim with gender U, not a parallel "men's haircut".
   That is why MG holds only what is genuinely men-specific (beard work and
   groom dressing) and why the men's picture is assembled by MENS_LEAVES
   below rather than by reading MG on its own.
   ============================================================ */

export const DOMAINS = [
  { id: "HR", value: "hair",            label: "Hair" },
  { id: "SK", value: "skin_beauty",     label: "Skin & Beauty" },
  { id: "BO", value: "makeup_bridal",   label: "Bridal & Occasion" },
  { id: "NL", value: "nails",           label: "Nails" },
  { id: "MG", value: "barber_grooming", label: "Men's Grooming" },
];

/* The four facet codes, and what each one is called in the interface. */
export const GENDER_FACETS = {
  F: "Women",
  M: "Men",
  U: "Unisex",
  K: "Kids",
};

export const GROUPS = {
  hair: [
    {
      id: "HR.CUT",
      label: "Haircuts",
      leaves: [
        { value: "haircut_trim",      label: "Haircut / Trim", gender: "U" },
        { value: "layered_style_cut", label: "Style Cut",      gender: "U" },
        { value: "kids_haircut",      label: "Kids Haircut",   gender: "K" },
      ],
    },
    {
      id: "HR.COL",
      label: "Hair Colour",
      leaves: [
        { value: "global_colour",              label: "Global Colour",                  gender: "U" },
        { value: "grey_coverage_root_touchup", label: "Grey Coverage / Root Touch-up",  gender: "U" },
        { value: "highlights_balayage",        label: "Highlights & Balayage",          gender: "F" },
        { value: "bleach_fashion_colour",      label: "Bleach & Fashion Colour",        gender: "U" },
      ],
    },
    {
      id: "HR.CHEM",
      label: "Chemical Hair Treatments",
      leaves: [
        { value: "rebonding",           label: "Rebonding / Permanent Straightening", gender: "F" },
        { value: "keratin_smoothening", label: "Keratin / Smoothening",               gender: "F" },
        { value: "perm",                label: "Perm",                                gender: "F" },
      ],
    },
    {
      id: "HR.TRT",
      label: "Hair & Scalp Treatments",
      leaves: [
        { value: "hair_spa",                   label: "Hair Spa",                              gender: "U" },
        { value: "scalp_dandruff_treatment",   label: "Scalp & Dandruff Treatment",            gender: "U" },
        { value: "hair_fall_treatment",        label: "Hair Fall Treatment",                   gender: "U" },
        { value: "ayurvedic_oil_head_massage", label: "Ayurvedic Oil Treatment & Head Massage", gender: "U" },
      ],
    },
    {
      id: "HR.STY",
      label: "Hair Styling",
      leaves: [
        { value: "wash_blow_dry",                 label: "Wash & Blow Dry",                        gender: "F" },
        { value: "temporary_straightening_curls", label: "Temporary Straightening / Curl Styling", gender: "F" },
        { value: "party_hairstyle",               label: "Party Hairstyle",                        gender: "F" },
        { value: "hair_extensions_wigs",          label: "Hair Extensions & Wigs",                 gender: "F" },
        /* Lives in HR, not MG: it is a hair system fitted by the hair team.
           The facet is what makes it a men's service, not its position. */
        { value: "hair_patch_system",             label: "Hair Patch / Hair System",               gender: "M" },
      ],
    },
  ],

  skin_beauty: [
    {
      id: "SK.FAC",
      label: "Facials",
      leaves: [
        { value: "basic_facial_cleanup",  label: "Basic Facial / Clean-up",            gender: "U" },
        { value: "deep_cleansing_facial", label: "Deep Cleansing Facial",              gender: "U" },
        { value: "brightening_facial",    label: "Brightening Facial (Gold / Diamond)", gender: "U" },
        { value: "detan_facial",          label: "De-Tan Facial",                      gender: "U" },
        { value: "anti_aging_facial",     label: "Anti-Aging Facial",                  gender: "U" },
      ],
    },
    {
      id: "SK.TRT",
      label: "Skin Treatments",
      leaves: [
        { value: "acne_treatment",         label: "Acne Treatment",         gender: "U" },
        { value: "pigmentation_treatment", label: "Pigmentation Treatment", gender: "U" },
        { value: "detan_treatment",        label: "De-Tan Treatment",       gender: "U" },
        { value: "chemical_peel",          label: "Chemical Peel",          gender: "U" },
      ],
    },
    {
      id: "SK.BL",
      label: "Brows & Lashes",
      leaves: [
        { value: "eyebrow_threading_shaping", label: "Eyebrow Threading & Shaping", gender: "U" },
        { value: "eyelash_extensions",        label: "Eyelash Extensions",          gender: "F" },
        { value: "lash_lift",                 label: "Lash Lift",                   gender: "F" },
      ],
    },
    {
      id: "SK.HX",
      label: "Hair Removal",
      /* Procedurally unrelated to facials and peels — exclude from
         sibling-variance statistics within SK or the estimate is meaningless.
         Kept as data so it survives the next group added to SK. */
      excludeFromSiblingStats: true,
      leaves: [
        { value: "face_threading",         label: "Face Threading",            gender: "F" },
        { value: "waxing_arms_legs",       label: "Waxing – Arms & Legs",      gender: "U" },
        { value: "waxing_underarm_bikini", label: "Waxing – Underarm & Bikini", gender: "F" },
        { value: "full_body_waxing",       label: "Full Body Waxing",          gender: "U" },
        { value: "face_body_bleach",       label: "Face & Body Bleach",        gender: "U" },
      ],
    },
  ],

  makeup_bridal: [
    {
      id: "BO.BRIDAL",
      label: "Bridal",
      leaves: [
        { value: "bridal_trial",                 label: "Bridal Trial",                  gender: "F" },
        { value: "wedding_day_bridal",           label: "Wedding Day Bridal",            gender: "F" },
        { value: "homecoming_makeup",            label: "Homecoming Makeup",             gender: "F" },
        { value: "engagement_makeup",            label: "Engagement Makeup",             gender: "F" },
        { value: "bridal_party_mother_of_bride", label: "Bridal Party / Mother of Bride", gender: "F" },
      ],
    },
    {
      id: "BO.DRAPE",
      label: "Draping",
      leaves: [
        { value: "osariya_draping", label: "Osariya (Kandyan) Draping", gender: "F" },
        { value: "saree_draping",   label: "Saree Draping",             gender: "F" },
      ],
    },
    {
      id: "BO.OCC",
      label: "Occasion",
      leaves: [
        { value: "party_birthday_makeup", label: "Party / Birthday Makeup", gender: "F" },
        { value: "graduation_makeup",     label: "Graduation Makeup",       gender: "F" },
        { value: "photoshoot_hd_makeup",  label: "Photoshoot / HD Makeup",  gender: "U" },
        { value: "mehendi",               label: "Mehendi (Henna)",         gender: "F" },
      ],
    },
  ],

  nails: [
    {
      id: "NL.CARE",
      label: "Nail Care",
      leaves: [
        { value: "manicure",            label: "Manicure",              gender: "U" },
        { value: "pedicure",            label: "Pedicure",              gender: "U" },
        { value: "foot_spa",            label: "Foot Spa",              gender: "U" },
        { value: "nail_repair_removal", label: "Nail Repair & Removal", gender: "F" },
      ],
    },
    {
      id: "NL.POL",
      label: "Nail Polish",
      leaves: [
        { value: "regular_polish", label: "Regular Polish", gender: "F" },
        { value: "gel_polish",     label: "Gel Polish",     gender: "F" },
      ],
    },
    {
      id: "NL.EXT",
      label: "Extensions & Nail Art",
      leaves: [
        { value: "acrylic_extensions", label: "Acrylic Extensions", gender: "F" },
        { value: "gel_extensions",     label: "Gel Extensions",     gender: "F" },
        { value: "refill",             label: "Refill",             gender: "F" },
        { value: "nail_art",           label: "Nail Art",           gender: "F" },
      ],
    },
  ],

  /* Only what is genuinely men-specific. Men's facials, de-tans and haircuts
     are NOT here — they are SK and HR nodes carrying gender U, reached
     through MENS_LEAVES. Duplicating them would put the same service under
     two codes and split its reviews between them. */
  barber_grooming: [
    {
      id: "MG.BEARD",
      label: "Beard & Shave",
      leaves: [
        { value: "beard_trim_styling", label: "Beard Trim & Styling", gender: "M" },
        { value: "clean_shave",        label: "Clean Shave",          gender: "M" },
        { value: "hot_towel_shave",    label: "Hot Towel Shave",      gender: "M" },
        { value: "beard_colour",       label: "Beard Colour",         gender: "M" },
      ],
    },
    {
      id: "MG.GROOM",
      label: "Groom & Wedding",
      leaves: [
        { value: "wedding_day_groom_dressing",   label: "Wedding Day Groom Dressing",     gender: "M" },
        { value: "nilame_kandyan_groom_dressing", label: "Nilame / Kandyan Groom Dressing", gender: "M" },
        { value: "groom_hair_makeup",            label: "Groom Hair & Makeup",            gender: "M" },
        { value: "homecoming_groom",             label: "Homecoming Groom",               gender: "M" },
      ],
    },
  ],
};

// ── Derived lookups ───────────────────────────────────────────

/** Every leaf of a domain, flattened. */
export const LEAVES_BY_DOMAIN = Object.fromEntries(
  Object.entries(GROUPS).map(([domain, groups]) => [
    domain,
    groups.flatMap((g) => g.leaves),
  ])
);

export const ALL_LEAVES = Object.values(GROUPS).flat().flatMap((g) => g.leaves);

/** group code (HR.COL) → the group, for expanding a group pick into leaves. */
export const GROUP_BY_ID = Object.fromEntries(
  Object.values(GROUPS).flat().map((g) => [g.id, g])
);

/** leaf slug → display label, for naming a choice made inside a flyout. */
export const LEAF_LABELS = Object.fromEntries(
  ALL_LEAVES.map(({ value, label }) => [value, label])
);

/** leaf slug → facet, so a caller holding only a slug can still filter. */
export const LEAF_GENDER = Object.fromEntries(
  ALL_LEAVES.map(({ value, gender }) => [value, gender])
);

export const COUNTS = {
  domains: DOMAINS.length,
  groups: Object.values(GROUPS).reduce((n, gs) => n + gs.length, 0),
  leaves: ALL_LEAVES.length,
};

/** The wire slugs the API's `service_family` hard filter expects. */
export const SERVICE_FAMILIES = DOMAINS.map(({ value, label }) => ({ value, label }));

/** Kept under its old name so every existing consumer reads the leaf level
    without a change — the shape is the same {value,label}[] keyed by domain. */
export const SUB_SERVICES = LEAVES_BY_DOMAIN;

// ── Gender facet ──────────────────────────────────────────────

/* The filter control speaks in wire values; the taxonomy speaks in facet
   codes. One map between them, so neither side has to know the other's
   spelling. Kids is a facet but not a filter option — nobody browses "kids"
   as a client type, they book a kids haircut. */
export const FACET_BY_GENDER = { female: "F", male: "M", unisex: "U" };

/** Is this leaf offered to someone browsing as `facet`? U is offered to
    everyone, so it always joins; K only ever matches K. */
export const isOpenTo = (leaf, facet) =>
  leaf.gender === facet || leaf.gender === "U";

/** Every leaf open to a facet, across the domains given (all by default). */
export const leavesOpenTo = (facet, domains = Object.keys(GROUPS)) =>
  domains.flatMap((d) => (LEAVES_BY_DOMAIN[d] ?? []).filter((l) => isOpenTo(l, facet)));

/* The men's picture is MG ∪ (HR, SK, NL filtered to M or U) — never MG on
   its own. MG alone is eight nodes of beard and groom work, which would tell
   a man this app has no haircut, no facial and no pedicure for him. BO is
   left out deliberately: groom dressing already has its own home in
   MG.GROOM, so pulling BO in would only add bridal nodes.

   Order matters: MG leads, because the men-specific work is what someone
   arriving at "Men's Grooming" came for; the shared nodes follow. */
export const MENS_LEAVES = [
  ...LEAVES_BY_DOMAIN.barber_grooming,
  ...leavesOpenTo("M", ["hair", "skin_beauty", "nails"]),
];

/**
 * The groups to SHOW for a domain, given who is browsing.
 *
 * A domain always shows ITS OWN groups — Men's Grooming is its two groups
 * and eight variants, not a widened view. The men's picture from MENS_LEAVES
 * is a FACET concern, not a domain one: with "Men" selected, Hair shows its
 * ten M/U nodes, Skin its thirteen, Nails its three and MG its eight, and the
 * union a man can reach across the five domains is exactly MENS_LEAVES. He
 * never meets MG alone, because the other four domains stay open to him.
 *
 * Empty is never shown. If a facet would filter every leaf out of a domain
 * — Women against Men's Grooming, whose nodes are all M — the domain falls
 * back to unfiltered rather than opening a panel with nothing in it. The
 * domain the user just clicked is the stronger signal of intent.
 */
export function groupsFor(domainValue, facet) {
  const groups = GROUPS[domainValue] ?? [];
  if (!facet || facet === "U") return groups;
  const filtered = groups
    .map((g) => ({ ...g, leaves: g.leaves.filter((l) => isOpenTo(l, facet)) }))
    .filter((g) => g.leaves.length > 0);
  return filtered.length ? filtered : groups;
}

// ── Non-taxonomy filter vocabulary ────────────────────────────

/* `level` is what the tier means — one mark to three — so the control can
   show that these are ordered rather than three unrelated choices. */
export const PRICE_TIERS = [
  { value: "budget",   label: "Budget",   level: 1 },
  { value: "standard", label: "Standard", level: 2 },
  { value: "premium",  label: "Premium",  level: 3 },
];

export const GENDERS = [
  { value: "unisex", label: "Unisex" },
  { value: "female", label: "Women" },
  { value: "male",   label: "Men" },
];

/* Named radii rather than a continuous slider: people search in round
   numbers, and 37 km is not a distance anyone means to ask for. */
export const DISTANCE_STEPS = [1, 2, 3, 5, 10, 15, 25, 50];
