import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless";
import ws from "ws";
import type { AdminOrderRow, EventRow, Order, OrdersRepo, Pass, RedeemResult, Tx } from "../ports";

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
    createdAt: r.created_at as Date,
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
  };
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
  createdAt: "created_at",
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

export function mapRedeemRow(
  r: { buyer_name: string; status: string; used_at: Date | null } | null,
  redeemedNow: boolean,
): RedeemResult {
  if (!r) return { kind: "NOT_FOUND" };
  if (redeemedNow) return { kind: "OK", buyer: r.buyer_name };
  if (r.status !== "paid") return { kind: "NOT_PAID" };
  if (r.used_at) return { kind: "ALREADY_USED", usedAt: r.used_at };
  // paid, unused, yet the atomic update matched nothing: treat as not found-safe state
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
         pey_qr_id, pey_transaction_id, expires_at, paid_at, review_reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [o.id, o.eventId, o.buyerName, o.buyerEmail, o.amountCents, o.status, o.channel,
        o.peyQrId, o.peyTransactionId, o.expiresAt, o.paidAt, o.reviewReason, o.createdAt],
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

    async listOrders(): Promise<AdminOrderRow[]> {
      const pool = new Pool({ connectionString });
      try {
        const { rows } = await pool.query(
          `SELECT o.*, p.used_at FROM orders o LEFT JOIN passes p ON p.order_id = o.id
           ORDER BY o.created_at DESC LIMIT 500`,
        );
        return rows.map((r) => ({ order: mapOrderRow(r), usedAt: (r.used_at as Date | null) ?? null }));
      } finally {
        await pool.end();
      }
    },

    async redeem(token: string, now: Date): Promise<RedeemResult> {
      const pool = new Pool({ connectionString });
      try {
        const upd = await pool.query(
          `UPDATE passes p SET used_at = $2 FROM orders o
           WHERE p.order_id = o.id AND p.token = $1 AND p.used_at IS NULL AND o.status = 'paid'
           RETURNING o.buyer_name, o.status, p.used_at`,
          [token, now],
        );
        if (upd.rows[0]) return mapRedeemRow(upd.rows[0], true);
        const sel = await pool.query(
          `SELECT o.buyer_name, o.status, p.used_at FROM passes p JOIN orders o ON o.id = p.order_id
           WHERE p.token = $1`,
          [token],
        );
        return mapRedeemRow(sel.rows[0] ?? null, false);
      } finally {
        await pool.end();
      }
    },
  };
}
