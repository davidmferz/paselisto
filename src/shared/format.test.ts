import { describe, expect, it } from "vitest";
import { formatEventDate, formatMxn } from "./format";

describe("formatMxn", () => {
  it("formats cents as MXN", () => {
    expect(formatMxn(15000)).toMatch(/150\.00/);
    expect(formatMxn(1)).toMatch(/0\.01/);
  });
});

describe("formatEventDate", () => {
  it("renders in America/Mexico_City regardless of server tz", () => {
    const out = formatEventDate(new Date("2026-11-21T17:00:00Z")); // 11:00 CST (UTC-6)
    expect(out).toMatch(/21/);
    expect(out).toMatch(/11:00/);
  });
});
