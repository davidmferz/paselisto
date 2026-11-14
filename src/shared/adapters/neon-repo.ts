import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless";
import ws from "ws";
import type { AdminOrderRow, EventRow, InsertEventResult, Order, OrdersRepo, Pass, RedeemResult, Tx } from "../ports";

/** In Node (scripts, Vercel nodejs runtime) the Neon Pool needs a WebSocket constructor. */
export function configureNeonWebSocket(): void {
  neonConfig.webSocketConstructor = ws;
}

type Row = Record<string, unknown>;

export function mapOrderRow(r: Row): Order {
  return {
    id: r.id as string,
    eventId: r.event_id as string,
    buyerName: r.buyer_name as string,
    buyerEmail: r.buyer_email as string,
    amountCents: Number(r.amount_cents),
    status: r.status as Order["status"],
    channel: r.channel as Order["channel"],
    peyQrId: (r.pey_qr_id as string | null) ?? null,
    peyTransactionId: (r.pey_transaction_id as string | null) ?? null,
    expiresAt: r.expires_at as Date,
    paidAt: (r.paid_at as Date | null) ?? null,
    reviewReason: (r.review_reason as string | null) ?? null,
    confirmedVia: (r.confirmed_via as Order["confirmedVia"]) ?? null,
    createdAt: r.created_at as Date,
    peyQrString: (r.pey_qr_string as string | null) ?? null,
  };
}

export function mapPassRow(r: Row): Pass {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    token: r.token as string,
    usedAt: (r.used_at as Date | null) ?? null,
  };
}

export function mapEventRow(r: Row): EventRow {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    priceCents: Number(r.price_cents),
    capacity: Number(r.capacity),
    description: (r.description as string | null) ?? null,
    startsAt: (r.starts_at as Date | null) ?? null,
    venue: (r.venue as string | null) ?? null,
    contactEmail: (r.contact_email as string | null) ?? null,
    createdAt: (r.created_at as Date | null) ?? null,
    organizerName: (r.organizer_name as string | null) ?? null,
    createdByRequest: (r.created_by_request as string | null) ?? null,
  };
}

/** Maps a Postgres unique violation on events to a domain result; anything else is rethrown. */
export function classifyEventInsertError(err: unknown): "slug_taken" | "key_taken" {
  const e = err as { code?: string; constraint?: string } | null;
  if (e?.code === "23505") {
    if (e.constraint === "events_created_by_request_key") return "key_taken";
    if (e.constraint === "events_slug_key" || e.constraint === "events_pkey") return "slug_taken";
  }
  throw err;
}

const ORDER_COLUMNS: Record<keyof Order, string> = {
  id: "id",
  eventId: "event_id",
  buyerName: "buyer_name",
  buyerEmail: "buyer_email",
  amountCents: "amount_cents",
  status: "status",
  channel: "channel",
  peyQrId: "pey_qr_id",
  peyTransactionId: "pey_transaction_id",
  expiresAt: "expires_at",
  paidAt: "paid_at",
  reviewReason: "review_reason",
  confirmedVia: "confirmed_via",
  createdAt: "created_at",
  peyQrString: "pey_qr_string",
};

export function orderPatchToSet(patch: Partial<Order>): { sql: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(ORDER_COLUMNS) as (keyof Order)[]) {
    if (!(key in patch) || patch[key] === undefined) continue;
    values.push(patch[key]);
    parts.push(`${ORDER_COLUMNS[key]} = $${values.length}`);
  }
  return { sql: parts.join(", "), values };
}

export type RedeemRow = {
  buyer_name: string;
  status: string;
  used_at: Date | null;
  event_id: string;
  event_name: string | null;
  starts_at: Date | null;
};

/** Pure mapping of the redeem lookup row; mirrors checkin/domain.ts mapRedeem. */
export function mapRedeemRow(r: RedeemRow | null, redeemedNow: boolean, expectedEventId: string): RedeemResult {
  if (!r) return { kind: "NOT_FOUND" };
  if (r.event_id !== expectedEventId) {
    return { kind: "WRONG_EVENT", eventName: r.event_name ?? "otro taller", startsAt: r.starts_at ?? null };
  }
  if (redeemedNow) return { kind: "OK", buyer: r.buyer_name };
  if (r.status !== "paid") return { kind: "NOT_PAID" };
  if (r.used_at) return { kind: "ALREADY_USED", usedAt: r.used_at };
  // paid, unused, same event, yet the atomic update matched nothing: lost a race we cannot classify
  return { kind: "NOT_FOUND" };
}

class NeonTx implements Tx {
  constructor(private readonly c: PoolClient) {}

  async getEvent(eventId: string): Promise<EventRow | null> {
    const { rows } = await this.c.query("SELECT * FROM events WHERE id = $1", [eventId]);
    return rows[0] ? mapEventRow(rows[0]) : null;
  }

  async countOccupied(eventId: string, now: Date): Promise<number> {
    const { rows } = await this.c.query(
      `SELECT count(*)::int AS n FROM orders
       WHERE event_id = $1 AND (status = 'paid' OR (status = 'pending' AND expires_at > $2))`,
      [eventId, now],
    );
    return rows[0].n as number;
  }

  async countPaid(eventId: string): Promise<number> {
    const { rows } = await this.c.query(
      "SELECT count(*)::int AS n FROM orders WHERE event_id = $1 AND status = 'paid'",
      [eventId],
    );
    return rows[0].n as number;
  }

  async insertOrder(o: Order): Promise<void> {
    await this.c.query(
      `INSERT INTO orders(id, event_id, buyer_name, buyer_email, amount_cents, status, channel,
         pey_qr_id, pey_transaction_id, expires_at, paid_at, review_reason, confirmed_via, created_at, pey_qr_string)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [o.id, o.eventId, o.buyerName, o.buyerEmail, o.amountCents, o.status, o.channel,
        o.peyQrId, o.peyTransactionId, o.expiresAt, o.paidAt, o.reviewReason, o.confirmedVia, o.createdAt, o.peyQrString ?? null],
    );
  }

  async updateOrder(id: string, patch: Partial<Order>): Promise<void> {
    const { sql, values } = orderPatchToSet(patch);
    if (!sql) return;
    await this.c.query(`UPDATE orders SET ${sql} WHERE id = $${values.length + 1}`, [...values, id]);
  }

  async getOrder(id: string): Promise<Order | null> {
    const { rows } = await this.c.query("SELECT * FROM orders WHERE id = $1", [id]);
    return rows[0] ? mapOrderRow(rows[0]) : null;
  }

  async getOrderByPeyQrId(peyQrId: string): Promise<Order | null> {
    const { rows } = await this.c.query("SELECT * FROM orders WHERE pey_qr_id = $1", [peyQrId]);
    return rows[0] ? mapOrderRow(rows[0]) : null;
  }

  async insertPass(p: Pass): Promise<void> {
    await this.c.query(
      "INSERT INTO passes(id, order_id, token, used_at) VALUES ($1,$2,$3,$4)",
      [p.id, p.orderId, p.token, p.usedAt],
    );
  }

  async recordWebhook(webhookId: string, type: string, payload: unknown): Promise<boolean> {
    const r = await this.c.query(
      `INSERT INTO webhook_events(webhook_id, type, payload) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (webhook_id) DO NOTHING`,
      [webhookId, type, JSON.stringify(payload ?? null)],
    );
    return (r.rowCount ?? 0) > 0;
  }
}

/**
 * Pool is created per operation and closed afterwards: Neon's WebSocket Pool must not
 * outlive a single request handler in serverless runtimes.
 */
export function createNeonRepo(connectionString: string): OrdersRepo {
  configureNeonWebSocket();
  return {
    async withEventLock<T>(eventId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
      const pool = new Pool({ connectionString });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM events WHERE id = $1 FOR UPDATE", [eventId]);
        const result = await fn(new NeonTx(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* connection already broken; original error matters */
        }
        throw err;
      } finally {
        client.release();
        await pool.end();
      }
    },

    async findOrder(ref: { orderId?: string; peyQrId?: string }): Promise<Order | null> {
      const pool = new Pool({ connectionString });
      try {
        if (ref.orderId) {
          // a non-uuid orderId (e.g. attacker-controlled metadata) must not throw
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref.orderId);
          if (isUuid) {
            const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [ref.orderId]);
            if (rows[0]) return mapOrderRow(rows[0]);
          }
        }
        if (ref.peyQrId) {
          const { rows } = await pool.query("SELECT * FROM orders WHERE pey_qr_id = $1", [ref.peyQrId]);
          if (rows[0]) return mapOrderRow(rows[0]);
        }
        return null;
      } finally {
        await pool.end();
      }
    },

    async findEventBySlug(slug: string): Promise<EventRow | null> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query("SELECT * FROM events WHERE slug = $1", [slug]);
        return rows[0] ? mapEventRow(rows[0]) : null;
      } finally {
        await pool.end();
      }
    },

    async countOccupied(eventId: string, now: Date): Promise<number> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query(
          `SELECT count(*)::int AS n FROM orders
           WHERE event_id = $1 AND (status = 'paid' OR (status = 'pending' AND expires_at > $2))`,
          [eventId, now],
        );
        return rows[0].n as number;
      } finally {
        await pool.end();
      }
    },

    async findPassByOrderId(orderId: string): Promise<Pass | null> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query("SELECT * FROM passes WHERE order_id = $1", [orderId]);
        return rows[0] ? mapPassRow(rows[0]) : null;
      } finally {
        await pool.end();
      }
    },

    async findEventById(id: string): Promise<EventRow | null> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query("SELECT * FROM events WHERE id = $1", [id]);
        return rows[0] ? mapEventRow(rows[0]) : null;
      } finally {
        await pool.end();
      }
    },

    async insertEvent(e: EventRow): Promise<InsertEventResult> {
      const pool = new Pool({ connectionString });
      try {
        await pool.query(
          `INSERT INTO events(id, slug, name, price_cents, capacity, description, starts_at, venue, contact_email,
             created_at, organizer_name, created_by_request)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [e.id, e.slug, e.name, e.priceCents, e.capacity, e.description ?? null, e.startsAt ?? null, e.venue ?? null,
            e.contactEmail ?? null, e.createdAt ?? new Date(), e.organizerName ?? null, e.createdByRequest ?? null],
        );
        return "ok";
      } catch (err) {
        return classifyEventInsertError(err);
      } finally {
        await pool.end();
      }
    },

    async findEventByRequestKey(key: string): Promise<EventRow | null> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query("SELECT * FROM events WHERE created_by_request = $1", [key]);
        return rows[0] ? mapEventRow(rows[0]) : null;
      } finally {
        await pool.end();
      }
    },

    async listEvents(): Promise<EventRow[]> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query(
          "SELECT * FROM events ORDER BY starts_at ASC NULLS LAST, created_at ASC NULLS LAST, slug ASC",
        );
        return rows.map(mapEventRow);
      } finally {
        await pool.end();
      }
    },

    async listOrders(eventId: string): Promise<AdminOrderRow[]> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query(
          `SELECT o.*, p.used_at FROM orders o LEFT JOIN passes p ON p.order_id = o.id
           WHERE o.event_id = $1
           ORDER BY o.created_at DESC LIMIT 500`,
          [eventId],
        );
        return rows.map((r) => ({ order: mapOrderRow(r), usedAt: (r.used_at as Date | null) ?? null }));
      } finally {
        await pool.end();
      }
    },

    async redeem(token: string, eventId: string, now: Date): Promise<RedeemResult> {
      const pool = new Pool({ connectionString });
      try {
        // Atomic: the event check lives in the UPDATE itself, so a pass of another event is never consumed.
        const upd = await pool.query(
          `UPDATE passes p SET used_at = $3 FROM orders o
           WHERE p.order_id = o.id AND p.token = $1 AND p.used_at IS NULL
             AND o.status = 'paid' AND o.event_id = $2
           RETURNING o.buyer_name, o.status, p.used_at, o.event_id, NULL::text AS event_name, NULL::timestamptz AS starts_at`,
          [token, eventId, now],
        );
        if (upd.rows[0]) return mapRedeemRow(upd.rows[0], true, eventId);
        const sel = await pool.query(
          `SELECT o.buyer_name, o.status, p.used_at, o.event_id, e.name AS event_name, e.starts_at
           FROM passes p JOIN orders o ON o.id = p.order_id JOIN events e ON e.id = o.event_id
           WHERE p.token = $1`,
          [token],
        );
        return mapRedeemRow(sel.rows[0] ?? null, false, eventId);
      } finally {
        await pool.end();
      }
    },
  };
}
