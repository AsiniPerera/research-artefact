/* Priority presets — data integrity and that each preset leans the way its
   name promises. Pure data, no DOM.

   Maps to the evaluation plan's "Priority component: each preset sets correct
   weights". The presets are the single source the Rankings screen builds its
   default and (historically) its quick-picks from. */
import { describe, it, expect } from "vitest";
import { PRESETS } from "./presets";

const KEYS = [
  "quality_of_work",
  "consultation_aftercare",
  "owner_responsiveness",
  "customer_trust",
  "staff_customer_service",
  "value_price_honesty",
  "safety_hygiene",
];
const ALLOWED = new Set([0, 1, 2, 4, 8]); // doubling scale, 0 for reported-only

describe("PRESETS", () => {
  it("P-01: defines exactly the five named presets", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      ["balanced", "budget", "bridal", "hygiene", "quality"].sort()
    );
  });

  it.each(Object.entries(PRESETS))("P-02: %s has all seven category keys", (_name, preset) => {
    expect(Object.keys(preset).sort()).toEqual([...KEYS].sort());
  });

  it.each(Object.entries(PRESETS))("P-03: %s uses only valid scale values", (_name, preset) => {
    for (const v of Object.values(preset)) expect(ALLOWED.has(v)).toBe(true);
  });

  it.each(Object.entries(PRESETS))(
    "P-04: %s keeps Management Responsiveness (category 3) at 0 — reported only",
    (_name, preset) => {
      expect(preset.owner_responsiveness).toBe(0);
    }
  );

  it("P-05: Balanced weights every category equally", () => {
    const { owner_responsiveness, ...weighted } = PRESETS.balanced;
    expect(new Set(Object.values(weighted))).toEqual(new Set([2]));
  });

  it("P-06: each preset leads on the category its name promises", () => {
    expect(PRESETS.quality.quality_of_work).toBe(8);
    expect(PRESETS.budget.value_price_honesty).toBe(8);
    expect(PRESETS.hygiene.safety_hygiene).toBe(8);
    expect(PRESETS.bridal.quality_of_work).toBe(8);
  });
});
