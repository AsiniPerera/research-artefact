/* Category 3 (Management Responsiveness) headline figure.

   This arithmetic used to sit inline in the profile's category-3 card; it was
   moved here unchanged so the card's verdict and the "Responsiveness and
   adaptability" ring share one source. These tests pin the behaviour. */
import { describe, it, expect } from "vitest";
import { responsivenessFigure, statementMass, verdictFor } from "./responsiveness";

describe("verdictFor", () => {
  it("RS-01: maps a 0..100 figure to the site-wide score scale", () => {
    expect(verdictFor(100).word).toBe("Excellent");
    expect(verdictFor(85).word).toBe("Excellent");
    expect(verdictFor(84).word).toBe("Great");
    expect(verdictFor(70).word).toBe("Great");
    expect(verdictFor(69).word).toBe("Good");
    expect(verdictFor(50).word).toBe("Good");
    expect(verdictFor(49).word).toBe("Fair");
    expect(verdictFor(30).word).toBe("Fair");
    expect(verdictFor(29).word).toBe("Weak");
    expect(verdictFor(0).word).toBe("Weak");
  });

  it("RS-02: no figure means no verdict", () => {
    expect(verdictFor(null)).toBeNull();
  });
});

describe("statementMass", () => {
  it("RS-03: counts only part 3.5, with mixed statements split half and half", () => {
    const checks = [{ code: "3.1" }, { code: "3.5" }];
    const by = { "3.1": { positive: 99 }, "3.5": { positive: 6, negative: 1, mixed: 2 } };
    expect(statementMass(checks, by)).toEqual({ pos: 7, neg: 2 });
  });
});

describe("responsivenessFigure", () => {
  it("RS-04: without reply-quality data it falls back to the statement share", () => {
    expect(responsivenessFigure(null, 8, 2)).toEqual({ share: 80, parts: [] });
  });

  it("RS-05: no evidence anywhere gives no figure", () => {
    expect(responsivenessFigure(null, 0, 0)).toEqual({ share: null, parts: [] });
    expect(responsivenessFigure({}, 0, 0)).toEqual({ share: null, parts: [] });
  });

  it("RS-06: a salon that does everything right scores 100 across five parts", () => {
    const rq = {
      complaints: 4, complaints_replied: 4,
      specificity: { specific: 5 },
      stance: { accepts: 5 }, remedy: 5,
      promises: { kept: 3, broken: 0 },
    };
    const { share, parts } = responsivenessFigure(rq, 10, 0);
    expect(share).toBe(100);
    expect(parts.map((p) => p.code)).toEqual(["3.1", "3.2", "3.3", "3.4", "3.5"]);
    expect(parts.every((p) => p.value === 100)).toBe(true);
  });

  it("RS-07: the figure is the mean of only the parts that have evidence", () => {
    // only 3.1 has data: 2 of 4 complaints replied to -> 50
    const { share, parts } = responsivenessFigure({ complaints: 4, complaints_replied: 2 }, 0, 0);
    expect(share).toBe(50);
    expect(parts).toEqual([{ code: "3.1", label: "Replies to complaints", value: 50 }]);
  });

  it("RS-08: a partly-specific reply counts half; a generic one counts zero", () => {
    // 2 specific + 2 partly + 4 generic of 8 -> (2 + 1) / 8 = 0.375 -> 38
    const rq = { complaints: 0, specificity: { specific: 2, partly: 2, generic: 4 } };
    const { parts } = responsivenessFigure(rq, 0, 0);
    expect(parts).toEqual([
      { code: "3.2", label: "Replies address the concern", value: 38 },
    ]);
  });

  it("RS-09: broken promises pull part 3.4 down", () => {
    const { parts } = responsivenessFigure({ promises: { kept: 1, broken: 3 } }, 0, 0);
    expect(parts[0]).toMatchObject({ code: "3.4", value: 25 });
  });
});
