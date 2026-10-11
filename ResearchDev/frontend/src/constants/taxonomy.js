/* ============================================================
   Salon Service Taxonomy v9 — Sri Lanka
   4 categories → 17 services → 51 sub-services.
   Beard & Shave (MG.BEARD) moved under Hair; Gents' Grooming removed as a top-level category.

   SOURCE OF TRUTH: backend/salon_db/02_reference_data.sql
   ("taxonomy v9", framework "final-38 (frozen 2026-10-04)"). Every `id` and
   `label` below is copied verbatim from ref.service_category / ref.service /
   ref.sub_service. This file is a mirror, not a second opinion — if the two
   ever disagree, the SQL wins and this file is wrong. The taxonomy is frozen
   per projectInfo.md, so nothing here is to be added, renamed or merged.

   `id`      — the v9 code (HR, HR.CUT, HR.CUT.01), the join key with the
               database and with extraction output.
   `label`   — verbatim ref.sub_service.name.
   `value`   — readable wire slug sent to the API.
   `aliases` — the v4 slugs this v9 node absorbs.

   WHY `aliases` EXISTS. Leaf slugs travel as `sub_services` and are matched
   against `salons.service_tags` by apply_soft_priority
   (backend/services/filter_service.py), which only sets a
   `matched_sub_service` flag used for ordering — it never excludes. Those
   stored tags are still v4 spellings. So each node also carries the v4 slugs
   it replaces, and the ranking call sends slug + aliases together: the UI
   moves to v9 while the match badge and the priority boost keep working
   against the data that is actually in the table. All 65 v4 slugs are
   accounted for below, so no stored tag is orphaned.

   Three v9 nodes have no v4 ancestor and so cannot match a stored tag yet —
   see NEW_IN_V9, which is derived rather than hand-listed.

   NOTE ON GENDER. v4 carried a gender facet (F/M/U/K) on every leaf. v9
   carries no gender data, and the apparatus was unreachable anyway:
   ServicesNav calls groupsFor() with one argument, so the facet parameter was
   always undefined and every group came back unfiltered. Rather than invent
   facets for 51 sub-services, the facet system is gone. `GENDERS` below
   survives because it still backs the `gender` field sent to /rank — that is
   a filter value, not taxonomy.
   ============================================================ */

/* Category `value` slugs are a HARD filter: backend/main.py runs
   `WHERE s.service_family = $1` against them. They keep their v1 spellings
   because that is what is stored in salons.service_family — renaming one
   returns zero candidates. Only the labels move to v9. */
export const DOMAINS = [
  { id: "HR", value: "hair",          label: "Hair" },
  { id: "SK", value: "skin_beauty",   label: "Skin & Beauty" },
  { id: "NL", value: "nails",         label: "Nail Care" },
  { id: "BO", value: "makeup_bridal", label: "Wedding, Events & Occasions" },
];

export const GROUPS = {
  hair: [
    {
      id: "HR.CUT",
      label: "Haircuts",
      leaves: [
        { id: "HR.CUT.01", value: "haircut_trim",        label: "Haircut & Trim",        aliases: ["haircut_trim", "kids_haircut"] },
        { id: "HR.CUT.02", value: "style_cut_restyling", label: "Style Cut & Restyling", aliases: ["layered_style_cut"] },
      ],
    },
    {
      id: "HR.COL",
      label: "Hair Colour",
      leaves: [
        { id: "HR.COL.01", value: "global_colour_root_touchup", label: "Global Colour & Root Touch-up", aliases: ["global_colour", "grey_coverage_root_touchup"] },
        { id: "HR.COL.02", value: "highlights_balayage_ombre",  label: "Highlights, Balayage & Ombre",  aliases: ["highlights_balayage"] },
        { id: "HR.COL.03", value: "bleach_fashion_colour",      label: "Bleach & Fashion Colour",       aliases: ["bleach_fashion_colour"] },
      ],
    },
    {
      /* Three nodes, not two. "Rebonding, Keratin & Smoothening, Perming &
         Texturizing" reads as two items in prose, but v9 splits rebonding
         from keratin — HR.CHEM.01-03. */
      id: "HR.CHEM",
      label: "Chemical Hair Treatments",
      leaves: [
        { id: "HR.CHEM.01", value: "rebonding",             label: "Rebonding",             aliases: ["rebonding"] },
        { id: "HR.CHEM.02", value: "keratin_smoothening",   label: "Keratin & Smoothening", aliases: ["keratin_smoothening"] },
        { id: "HR.CHEM.03", value: "perming_texturizing",   label: "Perming & Texturizing", aliases: ["perm"] },
      ],
    },
    {
      id: "HR.TRT",
      label: "Hair & Scalp Treatments",
      leaves: [
        { id: "HR.TRT.01", value: "hair_spa_deep_conditioning",  label: "Hair Spa & Deep Conditioning",      aliases: ["hair_spa"] },
        { id: "HR.TRT.02", value: "scalp_care_dandruff_hairfall", label: "Scalp Care (Dandruff & Hair Fall)", aliases: ["scalp_dandruff_treatment", "hair_fall_treatment"] },
        { id: "HR.TRT.03", value: "protein_botox_oil_treatments", label: "Protein, Botox & Oil Treatments",   aliases: ["ayurvedic_oil_head_massage"] },
      ],
    },
    {
      id: "HR.STY",
      label: "Hair Styling",
      leaves: [
        { id: "HR.STY.01", value: "wash_blow_dry",                  label: "Wash & Blow Dry",                   aliases: ["wash_blow_dry"] },
        { id: "HR.STY.02", value: "temporary_straightening_curling", label: "Temporary Straightening / Curling", aliases: ["temporary_straightening_curls"] },
        { id: "HR.STY.03", value: "event_party_hairstyle",           label: "Event & Party Hairstyle",           aliases: ["party_hairstyle"] },
        { id: "HR.STY.04", value: "hair_extensions_wigs_systems",    label: "Hair Extensions, Wigs & Systems",   aliases: ["hair_extensions_wigs", "hair_patch_system"] },
      ],
    },
    {
      id: "MG.BEARD",
      label: "Beard & Shave",
      leaves: [
        { id: "MG.BEARD.01", value: "beard_trim_line_up", label: "Beard Trim & Line Up", aliases: ["beard_trim_styling"] },
        { id: "MG.BEARD.02", value: "clean_shave",        label: "Clean Shave",          aliases: ["clean_shave"] },
        { id: "MG.BEARD.03", value: "hot_towel_shave",    label: "Hot Towel Shave",      aliases: ["hot_towel_shave"] },
        { id: "MG.BEARD.04", value: "beard_colouring",    label: "Beard Colouring",      aliases: ["beard_colour"] },
      ],
    },
  ],

  skin_beauty: [
    {
      id: "SK.FAC",
      label: "Facials",
      leaves: [
        { id: "SK.FAC.01", value: "basic_cleanup_express_facial",    label: "Basic Clean-up & Express Facial",    aliases: ["basic_facial_cleanup"] },
        { id: "SK.FAC.02", value: "deep_cleansing_antiaging_facial", label: "Deep Cleansing & Anti-Aging Facial", aliases: ["deep_cleansing_facial", "anti_aging_facial"] },
        { id: "SK.FAC.03", value: "brightening_detan_facial",        label: "Brightening & De-Tan Facial",        aliases: ["brightening_facial", "detan_facial"] },
        // New in v9: machine-assisted facials had no v4 node.
        { id: "SK.FAC.04", value: "advanced_hydra_oxygen_facial",    label: "Advanced Hydra & Oxygen Facial",     aliases: [] },
      ],
    },
    {
      id: "SK.TRT",
      label: "Skin Treatments",
      leaves: [
        { id: "SK.TRT.01", value: "acne_pigmentation_care", label: "Targeted Acne & Pigmentation Care", aliases: ["acne_treatment", "pigmentation_treatment"] },
        { id: "SK.TRT.02", value: "detan_body_face_care",   label: "De-Tan Body & Face Care",           aliases: ["detan_treatment"] },
        { id: "SK.TRT.03", value: "chemical_peels",         label: "Chemical Peels",                    aliases: ["chemical_peel"] },
      ],
    },
    {
      id: "SK.BL",
      label: "Brows & Lashes",
      leaves: [
        { id: "SK.BL.01", value: "eyebrow_threading_lamination_tint", label: "Eyebrow Threading, Lamination & Tint", aliases: ["eyebrow_threading_shaping"] },
        { id: "SK.BL.02", value: "eyelash_extensions_lash_lift",      label: "Eyelash Extensions & Lash Lift",       aliases: ["eyelash_extensions", "lash_lift"] },
        // New in v9: cosmetic brow pigmentation had no v4 node.
        { id: "SK.BL.03", value: "microblading_micropigmentation",    label: "Microblading & Micro-pigmentation",    aliases: [] },
      ],
    },
    {
      id: "SK.HX",
      label: "Hair Removal & Lightening",
      /* Procedurally unrelated to facials and peels — exclude from
         sibling-variance statistics within SK or the estimate is meaningless.
         Kept as data so it survives the next group added to SK. */
      excludeFromSiblingStats: true,
      leaves: [
        { id: "SK.HX.01", value: "facial_threading_waxing",      label: "Facial Threading & Waxing",      aliases: ["face_threading"] },
        /* waxing_underarm_bikini is aliased here, not onto SK.HX.03: v9 names
           the underarm explicitly in this node, and a tag that matched two
           siblings would make the match badge ambiguous. */
        { id: "SK.HX.02", value: "arms_legs_underarm_waxing",    label: "Arms, Legs & Underarm Waxing",   aliases: ["waxing_arms_legs", "waxing_underarm_bikini"] },
        { id: "SK.HX.03", value: "full_body_waxing_bikini_care", label: "Full Body Waxing & Bikini Care", aliases: ["full_body_waxing"] },
        { id: "SK.HX.04", value: "face_body_bleaching",          label: "Face & Body Bleaching",          aliases: ["face_body_bleach"] },
      ],
    },
  ],

  nails: [
    {
      id: "NL.CARE",
      label: "Nail Care",
      leaves: [
        { id: "NL.CARE.01", value: "manicure_pedicure",  label: "Manicure & Pedicure",            aliases: ["manicure", "pedicure"] },
        { id: "NL.CARE.02", value: "foot_spa_heel_care", label: "Foot Spa & Intensive Heel Care", aliases: ["foot_spa"] },
      ],
    },
    {
      id: "NL.POL",
      label: "Nail Polish",
      leaves: [
        { id: "NL.POL.01", value: "classic_gel_polish_application", label: "Classic & Gel Nail Polish Application", aliases: ["regular_polish", "gel_polish"] },
        { id: "NL.POL.02", value: "gel_acrylic_polish_removal",     label: "Gel / Acrylic Polish Removal",          aliases: ["nail_repair_removal"] },
      ],
    },
    {
      id: "NL.EXT",
      label: "Extensions & Nail Art",
      leaves: [
        { id: "NL.EXT.01", value: "acrylic_gel_nail_extensions", label: "Acrylic & Gel Nail Extensions",      aliases: ["acrylic_extensions", "gel_extensions"] },
        { id: "NL.EXT.02", value: "refill_custom_nail_art",      label: "Extension Refill & Custom Nail Art", aliases: ["refill", "nail_art"] },
      ],
    },
  ],

  makeup_bridal: [
    {
      id: "BO.BRIDAL",
      label: "Bridal Services",
      leaves: [
        { id: "BO.BRIDAL.01", value: "bridal_trial_consultation",   label: "Bridal Trial & Consultation",      aliases: ["bridal_trial"] },
        { id: "BO.BRIDAL.02", value: "wedding_day_bridal_makeup",   label: "Bridal Makeup & Hair", aliases: ["wedding_day_bridal"] },
        { id: "BO.BRIDAL.03", value: "homecoming_engagement_makeup", label: "Homecoming & Engagement Makeup",  aliases: ["homecoming_makeup", "engagement_makeup"] },
        { id: "BO.BRIDAL.04", value: "bridal_party_photoshoot",     label: "Bridal Party & Photoshoot Makeup", aliases: ["bridal_party_mother_of_bride"] },
      ],
    },
    {
      /* v9 keeps groom work here rather than under Gents' Grooming: a wedding
         is one booking, so the couple's dressing sits in one category. MG is
         beard and shave work only. The four v4 MG.GROOM slugs are aliased
         onto these three nodes, so nothing stored is orphaned by the move. */
      id: "BO.GROOM",
      label: "Groom Services",
      leaves: [
        { id: "BO.GROOM.01", value: "wedding_day_groom_dressing", label: "Groom Dressing & Hair",    aliases: ["wedding_day_groom_dressing", "groom_hair_makeup"] },
        { id: "BO.GROOM.02", value: "nilame_kandyan_dressing",    label: "Nilame & Traditional Kandyan Dressing", aliases: ["nilame_kandyan_groom_dressing"] },
        { id: "BO.GROOM.03", value: "homecoming_groom_styling",   label: "Homecoming Groom Styling",             aliases: ["homecoming_groom"] },
      ],
    },
    {
      id: "BO.DRAPE",
      label: "Draping & Dressing",
      leaves: [
        { id: "BO.DRAPE.01", value: "saree_osariya_draping", label: "Saree & Kandyan Osariya Draping", aliases: ["saree_draping", "osariya_draping"] },
        // New in v9: ornament setting had no v4 node.
        { id: "BO.DRAPE.02", value: "jewellery_ornament_setting", label: "Jewellery & Ornament Setting", aliases: [] },
      ],
    },
    {
      id: "BO.OCC",
      label: "Events & Occasion Services",
      leaves: [
        // graduation_makeup folds in here: v9 has no separate graduation node.
        { id: "BO.OCC.01", value: "party_birthday_event_makeup", label: "Party, Birthday & Event Makeup",    aliases: ["party_birthday_makeup", "graduation_makeup"] },
        { id: "BO.OCC.02", value: "hd_commercial_photoshoot",    label: "HD & Commercial Photoshoot Makeup", aliases: ["photoshoot_hd_makeup"] },
        { id: "BO.OCC.03", value: "mehendi_henna",               label: "Mehendi / Henna Application",       aliases: ["mehendi"] },
      ],
    },
  ],

};

// ── Derived lookups ───────────────────────────────────────────

/** Every leaf of a category, flattened. */
export const LEAVES_BY_DOMAIN = Object.fromEntries(
  Object.entries(GROUPS).map(([domain, groups]) => [
    domain,
    groups.flatMap((g) => g.leaves),
  ])
);

export const ALL_LEAVES = Object.values(GROUPS).flat().flatMap((g) => g.leaves);

/** service code (HR.COL) → the group, for expanding a group pick into leaves. */
export const GROUP_BY_ID = Object.fromEntries(
  Object.values(GROUPS).flat().map((g) => [g.id, g])
);

/** leaf slug → display label, for naming a choice made inside a flyout. */
export const LEAF_LABELS = Object.fromEntries(
  ALL_LEAVES.map(({ value, label }) => [value, label])
);

/** v9 code (HR.CUT.01) → leaf, for reading a code back from the database. */
export const LEAF_BY_CODE = Object.fromEntries(ALL_LEAVES.map((l) => [l.id, l]));

/* Every stored tag spelling → the v9 label to show for it. Covers the v4
   aliases as well as the v9 slugs, so a `service_tags` value that came out of
   the database renders as a readable v9 name instead of a raw slug. */
export const TAG_LABELS = Object.fromEntries(
  ALL_LEAVES.flatMap((l) => [l.value, ...l.aliases].map((t) => [t, l.label]))
);

export const LEAF_BY_VALUE = Object.fromEntries(ALL_LEAVES.map((l) => [l.value, l]));

/* De-duplicated: where a v9 slug is spelled exactly like the v4 tag it
   absorbs (rebonding, clean_shave, wash_blow_dry ...) the naive concatenation
   repeats it. Harmless to the API, which only asks whether any tag matches,
   but it makes the request body misleading to read in a network log. */
const uniq = (tags) => [...new Set(tags)];

/** Every tag that should count as a match for one leaf: its slug + aliases. */
export const tagsForLeaf = (value) => {
  const leaf = LEAF_BY_VALUE[value];
  if (!leaf) return value ? [value] : [];
  return uniq([leaf.value, ...leaf.aliases]);
};

/** The same, for a whole service group - match any sub-service under it. */
export const tagsForGroup = (groupId) =>
  uniq((GROUP_BY_ID[groupId]?.leaves ?? []).flatMap((l) => [l.value, ...l.aliases]));

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

/* v9 nodes with no v4 ancestor, so no stored service_tags value can match
   them yet. They still rank — the sub-service filter is soft — but cannot earn
   the matched_sub_service boost until extraction tags them. Derived, so it
   cannot drift from the table above. */
export const NEW_IN_V9 = ALL_LEAVES.filter((l) => l.aliases.length === 0).map((l) => l.value);

/**
 * The groups to show for a category.
 *
 * v9 carries no gender data, so this is now a plain lookup — it kept a second
 * `facet` parameter through v4, but ServicesNav only ever passed one argument,
 * which made the filtering branch unreachable. Returning the category's own
 * groups is what the interface has always actually rendered.
 */
export function groupsFor(domainValue) {
  return GROUPS[domainValue] ?? [];
}

// ── Non-taxonomy filter vocabulary ────────────────────────────

/* `level` is what the tier means — one mark to three — so the control can
   show that these are ordered rather than three unrelated choices. */
export const PRICE_TIERS = [
  { value: "budget",   label: "Budget",   level: 1 },
  { value: "standard", label: "Standard", level: 2 },
  { value: "premium",  label: "Premium",  level: 3 },
];

/* Not taxonomy: this is the `gender` field on the ranking request, which the
   backend uses to drop salons that serve only the other client type. */
export const GENDERS = [
  { value: "unisex", label: "Unisex" },
  { value: "female", label: "Women" },
  { value: "male",   label: "Men" },
];

/* Named radii rather than a continuous slider: people search in round
   numbers, and 37 km is not a distance anyone means to ask for. */
export const DISTANCE_STEPS = [1, 2, 3, 5, 10, 15, 25, 50];
