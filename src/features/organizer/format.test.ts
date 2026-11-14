import { describe, expect, it } from "vitest";
import { agoLabel, reviewReasonView } from "./format";

describe("agoLabel", () => {
  it("under 5s => justo ahora", () => expect(agoLabel(3000)).toBe("Actualizado ahora"));
  it("seconds", () => expect(agoLabel(12_400)).toBe("Actualizado hace 12 s"));
  it("minutes", () => expect(agoLabel(125_000)).toBe("Actualizado hace 2 min"));
  it("clamps negatives", () => expect(agoLabel(-50)).toBe("Actualizado ahora"));
});

describe("reviewReasonView", () => {
  it("amount", () => expect(reviewReasonView("amount").title).toBe("Monto diferente"));
  it("late", () => expect(reviewReasonView("late").title).toBe("Pago fuera de plazo"));
  it("capacity", () => expect(reviewReasonView("capacity").title).toBe("Sin cupo"));
  it("hints are non-empty", () => {
    for (const r of ["amount", "late", "capacity"]) expect(reviewReasonView(r).hint.length).toBeGreaterThan(5);
  });
  it("amount hint tells to check bank", () => expect(reviewReasonView("amount").hint).toContain("banco"));
  it("unknown/undefined falls back", () => {
    expect(reviewReasonView(undefined).title).toBe("Requiere revisión");
    expect(reviewReasonView("zzz").title).toBe("Requiere revisión");
  });
});

import { confirmedViaLabel } from "./format";

describe("confirmedViaLabel", () => {
  it("webhook", () => expect(confirmedViaLabel("webhook")).toBe("Confirmado por pey · webhook"));
  it("poll", () => expect(confirmedViaLabel("poll")).toBe("Confirmado por pey · consulta"));
  it("null/undefined => null", () => {
    expect(confirmedViaLabel(null)).toBeNull();
    expect(confirmedViaLabel(undefined)).toBeNull();
  });
});
