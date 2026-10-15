// Adds jest-dom matchers (toBeInTheDocument, toHaveTextContent, …) to every
// test, and clears the DOM between tests so renders don't bleed into each
// other.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
