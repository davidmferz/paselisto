import type { AdminOrderRow, Clock, EventRow, InsertEventResult, Order, OrdersRepo, Pass, PeyClient, RedeemResult, Tx } from "@/shared/ports";

export class FakeClock implements Clock {
  constructor(private t: Date = new Date("2026-01-01T00:00:00Z")) {}
  now() {
    return new Date(this.t);
  }
  advance(ms: number) {
    this.t = new Date(this.t.getTime() + ms);
  }
}

export class FakePey implements PeyClient {
  qrs = new Map<string, { status: "PENDING" | "PAID"; orderId: string }>();
  createQrCalls: Parameters<PeyClient["createQr"]>[0][] = [];
  failNext = 0;
  private seq = 0;
  async createQr(i: Parameters<PeyClient["createQr"]>[0]) {
    this.createQrCalls.push(i);
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("pey 503");
    }
    const id = `qr_${++this.seq}`;
    this.qrs.set(id, { status: "PENDING", orderId: i.orderId });
    return { id, qrString: `000201-${id}` };
  }
  async getQrStatus(id: string) {
    return this.qrs.get(id)?.status ?? "PENDING";
  }
}

export class FakeRepo implements OrdersRepo {
  events = new Map<string, EventRow>();
  orders = new Map<string, Order>();
  passes = new Map<string, Pass>();
  webhooks = new Map<string, { type: string; payload: unknown }>();

  seedEvent(e: EventRow) {
    this.events.set(e.id, e);
  }

  /** Snapshot-and-rollback transaction semantics (serialized by construction). */
  private lockTail: Promise<unknown> = Promise.resolve();

  async withEventLock<T>(eventId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    // Serialize like SELECT ... FOR UPDATE: concurrent callers queue behind each other.
    const run = this.lockTail.then(() => this.runLocked(eventId, fn));
    this.lockTail = run.catch(() => undefined);
    return run;
  }

  async findEventBySlug(slug: string): Promise<EventRow | null> {
    return [...this.events.values()].find((e) => e.slug === slug) ?? null;
  }

  async countOccupied(eventId: string, now: Date): Promise<number> {
    return this.tx().countOccupied(eventId, now);
  }

  async findEventById(id: string): Promise<EventRow | null> {
    return this.events.get(id) ?? null;
  }

  async listEvents(): Promise<EventRow[]> {
    const t = (e: EventRow) => (e.startsAt ? e.startsAt.getTime() : Number.POSITIVE_INFINITY);
    return [...this.events.values()].sort((a, b) => t(a) - t(b));
  }

  async insertEvent(e: EventRow): Promise<InsertEventResult> {
    // Synchronous check+write == atomic, like a DB unique constraint.
    const all = [...this.events.values()];
    if (e.createdByRequest && all.some((x) => x.createdByRequest === e.createdByRequest)) return "key_taken";
    if (all.some((x) => x.slug === e.slug) || this.events.has(e.id)) return "slug_taken";
    this.events.set(e.id, { ...e });
    return "ok";
  }

  async findEventByRequestKey(key: string): Promise<EventRow | null> {
    const e = [...this.events.values()].find((x) => x.createdByRequest === key);
    return e ? { ...e } : null;
  }

  async findPassByOrderId(orderId: string): Promise<Pass | null> {
    const p = [...this.passes.values()].find((x) => x.orderId === orderId);
    return p ? { ...p } : null;
  }

  private async runLocked<T>(_eventId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const snap = {
      orders: new Map([...this.orders].map(([k, v]) => [k, { ...v }])),
      passes: new Map([...this.passes].map(([k, v]) => [k, { ...v }])),
      webhooks: new Map(this.webhooks),
    };
    try {
      return await fn(this.tx());
    } catch (err) {
      this.orders = snap.orders;
      this.passes = snap.passes;
      this.webhooks = snap.webhooks;
      throw err;
    }
  }

  private tx(): Tx {
    return {
      getEvent: async (id) => this.events.get(id) ?? null,
      countOccupied: async (eventId, now) =>
        [...this.orders.values()].filter(
          (o) => o.eventId === eventId && (o.status === "paid" || (o.status === "pending" && o.expiresAt > now)),
        ).length,
      countPaid: async (eventId) =>
        [...this.orders.values()].filter((o) => o.eventId === eventId && o.status === "paid").length,
      insertOrder: async (o) => void this.orders.set(o.id, { ...o }),
      updateOrder: async (id, patch) => {
        const cur = this.orders.get(id);
        if (!cur) throw new Error(`order ${id} not found`);
        this.orders.set(id, { ...cur, ...patch });
      },
      getOrder: async (id) => this.orders.get(id) ?? null,
      getOrderByPeyQrId: async (qr) => [...this.orders.values()].find((o) => o.peyQrId === qr) ?? null,
      insertPass: async (p) => void this.passes.set(p.id, { ...p }),
      recordWebhook: async (id, type, payload) => {
        if (this.webhooks.has(id)) return false;
        this.webhooks.set(id, { type, payload });
        return true;
      },
    };
  }

  async findOrder(ref: { orderId?: string; peyQrId?: string }): Promise<Order | null> {
    const byId = ref.orderId ? this.orders.get(ref.orderId) : undefined;
    if (byId) return { ...byId };
    const byQr = ref.peyQrId ? [...this.orders.values()].find((o) => o.peyQrId === ref.peyQrId) : undefined;
    return byQr ? { ...byQr } : null;
  }

  async listOrders(eventId: string): Promise<AdminOrderRow[]> {
    return [...this.orders.values()].filter((o) => o.eventId === eventId).map((order) => ({
      order: { ...order },
      usedAt: [...this.passes.values()].find((p) => p.orderId === order.id)?.usedAt ?? null,
    }));
  }

  async redeem(token: string, eventId: string, now: Date): Promise<RedeemResult> {
    const pass = [...this.passes.values()].find((p) => p.token === token);
    if (!pass) return { kind: "NOT_FOUND" };
    const order = this.orders.get(pass.orderId);
    if (!order) return { kind: "NOT_FOUND" };
    if (order.eventId !== eventId) {
      const ev = this.events.get(order.eventId);
      return { kind: "WRONG_EVENT", eventName: ev?.name ?? "otro taller", startsAt: ev?.startsAt ?? null };
    }
    if (order.status !== "paid") return { kind: "NOT_PAID" };
    if (pass.usedAt) return { kind: "ALREADY_USED", usedAt: pass.usedAt };
    pass.usedAt = now;
    return { kind: "OK", buyer: order.buyerName };
  }
}
