/* The fallback notice. A reader can rank a sub-service, a service or a whole
   category; when nothing can be ranked at the level they picked, the list is
   ranked one level up (Rebonding -> Chemical Hair Treatments -> Hair) and the
   notice must say, in one line, every level that fell short and which level
   the list is ranked for. When the picked level itself answered, no notice. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FallbackNotice } from "./FallbackNotice";
import { rankingFallback } from "../api/client";

const SUB = {
  code: "HR.CHEM.01", name: "Rebonding",
  service_code: "HR.CHEM", service: "Chemical Hair Treatments",
  category_code: "HR", category: "Hair",
};

const response = (requestedLevel, levelUsed, shown, sub = SUB) => ({
  requested_level: requestedLevel,
  level_used: levelUsed,
  requested: { code: sub.code, name: sub.name },
  shown,
  sub_service: sub,
});

const notice = (data) => {
  render(<FallbackNotice fallback={rankingFallback(data)} />);
  return screen.getByRole("status").textContent;
};

describe("FallbackNotice", () => {
  it("names the sub-service AND the service when it lands on the category", () => {
    const msg = notice(response("sub_service", "category", { code: "HR", name: "Hair" }));
    expect(msg).toMatch(/about Rebonding, or about Chemical Hair Treatments to rank any salon/);
    expect(msg).toMatch(/ranked for Hair as a whole/);
  });

  it("names only the sub-service when the service answers", () => {
    const msg = notice(response("sub_service", "service", { code: "HR.CHEM", name: "Chemical Hair Treatments" }));
    expect(msg).toMatch(/about Rebonding to rank any salon/);
    expect(msg).toMatch(/ranked for Chemical Hair Treatments, which includes it/);
    expect(msg).not.toMatch(/or about/);
  });

  it("names every level when nothing could be ranked anywhere", () => {
    const msg = notice(response("sub_service", "none", { code: "HR", name: "Hair" }));
    expect(msg).toMatch(/for Rebonding, or about Chemical Hair Treatments, or for Hair as a whole/);
  });

  it("is not shown when the sub-service itself was ranked", () => {
    expect(rankingFallback(response("sub_service", "sub_service", { code: "HR.CHEM.01", name: "Rebonding" }))).toBeNull();
  });

  it("is not shown when a picked service is ranked at the service", () => {
    const svc = { code: "HR.CUT", name: "Haircuts", service_code: "HR.CUT", service: "Haircuts",
                  category_code: "HR", category: "Hair" };
    expect(rankingFallback(response("service", "service", { code: "HR.CUT", name: "Haircuts" }, svc))).toBeNull();
  });

  it("a picked service that widens to its category does not repeat itself", () => {
    const svc = { code: "HR.CHEM", name: "Chemical Hair Treatments", service_code: "HR.CHEM",
                  service: "Chemical Hair Treatments", category_code: "HR", category: "Hair" };
    const msg = notice(response("service", "category", { code: "HR", name: "Hair" }, svc));
    expect(msg).toMatch(/about Chemical Hair Treatments to rank any salon/);
    expect(msg).not.toMatch(/or about Chemical Hair Treatments/);
    expect(msg).toMatch(/ranked for Hair as a whole/);
  });

  it("is not shown for a whole-category pick that ranks", () => {
    const cat = { code: "HR", name: "Hair", service_code: null, service: null, category_code: "HR", category: "Hair" };
    expect(rankingFallback(response("category", "category", { code: "HR", name: "Hair" }, cat))).toBeNull();
  });

  it("treats a response without requested_level as a sub-service request", () => {
    const old = response("sub_service", "service", { code: "HR.CHEM", name: "Chemical Hair Treatments" });
    delete old.requested_level;
    expect(rankingFallback(old)?.level).toBe("service");
  });
});
