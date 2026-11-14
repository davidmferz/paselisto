import { describe, expect, it } from "vitest";
import { mapRedeem, normalizeToken } from "@/features/checkin/domain";
import type { Order, Pass } from "@/shared/ports";

const used = new Date("2026-01-01T01:00:00Z");
const pass = (p: Partial<Pass> = {}): Pass => ({ id: "p1", orderId: "o1", token: "t", usedAt: null, ...p });
const order = (o: Partial<Order> = {}) => ({ buyerName: "Ana", status: "paid", ...o }) as Order;

const ev = { name: "Taller B", startsAt: new Date("2026-11-21T17:00:00Z") };
const base = { expectedEventId: "e1", event: ev };

describe("mapRedeem", () => {
  it("S3 OK with buyer name when freshly redeemed", () =>
    expect(mapRedeem({ ...base, redeemed: true, pass: pass({ usedAt: used }), order: order({ eventId: "e1" }) })).toEqual({ kind: "OK", buyer: "Ana" }));
  it("S4 ALREADY_USED with original usedAt", () =>
    expect(mapRedeem({ ...base, redeemed: false, pass: pass({ usedAt: used }), order: order({ eventId: "e1" }) })).toEqual({
      kind: "ALREADY_USED",
      usedAt: used,
    }));
  it("S6 NOT_FOUND for unknown token", () =>
    expect(mapRedeem({ ...base, redeemed: false, pass: null, order: null })).toEqual({ kind: "NOT_FOUND" }));
  it("NOT_PAID when order not paid", () =>
    expect(mapRedeem({ ...base, redeemed: false, pass: pass(), order: order({ eventId: "e1", status: "review" }) })).toEqual({ kind: "NOT_PAID" }));
});

describe("mapRedeem WRONG_EVENT", () => {
  it("other event -> WRONG_EVENT with that event's name and startsAt, never OK", () =>
    expect(mapRedeem({ ...base, redeemed: false, pass: pass(), order: order({ eventId: "e2" }) })).toEqual({
      kind: "WRONG_EVENT",
      eventName: "Taller B",
      startsAt: ev.startsAt,
    }));
  it("WRONG_EVENT wins over ALREADY_USED", () =>
    expect(
      mapRedeem({ ...base, redeemed: false, pass: pass({ usedAt: used }), order: order({ eventId: "e2" }) }).kind,
    ).toBe("WRONG_EVENT"));
  it("missing startsAt maps to null", () =>
    expect(
      mapRedeem({ expectedEventId: "e1", event: { name: "X" }, redeemed: false, pass: pass(), order: order({ eventId: "e2" }) }),
    ).toEqual({ kind: "WRONG_EVENT", eventName: "X", startsAt: null }));
});

describe("normalizeToken (PC-R4)", () => {
  it("trims valid token", () => expect(normalizeToken(" abcDEF012345_-abcdefgh ")).toBe("abcDEF012345_-abcdefgh"));
  it("null for malformed", () => {
    expect(normalizeToken("short")).toBeNull();
    expect(normalizeToken("has spaces in it 12345678")).toBeNull();
    expect(normalizeToken("")).toBeNull();
    expect(normalizeToken("a".repeat(200))).toBeNull();
  });
});
