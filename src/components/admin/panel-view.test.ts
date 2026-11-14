import { describe, expect, it } from "vitest";
import { barPercents, initials, orderSubline } from "./panel-view";

describe("initials", () => {
  it("takes first letters of up to two words", () => {
    expect(initials("Ana María López")).toBe("AM");
    expect(initials("  luis ")).toBe("L");
    expect(initials("")).toBe("?");
  });
});

describe("barPercents", () => {
  it("computes sold/reserved widths over capacity", () => {
    expect(barPercents({ sold: 5, reserved: 5, capacity: 20 })).toEqual({ sold: 25, reserved: 25 });
  });
  it("clamps and handles zero capacity", () => {
    expect(barPercents({ sold: 30, reserved: 30, capacity: 20 })).toEqual({ sold: 100, reserved: 0 });
    expect(barPercents({ sold: 1, reserved: 1, capacity: 0 })).toEqual({ sold: 0, reserved: 0 });
  });
});

describe("orderSubline", () => {
  const base = { createdAt: "2026-11-14T19:00:00.000Z", usedAt: null as string | null };
  const now = new Date("2026-11-14T19:10:00.000Z").getTime();
  it("pending shows reservation age", () => {
    expect(orderSubline({ ...base, status: "pending" }, now)).toBe("Reservado · hace 10 min");
  });
  it("paid shows paid time (Mexico City)", () => {
    expect(orderSubline({ ...base, status: "paid" }, now)).toBe("Pagó 13:00");
  });
  it("used adds entry time", () => {
    expect(orderSubline({ ...base, status: "used", usedAt: "2026-11-14T20:05:00.000Z" }, now)).toBe("Pagó 13:00 · Ingresó 14:05");
  });
  it("review/expired", () => {
    expect(orderSubline({ ...base, status: "review" }, now)).toBe("Pago por revisar");
    expect(orderSubline({ ...base, status: "expired" }, now)).toBe("QR vencido");
  });
});
