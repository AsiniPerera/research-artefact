/* Which sub-services the profile's "Scores by Service" tab lists.
   Only sub-services with feedbacks about them appear; one that nobody wrote
   about is not shown, and filtering to it says so. */
import { describe, it, expect } from "vitest";
import { hasFeedbacks, subServiceView } from "./subServiceRows";

const row = (code, over = {}) => ({
  sub_service_code: code, service_code: code.split(".").slice(0, 2).join("."),
  category: "Hair", evidence_reviews: 5, trust_score: 0.8,
  range_low: 0.7, range_high: 0.9, rank_status: "ranked", ...over,
});

const SERVICES = [
  row("HR.CUT.01", { evidence_reviews: 182, range_low: 0.79, range_high: 0.84 }),
  row("HR.CUT.02", { evidence_reviews: 9, range_low: 0.59, range_high: 0.96, rank_status: "available but not ranked" }),
  row("HR.SHV.02", { evidence_reviews: 0, range_low: 0.4, range_high: 1.0, rank_status: "available but not ranked" }),
  row("HR.SHV.03", { evidence_reviews: 0, range_low: 0.4, range_high: 1.0, rank_status: "available but not ranked" }),
  row("NL.CARE.01", { evidence_reviews: 14, category: "Nails", service_code: "NL.CARE" }),
];

describe("hasFeedbacks", () => {
  it("SS-01: zero means nothing is about this service", () => {
    expect(hasFeedbacks({ evidence_reviews: 0 })).toBe(false);
    expect(hasFeedbacks({ evidence_reviews: 1 })).toBe(true);
  });
  it("SS-02: a missing count is not treated as empty", () => {
    expect(hasFeedbacks({})).toBe(true);
  });
});

describe("subServiceView", () => {
  it("SS-03: lists only sub-services that have feedbacks", () => {
    const { state, rows } = subServiceView(SERVICES);
    expect(state).toBe("ok");
    expect(rows.map((r) => r.key).sort()).toEqual(["HR.CUT.01", "HR.CUT.02", "NL.CARE.01"]);
  });

  it("SS-04: one row per sub-service, never folded under a service", () => {
    const { rows } = subServiceView([
      row("SK.FAC.02", { evidence_reviews: 8 }),
      row("SK.FAC.03", { evidence_reviews: 8 }),   // identical siblings
      row("SK.FAC.04", { evidence_reviews: 8 }),
    ]);
    expect(rows).toHaveLength(3);
  });

  it("SS-05: surest first — narrowest band leads", () => {
    const { rows } = subServiceView(SERVICES);
    expect(rows[0].key).toBe("HR.CUT.01");     // 0.05 wide, before 0.37 wide
  });

  it("SS-06: counts rows shown against all that have feedbacks", () => {
    const v = subServiceView(SERVICES, { category: "Nails" });
    expect(v.shown).toBe(1);
    expect(v.total).toBe(3);
  });

  it("SS-07: filtering to a sub-service nobody wrote about says no-feedbacks", () => {
    const v = subServiceView(SERVICES, { service_code: "HR.SHV" });
    expect(v.state).toBe("no-feedbacks");
    expect(v.rows).toEqual([]);
  });

  it("SS-08: a filter that selects nothing at all is no-match, not no-feedbacks", () => {
    expect(subServiceView(SERVICES, { category: "Bridal" }).state).toBe("no-match");
  });

  it("SS-09: status filter still applies (ranked only)", () => {
    const { rows } = subServiceView(SERVICES, { status: "ranked" });
    expect(rows.map((r) => r.key).sort()).toEqual(["HR.CUT.01", "NL.CARE.01"]);
  });

  it("SS-10: a salon where nothing has feedbacks is no-feedbacks", () => {
    const v = subServiceView([row("HR.SHV.02", { evidence_reviews: 0 })]);
    expect(v.state).toBe("no-feedbacks");
  });
});
