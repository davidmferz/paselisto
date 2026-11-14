import { describe, expect, it } from "vitest";
import { mapRedeem, normalizeToken } from "@/features/checkin/domain";
import type { Order, Pass } from "@/shared/ports";

const used = new Date("2026-01-01T01:00:00Z");
const pass = (p: Partial<Pass> = {}): Pass => ({ id: "p1", orderId: "o1", token: "t", usedAt: null, ...p });
const order = (o: Partial<Order> = {}) => ({ buyerName: "Ana", status: "paid", ...o }) as Order;

describe("mapRedeem", () => {
  it("S3 OK with buyer name when freshly redeemed", () =>
    expect(mapRedeem({ redeemed: true, pass: pass({ usedAt: used }), order: order() })).toEqual({ kind: "OK", buyer: "Ana" }));
  it("S4 ALREADY_USED with original usedAt", () =>
    expect(mapRedeem({ redeemed: false, pass: pass({ usedAt: used }), order: order() })).toEqual({
      kind: "ALREADY_USED",
      usedAt: used,
    }));
  it("S6 NOT_FOUND for unknown token", () =>
    expect(mapRedeem({ redeemed: false, pass: null, order: null })).toEqual({ kind: "NOT_FOUND" }));
  it("NOT_PAID when order not paid", () =>
    expect(mapRedeem({ redeemed: false, pass: pass(), order: order({ status: "review" }) })).toEqual({ kind: "NOT_PAID" }));
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
