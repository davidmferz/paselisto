import { beforeEach, describe, expect, it } from "vitest";
import { sendPassEmailForOrder } from "./send-pass-email";
import { FakeClock, FakeMailer, FakeRepo } from "@/test/fakes";
import type { Order } from "@/shared/ports";

const order: Order = {
  id: "ord-1", eventId: "ev1", buyerName: "Ana", buyerEmail: "ana@x.mx", amountCents: 35000,
  status: "paid", channel: "qr", peyQrId: "qr_1", peyTransactionId: "tx", expiresAt: new Date("2026-01-01T00:15:00Z"),
  paidAt: new Date("2026-01-01T00:05:00Z"), reviewReason: null, confirmedVia: "webhook", createdAt: new Date("2026-01-01T00:00:00Z"),
};

let repo: FakeRepo;
let mailer: FakeMailer;
const logs: unknown[][] = [];
const deps = () => ({ repo, mailer, appUrl: "https://paselisto.app", log: (...a: unknown[]) => void logs.push(a) });

beforeEach(() => {
  logs.length = 0;
  repo = new FakeRepo();
  mailer = new FakeMailer();
  void FakeClock;
  repo.seedEvent({
    id: "ev1", slug: "ceramica", name: "Cerámica", priceCents: 35000, capacity: 5,
    startsAt: new Date("2026-11-21T17:00:00Z"), venue: "Casa", contactEmail: "hola@x.mx", organizerName: "Barro",
  });
  repo.orders.set(order.id, { ...order });
  repo.passes.set("p1", { id: "p1", orderId: "ord-1", token: "tok123", usedAt: null });
});

describe("sendPassEmailForOrder", () => {
  it("sends once with recipient, reply-to, rendered content and order id", async () => {
    const r = await sendPassEmailForOrder(deps(), "ord-1");
    expect(r).toBe("sent");
    expect(mailer.sent).toHaveLength(1);
    const m = mailer.sent[0];
    expect(m.orderId).toBe("ord-1");
    expect(m.to).toBe("ana@x.mx");
    expect(m.replyTo).toBe("hola@x.mx");
    expect(m.subject).toMatch(/^Tu pase para Cerámica/);
    expect(m.html).toContain("tok123");
    expect(m.text).toContain("tok123");
    expect(repo.emailSentAt.has("ord-1")).toBe(true);
  });

  it("omits reply-to when the event has no contact email", async () => {
    repo.events.set("ev1", { ...repo.events.get("ev1")!, contactEmail: null });
    await sendPassEmailForOrder(deps(), "ord-1");
    expect(mailer.sent[0].replyTo).toBeUndefined();
  });

  it("does not send twice (claim is atomic)", async () => {
    const [a, b] = await Promise.all([sendPassEmailForOrder(deps(), "ord-1"), sendPassEmailForOrder(deps(), "ord-1")]);
    expect([a, b].sort()).toEqual(["already_sent", "sent"]);
    expect(mailer.sent).toHaveLength(1);
  });

  it("releases the claim when the send fails so a retry can resend, and never throws", async () => {
    mailer.failNext = 1;
    await expect(sendPassEmailForOrder(deps(), "ord-1")).resolves.toBe("failed");
    expect(repo.emailSentAt.has("ord-1")).toBe(false);
    expect(logs.length).toBeGreaterThan(0);
    await expect(sendPassEmailForOrder(deps(), "ord-1")).resolves.toBe("sent");
    expect(mailer.sent).toHaveLength(1);
  });

  it("releases the claim when the mailer is a no-op (skipped)", async () => {
    mailer.skip = true;
    await expect(sendPassEmailForOrder(deps(), "ord-1")).resolves.toBe("skipped");
    expect(repo.emailSentAt.has("ord-1")).toBe(false);
  });

  it("does nothing for orders that are not paid or have no pass", async () => {
    repo.orders.set("ord-1", { ...order, status: "review" });
    await expect(sendPassEmailForOrder(deps(), "ord-1")).resolves.toBe("not_applicable");
    repo.orders.set("ord-1", { ...order });
    repo.passes.clear();
    await expect(sendPassEmailForOrder(deps(), "ord-1")).resolves.toBe("not_applicable");
    await expect(sendPassEmailForOrder(deps(), "nope")).resolves.toBe("not_applicable");
    expect(mailer.sent).toHaveLength(0);
  });

  it("swallows repo errors", async () => {
    repo.findOrder = async () => {
      throw new Error("db down");
    };
    await expect(sendPassEmailForOrder(deps(), "ord-1")).resolves.toBe("failed");
  });
});
