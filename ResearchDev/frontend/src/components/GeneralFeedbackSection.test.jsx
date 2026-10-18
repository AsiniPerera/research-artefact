/* Feedback that no services found: salons in no ranking, shown in a section of
   their own and scored on the reader's priorities. It must say what it is,
   stay collapsed until asked, and say nothing at all when there is nobody. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* Only the network call is replaced; the card still needs the client's real
   helpers (splitBadges and friends). */
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal()),
  getGeneralFeedback: vi.fn(),
}));
import { getGeneralFeedback } from "../api/client";
import { GeneralFeedbackSection } from "./GeneralFeedbackSection";

const salon = (i, over = {}) => ({
  place_id: `P${i}`, provider_name: `General Salon ${i}`, city: "Malabe",
  personal_score: 0.9 - i * 0.05, rank_no: null, rank_status: "available but not ranked",
  evidence_reviews: 0, badges: null, audience: null,
  category_scores: [{ category_no: 4, score: 0.8, evidence_count: 3 }],
  ...over,
});
const respond = (salons) => getGeneralFeedback.mockResolvedValue({ count: salons.length, salons, window: "all" });
const props = { priorities: [2, 2, 0, 2, 2, 2, 2], city: "", availability: "open", consistencyWindow: "anytime", onSelectSalon: () => {} };

beforeEach(() => getGeneralFeedback.mockReset());

describe("GeneralFeedbackSection", () => {
  it("says what it is and stays collapsed until asked", async () => {
    respond([salon(1), salon(2), salon(3)]);
    const user = userEvent.setup();
    render(<GeneralFeedbackSection {...props} />);
    expect(await screen.findByText("Feedback that no services found")).toBeTruthy();
    expect(screen.getByText(/3 salons have feedback about the quality/)).toBeTruthy();
    expect(screen.getByText(/scored here on your priorities/)).toBeTruthy();
    expect(screen.queryByText("General Salon 1")).toBeNull();           // collapsed

    await user.click(screen.getByRole("button", { name: /Show these 3 salons/ }));
    expect(screen.getByText("General Salon 1")).toBeTruthy();
    expect(screen.getAllByText(/Rated for all its feedback/).length).toBe(3);
  });

  it("asks the API with the reader's priorities, city, status and window", async () => {
    respond([salon(1)]);
    render(<GeneralFeedbackSection {...props} city="Malabe" />);
    await screen.findByText("Feedback that no services found");
    expect(getGeneralFeedback).toHaveBeenCalledWith(
      [2, 2, 0, 2, 2, 2, 2], "Malabe", "open", "anytime", expect.any(Object));
  });

  it("renders nothing when there is nobody to show", async () => {
    respond([]);
    const { container } = render(<GeneralFeedbackSection {...props} />);
    await waitFor(() => expect(getGeneralFeedback).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("shows six at first and the rest on request", async () => {
    respond(Array.from({ length: 9 }, (_, i) => salon(i + 1)));
    const user = userEvent.setup();
    render(<GeneralFeedbackSection {...props} />);
    await user.click(await screen.findByRole("button", { name: /Show these 9 salons/ }));
    expect(screen.queryByText("General Salon 7")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show all 9" }));
    expect(screen.getByText("General Salon 9")).toBeTruthy();
  });

  it("honours the audience filter like the list above it", async () => {
    respond([salon(1, { audience: "ladies" }), salon(2, { audience: "gents" })]);
    const user = userEvent.setup();
    render(<GeneralFeedbackSection {...props} audience="ladies" />);
    await user.click(await screen.findByRole("button", { name: /Show this salon/ }));
    expect(screen.getByText("General Salon 1")).toBeTruthy();
    expect(screen.queryByText("General Salon 2")).toBeNull();
  });
});
