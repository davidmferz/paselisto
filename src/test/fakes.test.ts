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
});
