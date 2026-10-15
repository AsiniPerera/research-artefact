/* Priority panel — the weight vector it produces and the slider UI.

   Maps to the evaluation plan's "Priority component" group, adapted to the
   real component: it renders the SIX weightable categories (category 3,
   Management Responsiveness, is reported-only and has no slider), each as a
   range slider defaulting to Medium. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeightLevels, toWeightList } from "./WeightLevels";
import { PRESETS } from "../constants/presets";

describe("toWeightList (weights -> 7-number API vector)", () => {
  it("W-01: an empty preference is Medium (2) for all seven", () => {
    expect(toWeightList({})).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  it("W-02: category 3's slot stays at the default — the panel never sets it", () => {
    // owner_responsiveness is 0 in the preset, but it is not weightable, so
    // toWeightList leaves index 2 at the Medium default rather than 0.
    const list = toWeightList(PRESETS.quality);
    expect(list).toEqual([8, 4, 2, 2, 2, 1, 2]);
    expect(list[2]).toBe(2);
  });

  it("W-03: a changed priority lands in the right category slot", () => {
    const list = toWeightList({ safety_hygiene: 8 }); // category 7 -> index 6
    expect(list[6]).toBe(8);
    expect(list.length).toBe(7);
  });
});

describe("<WeightLevels />", () => {
  const medium = Object.fromEntries(
    ["quality_of_work", "consultation_aftercare", "customer_trust",
     "staff_customer_service", "value_price_honesty", "safety_hygiene"].map((k) => [k, 2])
  );

  it("W-04: renders the six weightable categories, each defaulting to Medium", () => {
    render(<WeightLevels weights={medium} onChange={() => {}} />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(6);
    for (const s of sliders) expect(s).toHaveAttribute("aria-valuetext", "Medium");
    expect(screen.getByText("Quality of the Result")).toBeInTheDocument();
    expect(screen.getByText("Safety, Hygiene & Facilities")).toBeInTheDocument();
  });

  it("W-05: moving a slider reports the doubled level value for that category", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const onChange = vi.fn();
    render(<WeightLevels weights={medium} onChange={onChange} />);
    const quality = screen.getByLabelText("Quality of the Result");
    // stop index 3 is the top -> "Very high" -> value 8
    fireEvent.change(quality, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ quality_of_work: 8 })
    );
  });
});
