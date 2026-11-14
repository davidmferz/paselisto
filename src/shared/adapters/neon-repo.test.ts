import { describe, it, expect } from "vitest";
import { mapOrderRow, mapPassRow, mapEventRow, orderPatchToSet, mapRedeemRow, classifyEventInsertError } from "./neon-repo";

const d = new Date("2026-01-01T10:00:00.000Z");

describe("neon-repo row mapping", () => {
  it("maps an order row to the domain Order (cents stay integers)", () => {
    const o = mapOrderRow({
      id: "o1", event_id: "e1", buyer_name: "Ana", buyer_email: "a@x.mx", amount_cents: 1,
      status: "pending", channel: "qr", pey_qr_id: "q1", pey_transaction_id: null,
      expires_at: d, paid_at: null, review_reason: null, confirmed_via: "poll", created_at: d, pey_qr_string: "0002-qr",
    });
    expect(o).toEqual({
      id: "o1", eventId: "e1", buyerName: "Ana", buyerEmail: "a@x.mx", amountCents: 1,
      status: "pending", channel: "qr", peyQrId: "q1", peyTransactionId: null,
      expiresAt: d, paidAt: null, reviewReason: null, confirmedVia: "poll", createdAt: d, peyQrString: "0002-qr",
    });
  });

  it("maps a missing pey_qr_string to null", () => {
    const o = mapOrderRow({
      id: "o1", event_id: "e1", buyer_name: "Ana", buyer_email: "a@x.mx", amount_cents: 1,
      status: "pending", channel: "qr", expires_at: d, created_at: d,
    });
    expect(o.peyQrString).toBeNull();
  });

  it("patch can set pey_qr_string", () => {
    expect(orderPatchToSet({ peyQrString: "qr" }).sql).toBe("pey_qr_string = $1");
  });

  it("maps a pass row", () => {
    expect(mapPassRow({ id: "p", order_id: "o", token: "t", used_at: null })).toEqual({
      id: "p", orderId: "o", token: "t", usedAt: null,
    });
  });

  it("maps an event row (legacy columns null)", () => {
    expect(mapEventRow({ id: "e", slug: "s", name: "N", price_cents: 100, capacity: 5 })).toEqual({
      id: "e", slug: "s", name: "N", priceCents: 100, capacity: 5,
      description: null, startsAt: null, venue: null, contactEmail: null, createdAt: null,
      organizerName: null, createdByRequest: null,
    });
  });

  it("maps the extended event columns", () => {
    expect(
      mapEventRow({
        id: "e", slug: "s", name: "N", price_cents: 100, capacity: 5,
        description: "d", starts_at: d, venue: "V", contact_email: "c@x.mx", created_at: d,
      }),
    ).toMatchObject({ description: "d", startsAt: d, venue: "V", contactEmail: "c@x.mx", createdAt: d });
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

  it("maps redeem rows: ok / already used / not paid / wrong event", () => {
    const row = { buyer_name: "Ana", status: "paid", used_at: d, event_id: "e1", event_name: "A", starts_at: d };
    expect(mapRedeemRow(row, true, "e1")).toEqual({ kind: "OK", buyer: "Ana" });
    expect(mapRedeemRow(row, false, "e1")).toEqual({ kind: "ALREADY_USED", usedAt: d });
    expect(mapRedeemRow({ ...row, status: "review", used_at: null }, false, "e1")).toEqual({ kind: "NOT_PAID" });
    expect(mapRedeemRow(null, false, "e1")).toEqual({ kind: "NOT_FOUND" });
    expect(mapRedeemRow({ ...row, used_at: null }, false, "e2")).toEqual({
      kind: "WRONG_EVENT", eventName: "A", startsAt: d,
    });
  });
});

describe("event creation helpers", () => {
  it("maps organizer_name and created_by_request", () => {
    expect(
      mapEventRow({ id: "e", slug: "s", name: "N", price_cents: 1, capacity: 1, organizer_name: "Org", created_by_request: "k" }),
    ).toMatchObject({ organizerName: "Org", createdByRequest: "k" });
    expect(mapEventRow({ id: "e", slug: "s", name: "N", price_cents: 1, capacity: 1 })).toMatchObject({
      organizerName: null, createdByRequest: null,
    });
  });

  it("classifies unique violations by constraint, rethrows anything else", () => {
    expect(classifyEventInsertError({ code: "23505", constraint: "events_slug_key" })).toBe("slug_taken");
    expect(classifyEventInsertError({ code: "23505", constraint: "events_pkey" })).toBe("slug_taken");
    expect(classifyEventInsertError({ code: "23505", constraint: "events_created_by_request_key" })).toBe("key_taken");
    expect(() => classifyEventInsertError({ code: "23505", constraint: "other" })).toThrow();
    expect(() => classifyEventInsertError(new Error("boom"))).toThrow("boom");
  });
});
