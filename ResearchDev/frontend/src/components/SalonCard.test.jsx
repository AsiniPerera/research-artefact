/* Ranked salon card — renders the score, the category breakdown, and links
   through to the business page.

   Maps to the evaluation plan's "Results component / salon card" group,
   adapted to the real card: it shows SIX category bars (Management
   Responsiveness, category 3, is reported-only and not shown on the card),
   each value being the stored 0..1 score rendered as a 0..100 integer. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SalonCard } from "./SalonCard";

const SALON = {
  place_id: "PLACE_123",
  provider_name: "House of Aura",
  city: "Pannipitiya",
  rank_no: 1,
  rank_status: "ranked",
  personal_score: 0.83,
  range_low: 0.68,
  range_high: 0.95,
  badges: "",
  reviews_total: 100,
  total_feedbacks: 80,
  category_scores: [
    { category_no: 1, score: 0.92 }, // Quality
    { category_no: 2, score: 0.60 }, // Care
    { category_no: 3, score: 0.50 }, // Management — reported only, NOT on card
    { category_no: 4, score: 0.97 }, // Trust
    { category_no: 5, score: 0.85 }, // Staff
    { category_no: 6, score: 0.78 }, // Value
    { category_no: 7, score: 0.86 }, // Safety
  ],
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* jsdom */ }
});

describe("<SalonCard />", () => {
  it("R-01: shows the salon name and its overall score", () => {
    render(<SalonCard salon={SALON} onSelect={() => {}} />);
    expect(screen.getByText("House of Aura")).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument(); // 0.83 -> 83
  });

  it("R-02: shows six category bars — the weighted six, not Management", () => {
    render(<SalonCard salon={SALON} onSelect={() => {}} />);
    const bars = screen.getByLabelText("Category scores");
    const labels = within(bars).getAllByText(
      /Quality|Care|Trust|Staff|Value|Safety|Management/
    ).map((el) => el.textContent);
    expect(labels).toEqual(
      expect.arrayContaining(["Quality", "Care", "Trust", "Staff", "Value", "Safety"])
    );
    expect(labels).not.toContain("Management");
    expect(labels).toHaveLength(6);
  });

  it("R-03: each bar value is the stored score as a 0..100 integer", () => {
    render(<SalonCard salon={SALON} onSelect={() => {}} />);
    const bars = screen.getByLabelText("Category scores");
    expect(within(bars).getByText("92")).toBeInTheDocument(); // Quality 0.92
    expect(within(bars).getByText("97")).toBeInTheDocument(); // Trust 0.97
    expect(within(bars).getByText("86")).toBeInTheDocument(); // Safety 0.86
  });

  it("R-04: View salon calls onSelect with the place_id", async () => {
    const onSelect = vi.fn();
    render(<SalonCard salon={SALON} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "View salon" }));
    expect(onSelect).toHaveBeenCalledWith("PLACE_123");
  });
});
