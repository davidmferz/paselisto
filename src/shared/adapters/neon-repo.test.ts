import { describe, it, expect } from "vitest";
import { mapOrderRow, mapPassRow, mapEventRow, orderPatchToSet, mapRedeemRow } from "./neon-repo";

const d = new Date("2026-01-01T10:00:00.000Z");

describe("neon-repo row mapping", () => {
  it("maps an order row to the domain Order (cents stay integers)", () => {
    const o = mapOrderRow({
      id: "o1", event_id: "e1", buyer_name: "Ana", buyer_email: "a@x.mx", amount_cents: 1,
      status: "pending", channel: "qr", pey_qr_id: "q1", pey_transaction_id: null,
      expires_at: d, paid_at: null, review_reason: null, created_at: d,
    });
    expect(o).toEqual({
      id: "o1", eventId: "e1", buyerName: "Ana", buyerEmail: "a@x.mx", amountCents: 1,
      status: "pending", channel: "qr", peyQrId: "q1", peyTransactionId: null,
      expiresAt: d, paidAt: null, reviewReason: null, createdAt: d,
    });
  });

  it("maps a pass row", () => {
    expect(mapPassRow({ id: "p", order_id: "o", token: "t", used_at: null })).toEqual({
      id: "p", orderId: "o", token: "t", usedAt: null,
    });
  });

  it("maps an event row", () => {
    expect(mapEventRow({ id: "e", slug: "s", name: "N", price_cents: 100, capacity: 5 })).toEqual({
      id: "e", slug: "s", name: "N", priceCents: 100, capacity: 5,
    });
  });

  it("builds a SET clause from a partial patch with snake_case columns", () => {
    const { sql, values } = orderPatchToSet({ status: "paid", peyTransactionId: "tx", paidAt: d });
    expect(sql).toBe("status = $1, pey_transaction_id = $2, paid_at = $3");
    expect(values).toEqual(["paid", "tx", d]);
  });

  it("returns empty set for empty patch and ignores undefined / unknown keys", () => {
    expect(orderPatchToSet({}).sql).toBe("");
    expect(orderPatchToSet({ status: undefined }).sql).toBe("");
  });

  it("maps redeem rows: ok / already used / not paid", () => {
    expect(mapRedeemRow({ buyer_name: "Ana", status: "paid", used_at: d }, true)).toEqual({ kind: "OK", buyer: "Ana" });
    expect(mapRedeemRow({ buyer_name: "Ana", status: "paid", used_at: d }, false)).toEqual({ kind: "ALREADY_USED", usedAt: d });
    expect(mapRedeemRow({ buyer_name: "Ana", status: "review", used_at: null }, false)).toEqual({ kind: "NOT_PAID" });
    expect(mapRedeemRow(null, false)).toEqual({ kind: "NOT_FOUND" });
  });
});
