/* Who a salon serves. The data has no such field, so the API labels only the
   salons it can identify (backend/salon_db/22_derive_provider_audience.py); the
   rest have no label and appear only under "Everyone". */
export const AUDIENCE = {
  ladies: { label: "Ladies", hint: "services for women" },
  gents:  { label: "Gents",  hint: "services for men" },
  unisex: { label: "Unisex", hint: "services for women and men" },
};

export const AUDIENCE_OPTIONS = [
  { value: "", label: "Everyone" },
  ...Object.entries(AUDIENCE).map(([value, { label, hint }]) => ({ value, label: `${label} \u00b7 ${hint}` })),
];
