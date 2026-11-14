import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { createNeonRepo, configureNeonWebSocket } from "./neon-repo";
import type { Order } from "../ports";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!url)("neon-repo integration (real DB)", () => {
  configureNeonWebSocket();
  const repo = createNeonRepo(url as string);
  const eventId = `test-${randomUUID()}`;
  const orderId = randomUUID();
  const token = `tok-${randomUUID()}`;

  afterAll(async () => {
    const pool = new Pool({ connectionString: url });
    await pool.query("delete from passes where order_id=$1", [orderId]);
    await pool.query("delete from orders where event_id=$1", [eventId]);
    await pool.query("delete from events where id=$1", [eventId]);
    await pool.end();
  });

  it("applies schema, dedupes webhooks and redeems atomically once", async () => {
    const pool = new Pool({ connectionString: url });
    await pool.query(readFileSync("db/schema.sql", "utf8"));
    await pool.query("insert into events(id,slug,name,price_cents,capacity) values($1,$1,'T',1,2)", [eventId]);
    await pool.end();

    const now = new Date();
    const order: Order = {
      id: orderId, eventId, buyerName: "Ana", buyerEmail: "a@x.mx", amountCents: 1, status: "paid",
      channel: "qr", peyQrId: `qr-${orderId}`, peyTransactionId: null,
      expiresAt: new Date(now.getTime() + 60_000), paidAt: now, reviewReason: null, createdAt: now,
    };
    const wid = `wh-${randomUUID()}`;
    const [first, second] = await repo.withEventLock(eventId, async (tx) => {
      await tx.insertOrder(order);
      await tx.insertPass({ id: randomUUID(), orderId, token, usedAt: null });
      return [await tx.recordWebhook(wid, "t", { a: 1 }), await tx.recordWebhook(wid, "t", { a: 1 })];
    });
    expect([first, second]).toEqual([true, false]);

    const results = await Promise.all([repo.redeem(token, new Date()), repo.redeem(token, new Date())]);
    expect(results.filter((r) => r.kind === "OK")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "ALREADY_USED")).toHaveLength(1);
    expect((await repo.redeem("nope", new Date())).kind).toBe("NOT_FOUND");
  });
});
