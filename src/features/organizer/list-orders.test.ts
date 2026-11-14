import { describe, expect, it } from "vitest";
import { computeCounters, listOrders } from "@/features/organizer/list-orders";
import { FakeClock, FakeRepo } from "@/test/fakes";
import type { Order } from "@/shared/ports";

const clock = new FakeClock();
const base = (o: Partial<Order> & { id: string }): Order => ({
  eventId: "e1", buyerName: "Ana", buyerEmail: "a@x.mx", amountCents: 1, status: "pending",
  channel: "qr", peyQrId: null, peyTransactionId: null,
  expiresAt: new Date(clock.now().getTime() + 900_000), paidAt: null, reviewReason: null, confirmedVia: null,
  createdAt: clock.now(), ...o,
});

const EV = { id: "e1", slug: "a", name: "Taller A", priceCents: 1, capacity: 10 };
function repoWith() {
  const r = new FakeRepo();
  r.seedEvent(EV);
  r.seedEvent({ ...EV, id: "e2", slug: "b", name: "Taller B" });
  return r;
}

describe("computeCounters", () => {
  it("vendidos=paid+used, reservados=pending, disponibles=capacity-vendidos-reservados, ingresaron=used", () => {
    expect(computeCounters({ pending: 2, paid: 3, used: 1, review: 4, expired: 5 }, 10)).toEqual({
      sold: 4, reserved: 2, available: 4, entered: 1, capacity: 10,
    });
  });
  it("available never goes negative", () => {
    expect(computeCounters({ pending: 5, paid: 9, used: 3, review: 0, expired: 0 }, 10).available).toBe(0);
  });
});

describe("listOrders (PC-S9, PC-S7)", () => {
  it("only lists the requested event and null for unknown events", async () => {
    const repo = repoWith();
    repo.orders.set("a", base({ id: "a", eventId: "e1" }));
    repo.orders.set("b", base({ id: "b", eventId: "e2" }));
    const r = (await listOrders(repo, clock, "e2"))!;
    expect(r.orders.map((o) => o.id)).toEqual(["b"]);
    expect(r.event).toMatchObject({ slug: "b", name: "Taller B", capacity: 10 });
    expect(r.counters).toMatchObject({ reserved: 1, available: 9 });
    expect(await listOrders(repo, clock, "nope")).toBeNull();
  });

  it("lists orders with display status and counts; used wins over paid", async () => {
    const repo = repoWith();
    repo.orders.set("a", base({ id: "a", status: "pending" }));
    repo.orders.set("b", base({ id: "b", status: "paid", paidAt: clock.now(), confirmedVia: "webhook" }));
    repo.orders.set("c", base({ id: "c", status: "paid", paidAt: clock.now() }));
    repo.orders.set("d", base({ id: "d", status: "review", reviewReason: "amount" }));
    repo.passes.set("p1", { id: "p1", orderId: "b", token: "t".repeat(22), usedAt: null });
    repo.passes.set("p2", { id: "p2", orderId: "c", token: "u".repeat(22), usedAt: clock.now() });

    const r = (await listOrders(repo, clock, "e1"))!;
    const byId = Object.fromEntries(r.orders.map((o) => [o.id, o.status]));
    expect(byId).toEqual({ a: "pending", b: "paid", c: "used", d: "review" });
    expect(r.counts).toEqual({ pending: 1, paid: 1, used: 1, review: 1, expired: 0 });
    expect(r.orders.find((o) => o.id === "d")?.reviewReason).toBe("amount");
    expect(r.orders.find((o) => o.id === "b")?.confirmedVia).toBe("webhook");
    expect(r.orders.find((o) => o.id === "a")?.confirmedVia).toBeNull();
  });

  it("derives expired lazily for pending orders past expiresAt", async () => {
    const repo = repoWith();
    repo.orders.set("a", base({ id: "a", expiresAt: new Date(clock.now().getTime() - 1) }));
    const r = (await listOrders(repo, clock, "e1"))!;
    expect(r.orders[0].status).toBe("expired");
    expect(r.counts.expired).toBe(1);
    expect(r.counts.pending).toBe(0);
  });

  it("returns newest first and never exposes pass tokens", async () => {
    const repo = repoWith();
    repo.orders.set("old", base({ id: "old", createdAt: new Date("2025-12-31T00:00:00Z") }));
    repo.orders.set("new", base({ id: "new" }));
    const r = (await listOrders(repo, clock, "e1"))!;
    expect(r.orders.map((o) => o.id)).toEqual(["new", "old"]);
    expect(JSON.stringify(r)).not.toContain("token");
  });
});
