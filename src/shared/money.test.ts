import { describe, expect, it } from "vitest";
import { toCents, toMxn } from "@/shared/money";

describe("money", () => {
  it("converts cents to MXN", () => {
    expect(toMxn(1)).toBe(0.01);
    expect(toMxn(150000)).toBe(1500);
    expect(toMxn(1999)).toBe(19.99);
  });
  it("converts MXN to cents without float drift", () => {
    expect(toCents(0.01)).toBe(1);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1.1)).toBe(110);
  });
  it("rejects non-integer cents", () => {
    expect(() => toMxn(1.5)).toThrow();
  });
});
