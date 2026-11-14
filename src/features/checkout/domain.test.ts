import { describe, expect, it } from "vitest";
import { canTransition, effectiveStatus, hasCapacity, validateBuyer } from "@/features/checkout/domain";
import type { Order } from "@/shared/ports";

const now = new Date("2026-01-01T00:10:00Z");
const order = (o: Partial<Order> = {}): Order => ({
  id: "o1",
  eventId: "e1",
  buyerName: "Ana",
  buyerEmail: "a@b.co",
  amountCents: 1,
  status: "pending",
  channel: "qr",
  peyQrId: null,
  peyTransactionId: null,
  expiresAt: new Date("2026-01-01T00:15:00Z"),
  paidAt: null,
  reviewReason: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...o,
});

describe("hasCapacity (EC-S3)", () => {
  it("true while occupied < capacity", () => expect(hasCapacity(4, 5)).toBe(true));
  it("false when occupied >= capacity", () => {
    expect(hasCapacity(5, 5)).toBe(false);
    expect(hasCapacity(6, 5)).toBe(false);
  });
});

describe("effectiveStatus lazy expiry (EC-S7)", () => {
  it("pending before expiry stays pending", () => expect(effectiveStatus(order(), now)).toBe("pending"));
  it("pending past expiry is expired", () =>
    expect(effectiveStatus(order({ expiresAt: new Date("2026-01-01T00:09:00Z") }), now)).toBe("expired"));
  it("paid never expires", () =>
    expect(effectiveStatus(order({ status: "paid", expiresAt: new Date("2025-01-01T00:00:00Z") }), now)).toBe("paid"));
});

describe("state machine", () => {
  it("allows pending -> paid/review/expired", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("pending", "review")).toBe(true);
    expect(canTransition("pending", "expired")).toBe(true);
  });
  it("allows expired -> review (late payment)", () => expect(canTransition("expired", "review")).toBe(true));
  it("forbids paid -> anything", () => {
    expect(canTransition("paid", "pending")).toBe(false);
    expect(canTransition("paid", "review")).toBe(false);
  });
});

describe("validateBuyer (EC-S2)", () => {
  it("accepts valid", () => expect(validateBuyer({ name: " Ana ", email: "a@b.co" })).toEqual({ ok: true, name: "Ana", email: "a@b.co" }));
  it("rejects empty name", () => expect(validateBuyer({ name: "  ", email: "a@b.co" }).ok).toBe(false));
  it("rejects bad email", () => {
    expect(validateBuyer({ name: "Ana", email: "nope" }).ok).toBe(false);
    expect(validateBuyer({ name: "Ana", email: "a@b" }).ok).toBe(false);
  });
});
