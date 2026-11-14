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
      expiresAt: new Date(now.getTime() + 60_000), paidAt: now, reviewReason: null, confirmedVia: null, createdAt: now,
    };
    const wid = `wh-${randomUUID()}`;
    const [first, second] = await repo.withEventLock(eventId, async (tx) => {
      await tx.insertOrder(order);
      await tx.insertPass({ id: randomUUID(), orderId, token, usedAt: null });
      return [await tx.recordWebhook(wid, "t", { a: 1 }), await tx.recordWebhook(wid, "t", { a: 1 })];
    });
    expect([first, second]).toEqual([true, false]);

    const results = await Promise.all([repo.redeem(token, eventId, new Date()), repo.redeem(token, eventId, new Date())]);
    expect(results.filter((r) => r.kind === "OK")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "ALREADY_USED")).toHaveLength(1);
    expect((await repo.redeem("nope", eventId, new Date())).kind).toBe("NOT_FOUND");
  });

  it("scanner isolation: a pass scanned at another event is WRONG_EVENT and stays unused", async () => {
    const otherId = `test-${randomUUID()}`;
    const oid = randomUUID();
    const tok = `tok-${randomUUID()}`;
    const pool = new Pool({ connectionString: url });
    try {
      await pool.query(readFileSync("db/schema.sql", "utf8"));
      await pool.query("insert into events(id,slug,name,price_cents,capacity) values($1,$1,'Otro',1,2)", [otherId]);
      const now = new Date();
      await pool.query(
        `insert into orders(id,event_id,buyer_name,buyer_email,amount_cents,status,expires_at,paid_at)
         values($1,$2,'Ana','a@x.mx',1,'paid',$3,$3)`,
        [oid, eventId, now],
      );
      await pool.query("insert into passes(id,order_id,token) values($1,$2,$3)", [randomUUID(), oid, tok]);
      const wrong = await repo.redeem(tok, otherId, new Date());
      expect(wrong).toMatchObject({ kind: "WRONG_EVENT" });
      const { rows } = await pool.query("select used_at from passes where token=$1", [tok]);
      expect(rows[0].used_at).toBeNull();
      expect((await repo.redeem(tok, eventId, new Date())).kind).toBe("OK");
    } finally {
      await pool.query("delete from passes where order_id=$1", [oid]);
      await pool.query("delete from orders where id=$1", [oid]);
      await pool.query("delete from events where id=$1", [otherId]);
      await pool.end();
    }
  });

  it("listOrders filters by event before the limit; listEvents/findEventById work", async () => {
    const rows = await repo.listOrders(eventId);
    expect(rows.every((r) => r.order.eventId === eventId)).toBe(true);
    expect((await repo.findEventById(eventId))?.id).toBe(eventId);
    expect((await repo.listEvents()).some((e) => e.id === eventId)).toBe(true);
  });

  it("claimPassEmail is atomic (one winner), releasable; findPassByToken works", async () => {
    // depends on the order/pass created by the first test in this file
    const wins = await Promise.all([repo.claimPassEmail(orderId), repo.claimPassEmail(orderId)]);
    expect(wins.filter(Boolean)).toHaveLength(1);
    await repo.releasePassEmail(orderId);
    expect(await repo.claimPassEmail(orderId)).toBe(true);
    expect((await repo.findPassByToken(token))?.orderId).toBe(orderId);
    expect(await repo.findPassByToken("nope")).toBeNull();
  });
});
