import { beforeEach, describe, expect, it } from "vitest";
import { FALLBACK_AFTER_MS, createOrder, getEventView, getOrderStatus } from "./use-cases";
import { applyPayment } from "@/features/webhook/handle-payment";
import { FakeClock, FakePey, FakeRepo } from "@/test/fakes";

const EVENT = { id: "ev1", slug: "fiesta", name: "Fiesta", priceCents: 15000, capacity: 2 };
const buyer = (n: number) => ({ name: `Ana ${n}`, email: `ana${n}@mail.com` });

let repo: FakeRepo;
let pey: FakePey;
let clock: FakeClock;
const deps = () => ({ repo, pey, clock });

beforeEach(() => {
  repo = new FakeRepo();
  pey = new FakePey();
  clock = new FakeClock();
  repo.seedEvent(EVENT);
});

describe("createOrder", () => {
  it("S1: creates a pending order, calls pey with metadata orderId, stores pey id, returns qrString", async () => {
    const r = await createOrder(deps(), { slug: "fiesta", ...buyer(1) });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    const order = repo.orders.get(r.orderId)!;
    expect(order.status).toBe("pending");
    expect(order.amountCents).toBe(15000);
    expect(order.expiresAt.getTime()).toBe(clock.now().getTime() + 900_000);
    expect(order.peyQrId).toBe("qr_1");
    expect(order.peyQrString).toBe("000201-qr_1");
    expect(r.qrString).toBe("000201-qr_1");
    expect(pey.createQrCalls).toHaveLength(1);
    expect(pey.createQrCalls[0]).toMatchObject({ orderId: r.orderId, amountCents: 15000, expirationSec: 900 });
  });

  it("S2: invalid email / empty name -> invalid, no order, no pey call", async () => {
    for (const bad of [
      { name: "Ana", email: "nope" },
      { name: "  ", email: "a@b.co" },
    ]) {
      const r = await createOrder(deps(), { slug: "fiesta", ...bad });
      expect(r.kind).toBe("invalid");
    }
    expect(repo.orders.size).toBe(0);
    expect(pey.createQrCalls).toHaveLength(0);
  });

  it("unknown slug -> event_not_found", async () => {
    const r = await createOrder(deps(), { slug: "nope", ...buyer(1) });
    expect(r.kind).toBe("event_not_found");
  });

  it("S3: sold out counts paid + unexpired pending, ignores expired pending", async () => {
    await createOrder(deps(), { slug: "fiesta", ...buyer(1) });
    await createOrder(deps(), { slug: "fiesta", ...buyer(2) });
    expect((await createOrder(deps(), { slug: "fiesta", ...buyer(3) })).kind).toBe("sold_out");
    expect(repo.orders.size).toBe(2);

    clock.advance(901_000); // both pendings expired -> capacity released
    expect((await createOrder(deps(), { slug: "fiesta", ...buyer(4) })).kind).toBe("ok");
  });

  it("S4: concurrent submits for the last slot create at most one order", async () => {
    await createOrder(deps(), { slug: "fiesta", ...buyer(1) });
    const results = await Promise.all([
      createOrder(deps(), { slug: "fiesta", ...buyer(2) }),
      createOrder(deps(), { slug: "fiesta", ...buyer(3) }),
    ]);
    expect(results.filter((r) => r.kind === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "sold_out")).toHaveLength(1);
    expect(repo.orders.size).toBe(2);
  });

  it("S5: pey failure frees the slot and returns pey_error; no QR", async () => {
    pey.failNext = 1;
    const r = await createOrder(deps(), { slug: "fiesta", ...buyer(1) });
    expect(r.kind).toBe("pey_error");
    const [order] = [...repo.orders.values()];
    expect(order.status).toBe("expired");
    expect(await repo.countOccupied("ev1", clock.now())).toBe(0);
    // slot is really free again
    expect((await createOrder(deps(), { slug: "fiesta", ...buyer(2) })).kind).toBe("ok");
  });
});

describe("getEventView", () => {
  it("returns event with spots left, null for unknown slug", async () => {
    await createOrder(deps(), { slug: "fiesta", ...buyer(1) });
    const v = await getEventView(deps(), "fiesta");
    expect(v).toMatchObject({ name: "Fiesta", priceCents: 15000, spotsLeft: 1 });
    expect(await getEventView(deps(), "nope")).toBeNull();
  });

  it("spotsLeft never negative", async () => {
    await createOrder(deps(), { slug: "fiesta", ...buyer(1) });
    await createOrder(deps(), { slug: "fiesta", ...buyer(2) });
    expect((await getEventView(deps(), "fiesta"))!.spotsLeft).toBe(0);
  });
});

describe("getOrderStatus", () => {
  async function newOrder() {
    const r = await createOrder(deps(), { slug: "fiesta", ...buyer(1) });
    if (r.kind !== "ok") throw new Error("setup");
    return r.orderId;
  }

  it("S8: unknown id -> not_found", async () => {
    expect(await getOrderStatus(deps(), "00000000-0000-4000-8000-000000000000")).toEqual({ kind: "not_found" });
  });

  it("pending within the fallback window does NOT call pey fallback", async () => {
    const id = await newOrder();
    pey.qrs.get("qr_1")!.status = "PAID";
    clock.advance(10_000);
    const r = await getOrderStatus(deps(), id);
    expect(r).toMatchObject({ kind: "found", status: "pending" });
  });

  it("S6: pending > fallback window and pey says PAID -> paid + exactly one pass (idempotent)", async () => {
    const id = await newOrder();
    pey.qrs.get("qr_1")!.status = "PAID";
    clock.advance(46_000);
    const r = await getOrderStatus(deps(), id);
    expect(r).toMatchObject({ kind: "found", status: "paid" });
    if (r.kind === "found") expect(r.passToken).toBeTruthy();
    await getOrderStatus(deps(), id);
    expect(repo.passes.size).toBe(1);
  });

  it("FALLBACK_AFTER_MS is 45s", () => {
    expect(FALLBACK_AFTER_MS).toBe(45_000);
  });

  it("fallback NOT triggered at 44s, triggered at 46s (recording 'poll')", async () => {
    const id = await newOrder();
    pey.qrs.get("qr_1")!.status = "PAID";
    clock.advance(44_000);
    expect(await getOrderStatus(deps(), id)).toMatchObject({ status: "pending" });
    clock.advance(2_000);
    expect(await getOrderStatus(deps(), id)).toMatchObject({ status: "paid" });
    expect(repo.orders.get(id)!.confirmedVia).toBe("poll");
  });

  it("S6: pey PENDING keeps pending; pey error is ignored", async () => {
    const id = await newOrder();
    clock.advance(46_000);
    expect(await getOrderStatus(deps(), id)).toMatchObject({ status: "pending" });
    pey.getQrStatus = async () => {
      throw new Error("404");
    };
    expect(await getOrderStatus(deps(), id)).toMatchObject({ status: "pending" });
  });

  it("S7: past expiry and unpaid -> expired, no fallback call", async () => {
    const id = await newOrder();
    clock.advance(901_000);
    let called = false;
    pey.getQrStatus = async () => {
      called = true;
      return "PAID";
    };
    expect(await getOrderStatus(deps(), id)).toMatchObject({ status: "expired" });
    expect(called).toBe(false);
  });

  it("paid via webhook path shows the pass token and holder name", async () => {
    const id = await newOrder();
    await applyPayment(
      { repo, clock },
      { webhookId: "w1", type: "codi.qr.payment_received", payload: {}, orderId: id, amountCents: 15000, source: "webhook" },
    );
    const r = await getOrderStatus(deps(), id);
    expect(r).toMatchObject({ kind: "found", status: "paid", buyerName: "Ana 1" });
    if (r.kind === "found") expect(r.passToken).toBe([...repo.passes.values()][0].token);
  });

  it("review status is surfaced", async () => {
    const id = await newOrder();
    await applyPayment(
      { repo, clock },
      { webhookId: "w1", type: "codi.qr.payment_received", payload: {}, orderId: id, amountCents: 1, source: "webhook" },
    );
    expect(await getOrderStatus(deps(), id)).toMatchObject({ status: "review" });
  });

  it("returns the persisted qrString while pending (works without ?qr=) and a short order ref", async () => {
    const id = await newOrder();
    const r = await getOrderStatus(deps(), id);
    expect(r).toMatchObject({ kind: "found", status: "pending", qrString: "000201-qr_1", orderRef: id.slice(0, 8).toUpperCase() });
  });

  it("does not expose qrString once the order left pending", async () => {
    const id = await newOrder();
    clock.advance(901_000);
    const r = await getOrderStatus(deps(), id);
    expect(r).toMatchObject({ status: "expired" });
    if (r.kind === "found") expect(r.qrString).toBeUndefined();
  });

  it("force check on an expired order that pey says PAID -> review (late), never a new order", async () => {
    const id = await newOrder();
    pey.qrs.get("qr_1")!.status = "PAID";
    clock.advance(901_000);
    expect(await getOrderStatus(deps(), id)).toMatchObject({ status: "expired" });
    const r = await getOrderStatus(deps(), id, { forceCheck: true });
    expect(r).toMatchObject({ status: "review" });
    expect(repo.orders.size).toBe(1);
    expect(repo.orders.get(id)!.reviewReason).toBe("late");
  });

  it("force check bypasses the 45s window for a pending order", async () => {
    const id = await newOrder();
    pey.qrs.get("qr_1")!.status = "PAID";
    clock.advance(5_000);
    expect(await getOrderStatus(deps(), id, { forceCheck: true })).toMatchObject({ status: "paid" });
  });

  it("force check on expired with pey PENDING stays expired", async () => {
    const id = await newOrder();
    clock.advance(901_000);
    expect(await getOrderStatus(deps(), id, { forceCheck: true })).toMatchObject({ status: "expired" });
  });
});
