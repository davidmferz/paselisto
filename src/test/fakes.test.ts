import { describe, expect, it } from "vitest";
import { FakeClock, FakePey, FakeRepo } from "./fakes";

describe("fakes", () => {
  it("FakeRepo rolls back on error", async () => {
    const repo = new FakeRepo();
    await expect(
      repo.withEventLock("e", async (tx) => {
        await tx.recordWebhook("w1", "t", {});
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const again = await repo.withEventLock("e", (tx) => tx.recordWebhook("w1", "t", {}));
    expect(again).toBe(true);
  });

  it("FakeRepo dedupes webhook ids within committed state", async () => {
    const repo = new FakeRepo();
    expect(await repo.withEventLock("e", (tx) => tx.recordWebhook("w1", "t", {}))).toBe(true);
    expect(await repo.withEventLock("e", (tx) => tx.recordWebhook("w1", "t", {}))).toBe(false);
  });

  it("FakePey fails then succeeds; FakeClock advances", async () => {
    const pey = new FakePey();
    pey.failNext = 1;
    await expect(pey.createQr({ amountCents: 1, concept: "c", expirationSec: 900, orderId: "o" })).rejects.toThrow();
    const r = await pey.createQr({ amountCents: 1, concept: "c", expirationSec: 900, orderId: "o" });
    expect(await pey.getQrStatus(r.id)).toBe("PENDING");
    const c = new FakeClock();
    const t0 = c.now().getTime();
    c.advance(1000);
    expect(c.now().getTime() - t0).toBe(1000);
  });

  it("FakeRepo listEvents orders by startsAt with nulls last; findEventById", async () => {
    const repo = new FakeRepo();
    const e = (id: string, startsAt?: Date) => ({ id, slug: id, name: id, priceCents: 1, capacity: 1, startsAt });
    repo.seedEvent(e("nodate"));
    repo.seedEvent(e("late", new Date("2026-12-01T00:00:00Z")));
    repo.seedEvent(e("early", new Date("2026-11-01T00:00:00Z")));
    expect((await repo.listEvents()).map((x) => x.id)).toEqual(["early", "late", "nodate"]);
    expect((await repo.findEventById("late"))?.id).toBe("late");
    expect(await repo.findEventById("zzz")).toBeNull();
  });
});

describe("FakeRepo pass email claim + findPassByToken", () => {
  it("claims once, releases, and finds a pass by token", async () => {
    const { FakeRepo } = await import("./fakes");
    const r = new FakeRepo();
    expect(await r.claimPassEmail("o1")).toBe(true);
    expect(await r.claimPassEmail("o1")).toBe(false);
    await r.releasePassEmail("o1");
    expect(await r.claimPassEmail("o1")).toBe(true);
    r.passes.set("p", { id: "p", orderId: "o1", token: "t", usedAt: null });
    expect(await r.findPassByToken("t")).toMatchObject({ orderId: "o1" });
    expect(await r.findPassByToken("zzz")).toBeNull();
  });
});
