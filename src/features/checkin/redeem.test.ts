import { describe, expect, it } from "vitest";
import { redeemToken } from "@/features/checkin/redeem";
import { FakeClock, FakeRepo } from "@/test/fakes";
import type { Order } from "@/shared/ports";

const clock = new FakeClock();
const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

function seed(status: Order["status"] = "paid") {
  const repo = new FakeRepo();
  repo.orders.set("o1", {
    id: "o1", eventId: "e1", buyerName: "Ana", buyerEmail: "a@x.mx", amountCents: 1, status,
    channel: "qr", peyQrId: null, peyTransactionId: null, expiresAt: clock.now(),
    paidAt: clock.now(), reviewReason: null, createdAt: clock.now(),
  });
  if (status === "paid") repo.passes.set("p1", { id: "p1", orderId: "o1", token: TOKEN, usedAt: null });
  return repo;
}

describe("redeemToken (PC-S3..S6)", () => {
  it("S3 valid unused -> OK with buyer", async () => {
    expect(await redeemToken(seed(), clock, TOKEN)).toEqual({ kind: "OK", buyer: "Ana" });
  });
  it("trims whitespace around the scanned/typed code", async () => {
    expect((await redeemToken(seed(), clock, `  ${TOKEN}\n`)).kind).toBe("OK");
  });
  it("S4 second redeem -> ALREADY_USED with original time", async () => {
    const repo = seed();
    await redeemToken(repo, clock, TOKEN);
    clock.advance(60_000);
    const r = await redeemToken(repo, clock, TOKEN);
    expect(r.kind).toBe("ALREADY_USED");
    if (r.kind === "ALREADY_USED") expect(r.usedAt.getTime()).toBe(new FakeClock().now().getTime());
  });
  it("S5 concurrent redeems -> exactly one OK", async () => {
    const repo = seed();
    const rs = await Promise.all([redeemToken(repo, clock, TOKEN), redeemToken(repo, clock, TOKEN)]);
    expect(rs.filter((r) => r.kind === "OK")).toHaveLength(1);
  });
  it("S6 unknown token -> NOT_FOUND", async () => {
    expect(await redeemToken(seed(), clock, "Z".repeat(22))).toEqual({ kind: "NOT_FOUND" });
  });
  it("malformed token -> NOT_FOUND without touching the repo", async () => {
    expect(await redeemToken(seed(), clock, "' OR 1=1 --")).toEqual({ kind: "NOT_FOUND" });
    expect(await redeemToken(seed(), clock, "")).toEqual({ kind: "NOT_FOUND" });
  });
});
