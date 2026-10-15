/* "Overall salon score" on the profile: every category plus the Overall
   Verdict, weighted by the visitor's priorities. The API call is mocked; these
   cover what the section renders for each state it can be in. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../api/client", () => ({ getOverall: vi.fn() }));
import { getOverall } from "../api/client";
import { OverallSalonScore } from "./OverallSalonScore";

const cat = (category_no, name, score, statements, weight = 2) =>
  ({ category_no, name, score, statements, weight });

const DATA = {
  score: 0.9234,
  statements: 2400,
  categories: [
    cat(1, "Quality of the Result", 0.96, 425),
    cat(2, "Consultation & Aftercare", 0.6, 7),
    cat(4, "Trust & Recommendation", 0.99, 541),
    cat(5, "Staff & Customer Service", 0.88, 405),
    cat(6, "Value & Price Honesty", 0.5, 0),
    cat(7, "Safety, Hygiene & Facilities", 0.72, 54, 8),
    cat(8, "Overall Verdict", 0.95, 565),
  ],
};

// A block, not an arrow expression: returning the mock from beforeEach makes the
// runner call it again as a cleanup callback, and an unhandled rejection follows.
beforeEach(() => {
  getOverall.mockReset();
});

describe("<OverallSalonScore />", () => {
  it("OS-01: shows the score and its verdict", async () => {
    getOverall.mockResolvedValue(DATA);
    render(<OverallSalonScore placeId="P1" />);
    expect(await screen.findByText("92")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.queryByText(/statements read/i)).not.toBeInTheDocument();
  });

  it("OS-02: does not list the per-category breakdown", async () => {
    getOverall.mockResolvedValue(DATA);
    render(<OverallSalonScore placeId="P1" />);
    await screen.findByText("92");
    expect(screen.queryByText("Quality of the Result")).not.toBeInTheDocument();
    expect(screen.queryByText(/counts as 50/i)).not.toBeInTheDocument();
  });

  it("OS-05: says plainly that it does not change the ranking", async () => {
    getOverall.mockResolvedValue(DATA);
    render(<OverallSalonScore placeId="P1" />);
    expect(await screen.findByText(/does not change the ranking/i)).toBeInTheDocument();
  });

  it("OS-06: sends the visitor's priorities and review period to the API", async () => {
    getOverall.mockResolvedValue(DATA);
    render(<OverallSalonScore placeId="P1" window="1y" weights={[8, 2, 2, 2, 2, 2, 2]} />);
    await screen.findByText("92");
    expect(getOverall).toHaveBeenCalledWith(
      "P1", { weights: [8, 2, 2, 2, 2, 2, 2], window: "1y" }, expect.any(Object));
  });

  it("OS-07: a salon with nothing to score says so instead of showing a number", async () => {
    getOverall.mockResolvedValue({ score: null, statements: 0, categories: [] });
    render(<OverallSalonScore placeId="P1" />);
    expect(await screen.findByText(/nothing to show/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("OS-08: a failed request shows the error, not a blank box", async () => {
    getOverall.mockRejectedValue(new Error("Could not load"));
    render(<OverallSalonScore placeId="P1" />);
    expect(await screen.findByText("Could not load")).toBeInTheDocument();
  });

  it("OS-09: keeps Trust & Recommendation's own name", async () => {
    getOverall.mockResolvedValue(DATA);
    render(<OverallSalonScore placeId="P1" />);
    await screen.findByText("92");
    expect(screen.queryByText(/Customer Trust/)).not.toBeInTheDocument();
  });
});
