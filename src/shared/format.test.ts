import { describe, expect, it } from "vitest";
import { formatMxn } from "./format";

describe("formatMxn", () => {
  it("formats cents as MXN", () => {
    expect(formatMxn(15000)).toMatch(/150\.00/);
    expect(formatMxn(1)).toMatch(/0\.01/);
  });
});
