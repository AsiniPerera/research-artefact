/* The page before a service is picked. Everything on it only reports a choice:
   a favourite starts a sub-service, a tile starts a whole category. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChooseService } from "./ChooseService";

const POPULAR = [
  { code: "HR.CUT.01", name: "Haircut & Trim", ranked: 39, value: "haircut_trim" },
  { code: "NL.CARE.01", name: "Manicure & Pedicure", ranked: 14, value: "manicure_pedicure" },
];

describe("ChooseService", () => {
  it("offers each favourite by name, without a count", () => {
    render(<ChooseService popular={POPULAR} />);
    expect(screen.getByRole("button", { name: "Haircut & Trim" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manicure & Pedicure" })).toBeTruthy();
    expect(screen.queryByText(/ranked/)).toBeNull();
  });

  it("starts the picked favourite", async () => {
    const onStartWith = vi.fn();
    render(<ChooseService popular={POPULAR} onStartWith={onStartWith} />);
    await userEvent.click(screen.getByRole("button", { name: /Haircut & Trim/ }));
    expect(onStartWith).toHaveBeenCalledWith(POPULAR[0]);
  });

  it("has one tile per category and starts the whole category", async () => {
    const onStartCategory = vi.fn();
    render(<ChooseService popular={[]} onStartCategory={onStartCategory} />);
    for (const name of ["Hair", "Skin & Beauty", "Nail Care", "Wedding, Events & Occasions"]) {
      expect(screen.getByText(`Rank all of ${name}`)).toBeTruthy();
    }
    await userEvent.click(screen.getByRole("button", { name: /Rank all of Hair/ }));
    expect(onStartCategory).toHaveBeenCalledWith(expect.objectContaining({ id: "HR", value: "hair" }));
  });

  it("skips the favourites row when there are none, and still shows the way in", () => {
    render(<ChooseService popular={[]} />);
    expect(screen.queryByText("Start with a favourite")).toBeNull();
    expect(screen.getByText("What are you looking for?")).toBeTruthy();
    expect(screen.getByText("Pick a service")).toBeTruthy();
  });
});
