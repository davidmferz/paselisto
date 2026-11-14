import { describe, expect, it } from "vitest";
import { deriveEventStatus, listMyEvents } from "./list-events";
import { FakeClock, FakeRepo } from "@/test/fakes";
import type { Order } from "@/shared/ports";

const clock = new FakeClock(new Date("2026-11-14T12:00:00Z"));
const ord = (id: string, eventId: string, status: Order["status"]): Order => ({
  id, eventId, buyerName: "A", buyerEmail: "a@x.mx", amountCents: 1, status, channel: "qr", peyQrId: null,
  peyTransactionId: null, expiresAt: new Date(clock.now().getTime() + 900_000), paidAt: null, reviewReason: null,
  confirmedVia: null, createdAt: clock.now(),
});

describe("deriveEventStatus", () => {
  const now = clock.now();
  it("FINALIZADO when it already started", () => expect(deriveEventStatus(new Date("2026-11-01T00:00:00Z"), 5, now)).toBe("finalizado"));
  it("AGOTADO when no spots left", () => expect(deriveEventStatus(new Date("2026-12-01T00:00:00Z"), 0, now)).toBe("agotado"));
  it("A LA VENTA otherwise (also without date)", () => {
    expect(deriveEventStatus(new Date("2026-12-01T00:00:00Z"), 3, now)).toBe("a_la_venta");
    expect(deriveEventStatus(null, 3, now)).toBe("a_la_venta");
  });
  it("finalizado wins over agotado", () => expect(deriveEventStatus(new Date("2026-11-01T00:00:00Z"), 0, now)).toBe("finalizado"));
});

describe("listMyEvents", () => {
  it("returns per-event counters and status", async () => {
    const repo = new FakeRepo();
    repo.seedEvent({ id: "e1", slug: "a", name: "A", priceCents: 1, capacity: 3, startsAt: new Date("2026-12-01T17:00:00Z") });
    repo.seedEvent({ id: "e2", slug: "b", name: "B", priceCents: 1, capacity: 10, startsAt: new Date("2026-10-01T17:00:00Z") });
    repo.orders.set("1", ord("1", "e1", "paid"));
    repo.orders.set("2", ord("2", "e1", "pending"));
    repo.orders.set("3", ord("3", "e1", "paid"));
    const r = await listMyEvents(repo, clock);
    expect(r.map((e) => e.slug)).toEqual(["b", "a"]);
    const a = r.find((e) => e.slug === "a")!;
    expect(a.counters).toMatchObject({ sold: 2, reserved: 1, available: 0, capacity: 3 });
    expect(a.status).toBe("agotado");
    expect(r.find((e) => e.slug === "b")!.status).toBe("finalizado");
    expect(a.startsAt).toBe("2026-12-01T17:00:00.000Z");
  });
  it("empty list for no events", async () => expect(await listMyEvents(new FakeRepo(), clock)).toEqual([]));
});
