/* Ranked salon card — renders the score, the category breakdown, and links
   through to the business page.

   Maps to the evaluation plan's "Results component / salon card" group,
   adapted to the real card: it carries SIX category scores (Management
   Responsiveness, category 3, is reported-only and never shown), each value
   being the stored 0..1 score rendered as a 0..100 integer. They open on the
   row's arrow, so the tests press it first. */

/** The row face carries only the name and the score; the six category scores
    open on the row's arrow. */
async function openCategories(user) {
  await user.click(screen.getByRole("button", { name: /Show category scores/i }));
  return screen.getByLabelText("Every category score");
}
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

  it("R-02: shows six category bars — the weighted six, not Management", async () => {
    render(<SalonCard salon={SALON} onSelect={() => {}} />);
    const bars = await openCategories(userEvent.setup());
    const labels = within(bars).getAllByText(
      /Quality|Care|Trust|Staff|Value|Safety|Management/
    ).map((el) => el.textContent);
    expect(labels).toEqual(
      expect.arrayContaining(["Quality", "Care", "Trust", "Staff", "Value", "Safety"])
    );
    expect(labels).not.toContain("Management");
    expect(labels).toHaveLength(6);
  });

  it("R-03: each bar value is the stored score as a 0..100 integer", async () => {
    render(<SalonCard salon={SALON} onSelect={() => {}} />);
    const bars = await openCategories(userEvent.setup());
    expect(within(bars).getByText("92")).toBeInTheDocument(); // Quality 0.92
    expect(within(bars).getByText("97")).toBeInTheDocument(); // Trust 0.97
    expect(within(bars).getByText("86")).toBeInTheDocument(); // Safety 0.86
  });

  it("R-03b: the category scores stay hidden until the arrow is pressed", async () => {
    render(<SalonCard salon={SALON} onSelect={() => {}} />);
    expect(screen.queryByLabelText("Every category score")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Strongest categories")).not.toBeInTheDocument();
    await openCategories(userEvent.setup());
    expect(screen.getByLabelText("Every category score")).toBeInTheDocument();
  });

  it("R-04: the salon name opens the salon by place_id", async () => {
    const onSelect = vi.fn();
    render(<SalonCard salon={SALON} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "House of Aura" }));
    expect(onSelect).toHaveBeenCalledWith("PLACE_123");
  });

  it("R-05: opening the breakdown, and reading it, never opens the salon", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SalonCard salon={SALON} onSelect={onSelect} />);
    const bars = await openCategories(user);
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(bars);
    expect(onSelect).not.toHaveBeenCalled();
  });

});

/* No-data categories (backend/salon_db/29_no_data_dimensions.sql): a category
   nobody wrote about arrives with evidence_count 0 and counts as 0 in the
   ranking. The card shows that 0, but flagged and explained, so it cannot be
   mistaken for a measured zero, and the "why" sentence never names it. */
describe("SalonCard — no-data categories", () => {
  const NO_CARE = {
    ...SALON,
    category_scores: [
      { category_no: 1, score: 0.92, evidence_count: 14 },
      { category_no: 2, score: null, evidence_count: 0 },   // no data: left out
      { category_no: 4, score: 0.97, evidence_count: 25 },
      { category_no: 5, score: 0.85, evidence_count: 17 },
      { category_no: 6, score: null, evidence_count: 0 },   // no data
      { category_no: 7, score: 0.86, evidence_count: 9 },
    ],
  };

  it("shows a no-data category as a dash, flagged and explained", async () => {
    const user = userEvent.setup();
    render(<SalonCard salon={NO_CARE} onSelect={() => {}} position={1} />);
    const cats = await openCategories(user);
    const items = within(cats).getAllByRole("listitem");
    const care = items.find((li) => li.textContent.startsWith("Care"));
    const quality = items.find((li) => li.textContent.startsWith("Quality"));
    expect(care.textContent).toBe("Care–");
    expect(care.className).toMatch(/slr-cat--nodata/);
    expect(care.getAttribute("data-tip")).toMatch(/left out of the score/);
    expect(within(cats).queryByText("0")).toBeNull();   // never a measured-looking zero
    expect(quality.textContent).toBe("Quality92");
    expect(quality.className).not.toMatch(/nodata/);   // a measured score is not flagged
  });

  it("leaves no-data categories out of the explanation", async () => {
    const user = userEvent.setup();
    // The "why" sentence is only written when the reader's priorities are known.
    render(<SalonCard salon={NO_CARE} onSelect={() => {}} position={1}
                      priorities={[2, 8, 0, 2, 2, 8, 2]} />);
    await openCategories(user);
    const why = document.querySelector(".slr-why").textContent;
    expect(why).not.toMatch(/Care/);
    expect(why).not.toMatch(/Value/);
  });
});
