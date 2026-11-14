import { describe, expect, it } from "vitest";
import { priceEyebrow } from "./view";

describe("priceEyebrow", () => {
  it("marks demo prices (<= $1)", () => {
    expect(priceEyebrow(100)).toBe("PRECIO DE DEMOSTRACIÓN");
    expect(priceEyebrow(50)).toBe("PRECIO DE DEMOSTRACIÓN");
  });
  it("uses plain label above $1", () => {
    expect(priceEyebrow(101)).toBe("PRECIO");
    expect(priceEyebrow(35000)).toBe("PRECIO");
  });
});
