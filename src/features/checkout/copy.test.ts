import { describe, expect, it } from "vitest";
import { formatAgo, shortRef, validateBuyerFields } from "./copy";

describe("shortRef", () => {
  it("first 8 chars of the id, uppercase", () => {
    expect(shortRef("1a2b3c4d-0000-4000-8000-000000000000")).toBe("1A2B3C4D");
  });
});

describe("formatAgo", () => {
  it("renders seconds, then minutes", () => {
    expect(formatAgo(0)).toBe("hace 0 s");
    expect(formatAgo(4_900)).toBe("hace 4 s");
    expect(formatAgo(59_000)).toBe("hace 59 s");
    expect(formatAgo(125_000)).toBe("hace 2 min");
  });
  it("never negative", () => {
    expect(formatAgo(-5000)).toBe("hace 0 s");
  });
});

describe("validateBuyerFields", () => {
  it("ok with no errors", () => {
    expect(validateBuyerFields({ name: "Ana", email: "a@b.co" })).toEqual({});
  });
  it("reports per-field errors in Mexican Spanish", () => {
    expect(validateBuyerFields({ name: " ", email: "x" })).toEqual({
      name: "Escribe tu nombre completo",
      email: "Escribe un correo válido, por ejemplo nombre@correo.com",
    });
    expect(validateBuyerFields({ name: "Ana", email: "x" }).name).toBeUndefined();
  });
});
