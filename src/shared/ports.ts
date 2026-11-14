export type OrderStatus = "pending" | "paid" | "review" | "expired";

export type Order = {
  id: string;
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  amountCents: number;
  status: OrderStatus;
  channel: "qr" | "pn";
  peyQrId: string | null;
  peyTransactionId: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  reviewReason: string | null;
  createdAt: Date;
};

export type Pass = { id: string; orderId: string; token: string; usedAt: Date | null };

export type EventRow = { id: string; slug: string; name: string; priceCents: number; capacity: number };

export interface PeyClient {
  createQr(i: {
    amountCents: number;
    concept: string;
    expirationSec: number;
    orderId: string;
  }): Promise<{ id: string; qrString: string }>;
  getQrStatus(id: string): Promise<"PENDING" | "PAID">;
  createPush?(i: { amountCents: number; phone: string; orderId: string }): Promise<{ transactionId: string }>;
}

export interface Clock {
  now(): Date;
}

export type RedeemResult =
  | { kind: "OK"; buyer: string }
  | { kind: "ALREADY_USED"; usedAt: Date }
  | { kind: "NOT_FOUND" }
  | { kind: "NOT_PAID" };

/** Operations available inside a per-event locked transaction. */
export interface Tx {
  getEvent(eventId: string): Promise<EventRow | null>;
  /** paid + pending(expires_at > now) orders occupying capacity */
  countOccupied(eventId: string, now: Date): Promise<number>;
  countPaid(eventId: string): Promise<number>;
  insertOrder(o: Order): Promise<void>;
  updateOrder(id: string, patch: Partial<Order>): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByPeyQrId(peyQrId: string): Promise<Order | null>;
  insertPass(p: Pass): Promise<void>;
  /** true if newly recorded, false if duplicate webhookId */
  recordWebhook(webhookId: string, type: string, payload: unknown): Promise<boolean>;
}

/** Admin panel row: an order plus the redemption time of its pass (if any). Never carries the token. */
export type AdminOrderRow = { order: Order; usedAt: Date | null };

export interface OrdersRepo {
  withEventLock<T>(eventId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  redeem(token: string, now: Date): Promise<RedeemResult>;
  /** Unlocked read used to discover which event lock to take (by order id, else pey_qr_id). */
  findOrder(ref: { orderId?: string; peyQrId?: string }): Promise<Order | null>;
  /** All orders (admin panel), with pass used_at. */
  listOrders(): Promise<AdminOrderRow[]>;
  /** Buyer flow (unlocked reads). */
  findEventBySlug(slug: string): Promise<EventRow | null>;
  countOccupied(eventId: string, now: Date): Promise<number>;
  findPassByOrderId(orderId: string): Promise<Pass | null>;
}
