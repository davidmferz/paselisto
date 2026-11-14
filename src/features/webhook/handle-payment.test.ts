import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";
import { applyPayment, handlePeyWebhook } from "./handle-payment";
import { FakeClock, FakeRepo } from "@/test/fakes";
import type { Order, Tx } from "@/shared/ports";

const SECRET = "whsec_" + Buffer.from("super-secret-key-for-tests-0123456789").toString("base64");
const EVENT = { id: "ev1", slug: "fiesta", name: "Fiesta", priceCents: 1, capacity: 2 };

function order(over: Partial<Order> = {}): Order {
  return {
    id: "ord-1",
    eventId: "ev1",
    buyerName: "Ana",
    buyerEmail: "ana@x.mx",
    amountCents: 1,
    status: "pending",
    channel: "qr",
    peyQrId: "qr_1",
    peyTransactionId: null,
    expiresAt: new Date("2026-01-01T00:15:00Z"),
    paidAt: null,
    reviewReason: null,
    confirmedVia: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

function payload(over: Record<string, unknown> = {}) {
  return {
    type: "codi.qr.payment_received",
    amount: 0.01,
    codiQrId: "qr_1",
    transactionId: "tx_1",
    datePaid: 1767225660,
    metadata: { externalMetadata: { orderId: "ord-1" } },
    ...over,
  };
}

function signed(body: unknown, id = "msg_1", at = new Date()) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const wh = new Webhook(SECRET);
  return {
    raw,
    headers: new Headers({
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(at.getTime() / 1000)),
      "webhook-signature": wh.sign(id, at, raw),
    }),
  };
}

let repo: FakeRepo;
let clock: FakeClock;
let log: ReturnType<typeof vi.fn<(msg: string, data?: unknown) => void>>;
const passCount = () => repo.passes.size;

beforeEach(() => {
  repo = new FakeRepo();
  repo.seedEvent(EVENT);
  repo.orders.set("ord-1", order());
  clock = new FakeClock();
  log = vi.fn<(msg: string, data?: unknown) => void>();
});

const run = (s: { raw: string; headers: Headers }) =>
  handlePeyWebhook({ ...s, secret: SECRET, repo, clock, log });

describe("handlePeyWebhook", () => {
  it("S1: valid signature + pending order + matching amount => paid, 1 pass, 200", async () => {
    const res = await run(signed(payload()));
    expect(res.status).toBe(200);
    const o = repo.orders.get("ord-1")!;
    expect(o.status).toBe("paid");
    expect(o.peyTransactionId).toBe("tx_1");
    expect(o.paidAt).toEqual(new Date(1767225660 * 1000));
    expect(passCount()).toBe(1);
    expect([...repo.passes.values()][0].token).toHaveLength(22);
  });

  it("S2: missing signature headers => 401, no writes", async () => {
    const res = await run({ raw: JSON.stringify(payload()), headers: new Headers() });
    expect(res.status).toBe(401);
    expect(repo.orders.get("ord-1")!.status).toBe("pending");
    expect(repo.webhooks.size).toBe(0);
    expect(passCount()).toBe(0);
  });

  it("S2: tampered body => 401, no writes", async () => {
    const s = signed(payload());
    const res = await run({ raw: s.raw.replace("0.01", "9999"), headers: s.headers });
    expect(res.status).toBe(401);
    expect(repo.webhooks.size).toBe(0);
    expect(passCount()).toBe(0);
  });

  it("S3: stale timestamp => 401, no writes", async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const res = await run(signed(payload(), "msg_old", old));
    expect(res.status).toBe(401);
    expect(repo.webhooks.size).toBe(0);
    expect(passCount()).toBe(0);
  });

  it("R5: valid signature but malformed JSON => 400", async () => {
    const res = await run(signed("{not json"));
    expect(res.status).toBe(400);
    expect(passCount()).toBe(0);
  });

  it("S4: same webhook-id twice => 200 and still exactly 1 pass", async () => {
    await run(signed(payload(), "dup"));
    const res = await run(signed(payload(), "dup"));
    expect(res.status).toBe(200);
    expect(passCount()).toBe(1);
  });

  it("S5: unknown orderId and unknown codiQrId => 200 ignored, no pass", async () => {
    const res = await run(
      signed(payload({ codiQrId: "nope", metadata: { externalMetadata: { orderId: "ghost" } } })),
    );
    expect(res.status).toBe(200);
    expect(passCount()).toBe(0);
  });

  it("S5: missing orderId falls back to codiQrId correlation", async () => {
    const res = await run(signed(payload({ metadata: {} })));
    expect(res.status).toBe(200);
    expect(repo.orders.get("ord-1")!.status).toBe("paid");
    expect(passCount()).toBe(1);
  });

  it("S11: unknown type => 200 ignored, no change", async () => {
    const res = await run(signed(payload({ type: "something.else" })));
    expect(res.status).toBe(200);
    expect(repo.orders.get("ord-1")!.status).toBe("pending");
  });

  it("pn type with door-sale disabled => 200 ignored", async () => {
    const res = await run(signed(payload({ type: "codi.pn.payment_received" })));
    expect(res.status).toBe(200);
    expect(repo.orders.get("ord-1")!.status).toBe("pending");
  });

  it("logs header NAMES but never header values", async () => {
    const s = signed(payload(), "secret-msg-id");
    await run(s);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("webhook-id");
    expect(logged).toContain("webhook-signature");
    expect(logged).not.toContain("secret-msg-id");
    expect(logged).not.toContain(s.headers.get("webhook-signature")!);
  });

  it("S10: DB error mid-transaction => 500 and full rollback", async () => {
    const orig = repo.withEventLock.bind(repo);
    repo.withEventLock = (id, fn) =>
      orig(id, (tx: Tx) =>
        fn({
          ...tx,
          insertPass: async () => {
            throw new Error("db down");
          },
        }),
      );
    const res = await run(signed(payload(), "msg_err"));
    expect(res.status).toBe(500);
    expect(repo.orders.get("ord-1")!.status).toBe("pending");
    expect(repo.webhooks.has("msg_err")).toBe(false);
    expect(passCount()).toBe(0);
  });
});

describe("applyPayment", () => {
  const base = { type: "codi.qr.payment_received", payload: {}, orderId: "ord-1", amountCents: 1, source: "webhook" as const };

  it("S6: amount mismatch => review(amount), no pass", async () => {
    const r = await applyPayment({ repo, clock }, { ...base, webhookId: "w1", amountCents: 500 });
    expect(r).toEqual({ kind: "review", reason: "amount" });
    expect(repo.orders.get("ord-1")).toMatchObject({ status: "review", reviewReason: "amount" });
    expect(passCount()).toBe(0);
  });

  it("S7: late payment on expired order => review(late), no pass", async () => {
    clock.advance(60 * 60 * 1000);
    const r = await applyPayment({ repo, clock }, { ...base, webhookId: "w1" });
    expect(r).toEqual({ kind: "review", reason: "late" });
    expect(passCount()).toBe(0);
  });

  it("S8: capacity exhausted by others => review(capacity), never oversell", async () => {
    repo.orders.set("a", order({ id: "a", peyQrId: "qa", status: "paid" }));
    repo.orders.set("b", order({ id: "b", peyQrId: "qb", status: "paid" }));
    const r = await applyPayment({ repo, clock }, { ...base, webhookId: "w1" });
    expect(r).toEqual({ kind: "review", reason: "capacity" });
    expect(passCount()).toBe(0);
  });

  it("S9: already paid via polling, webhook with different id => no second pass", async () => {
    const first = await applyPayment({ repo, clock }, { ...base }); // polling path: no webhookId
    expect(first.kind).toBe("paid");
    const second = await applyPayment({ repo, clock }, { ...base, webhookId: "w-late" });
    expect(second.kind).toBe("noop");
    expect(passCount()).toBe(1);
  });

  it("polling path (no webhookId) records no webhook row", async () => {
    await applyPayment({ repo, clock }, { ...base });
    expect(repo.webhooks.size).toBe(0);
    expect(repo.orders.get("ord-1")!.status).toBe("paid");
  });

  it("duplicate webhookId => duplicate, no state change", async () => {
    await applyPayment({ repo, clock }, { ...base, webhookId: "w1" });
    const r = await applyPayment({ repo, clock }, { ...base, webhookId: "w1" });
    expect(r.kind).toBe("duplicate");
    expect(passCount()).toBe(1);
  });

  it("persists source 'webhook' when it transitions to paid", async () => {
    await applyPayment({ repo, clock }, { ...base, webhookId: "w1" });
    expect(repo.orders.get("ord-1")!.confirmedVia).toBe("webhook");
  });

  it("persists source 'poll' when the polling fallback pays", async () => {
    await applyPayment({ repo, clock }, { ...base, source: "poll" });
    expect(repo.orders.get("ord-1")!.confirmedVia).toBe("poll");
  });

  it("persists source on review transitions too", async () => {
    await applyPayment({ repo, clock }, { ...base, webhookId: "w1", amountCents: 500 });
    expect(repo.orders.get("ord-1")!.confirmedVia).toBe("webhook");
  });

  it("noop (already paid) does not overwrite confirmedVia", async () => {
    await applyPayment({ repo, clock }, { ...base, source: "poll" });
    await applyPayment({ repo, clock }, { ...base, webhookId: "w-late" });
    expect(repo.orders.get("ord-1")!.confirmedVia).toBe("poll");
  });

  it("webhook handler passes source 'webhook'", async () => {
    await run(signed(payload(), "msg_src"));
    expect(repo.orders.get("ord-1")!.confirmedVia).toBe("webhook");
  });

  it("unknown order => unknown_order", async () => {
    const r = await applyPayment({ repo, clock }, { ...base, orderId: "ghost", peyQrId: undefined });
    expect(r.kind).toBe("unknown_order");
  });
});

describe("applyPayment onPaid hook (post-commit notification)", () => {
  async function setup() {
    const repo = new FakeRepo();
    repo.seedEvent(EVENT);
    repo.orders.set("ord-1", order());
    const calls: string[] = [];
    const clock = new FakeClock(new Date("2026-01-01T00:05:00Z"));
    return { repo, clock, calls, onPaid: async (id: string) => void calls.push(id) };
  }
  const input = (over: Partial<Parameters<typeof applyPayment>[1]> = {}) => ({
    source: "webhook" as const, type: "t", payload: {}, orderId: "ord-1", amountCents: 1, webhookId: "w1", ...over,
  });

  it("fires exactly once, after the transaction, on pending -> paid (webhook)", async () => {
    const { repo, clock, calls, onPaid } = await setup();
    let sawPassAtCall = false;
    const hook = async (id: string) => {
      sawPassAtCall = (await repo.findPassByOrderId(id)) !== null && repo.orders.get(id)!.status === "paid";
      await onPaid(id);
    };
    await applyPayment({ repo, clock, onPaid: hook }, input());
    expect(calls).toEqual(["ord-1"]);
    expect(sawPassAtCall).toBe(true);
  });

  it("fires on the polling path too", async () => {
    const { repo, clock, calls, onPaid } = await setup();
    await applyPayment({ repo, clock, onPaid }, input({ source: "poll", webhookId: undefined }));
    expect(calls).toEqual(["ord-1"]);
  });

  it("does NOT fire on duplicate, noop, review or unknown order", async () => {
    const { repo, clock, calls, onPaid } = await setup();
    await applyPayment({ repo, clock, onPaid }, input());
    calls.length = 0;
    await applyPayment({ repo, clock, onPaid }, input()); // duplicate
    await applyPayment({ repo, clock, onPaid }, input({ webhookId: "w2" })); // noop (already paid)
    await applyPayment({ repo, clock, onPaid }, input({ orderId: "nope", webhookId: "w3" })); // unknown
    repo.orders.set("ord-2", order({ id: "ord-2", peyQrId: "qr_2" }));
    await applyPayment({ repo, clock, onPaid }, input({ orderId: "ord-2", amountCents: 999, webhookId: "w4" })); // review
    expect(calls).toEqual([]);
  });

  it("a throwing hook never fails or rolls back the payment", async () => {
    const { repo, clock } = await setup();
    const r = await applyPayment({ repo, clock, onPaid: async () => { throw new Error("resend down"); } }, input());
    expect(r).toEqual({ kind: "paid", orderId: "ord-1" });
    expect(repo.orders.get("ord-1")!.status).toBe("paid");
    expect(await repo.findPassByOrderId("ord-1")).not.toBeNull();
  });

  it("is not invoked when the transaction rolls back", async () => {
    const { repo, clock, calls, onPaid } = await setup();
    const orig = repo.withEventLock.bind(repo);
    repo.withEventLock = (async (id: string, fn: (tx: Tx) => Promise<unknown>) =>
      orig(id, async (tx) => {
        await fn(tx);
        throw new Error("commit failed");
      })) as typeof repo.withEventLock;
    await expect(applyPayment({ repo, clock, onPaid }, input())).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
