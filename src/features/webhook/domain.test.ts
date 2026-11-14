import { describe, expect, it } from "vitest";
import { decide } from "@/features/webhook/domain";
import type { Order } from "@/shared/ports";

const now = new Date("2026-01-01T00:10:00Z");
const order = (o: Partial<Order> = {}): Order => ({
  id: "o1",
  eventId: "e1",
  buyerName: "Ana",
  buyerEmail: "a@b.co",
  amountCents: 100,
  status: "pending",
  channel: "qr",
  peyQrId: "qr1",
  peyTransactionId: null,
  expiresAt: new Date("2026-01-01T00:15:00Z"),
  paidAt: null,
  reviewReason: null,
  confirmedVia: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...o,
});
const base = { paidCount: 0, capacity: 2, now };

describe("decide()", () => {
  it("S1 paid when pending, amount matches, capacity ok", () =>
    expect(decide({ order: order(), amountCents: 100, ...base })).toEqual({ kind: "paid" }));
  it("S9 noop when already paid", () =>
    expect(decide({ order: order({ status: "paid" }), amountCents: 100, ...base })).toEqual({ kind: "noop" }));
  it("S6 review(amount) on mismatch", () =>
    expect(decide({ order: order(), amountCents: 99, ...base })).toEqual({ kind: "review", reason: "amount" }));
  it("S7 review(late) when expired", () => {
    const o = order({ expiresAt: new Date("2026-01-01T00:05:00Z") });
    expect(decide({ order: o, amountCents: 100, ...base })).toEqual({ kind: "review", reason: "late" });
  });
  it("S7 review(late) when status expired", () =>
    expect(decide({ order: order({ status: "expired" }), amountCents: 100, ...base })).toEqual({
      kind: "review",
      reason: "late",
    }));
  it("S8 review(capacity) when paidCount >= capacity", () =>
    expect(decide({ order: order(), amountCents: 100, paidCount: 2, capacity: 2, now })).toEqual({
      kind: "review",
      reason: "capacity",
    }));
  it("last slot still paid (paidCount = capacity-1)", () =>
    expect(decide({ order: order(), amountCents: 100, paidCount: 1, capacity: 2, now })).toEqual({ kind: "paid" }));
  it("noop when already in review", () =>
    expect(decide({ order: order({ status: "review" }), amountCents: 100, ...base })).toEqual({ kind: "noop" }));
});
