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
  /** How the payment was confirmed; set only when the order leaves pending. */
  confirmedVia: "webhook" | "poll" | null;
  createdAt: Date;
  /** CoDi QR payload, persisted so the pay screen works without ?qr=. Optional for older fixtures. */
  peyQrString?: string | null;
};

export type Pass = { id: string; orderId: string; token: string; usedAt: Date | null };

export type EventRow = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  capacity: number;
  /** Optional on purpose: older fixtures / pre-migration rows lack them (mapper yields null). */
  description?: string | null;
  startsAt?: Date | null;
  venue?: string | null;
  contactEmail?: string | null;
  createdAt?: Date | null;
  organizerName?: string | null;
  /** Idempotency key of the publish request that created this event. */
  createdByRequest?: string | null;
};

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
  | { kind: "NOT_PAID" }
  /** The pass is valid but belongs to another event: NOT consumed. */
  | { kind: "WRONG_EVENT"; eventName: string; startsAt: Date | null };

export type InsertEventResult = "ok" | "slug_taken" | "key_taken";

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
  /** Atomic: only consumes a paid, unused pass that belongs to `eventId`. */
  redeem(token: string, eventId: string, now: Date): Promise<RedeemResult>;
  /** Unlocked read used to discover which event lock to take (by order id, else pey_qr_id). */
  findOrder(ref: { orderId?: string; peyQrId?: string }): Promise<Order | null>;
  /** Orders of ONE event (admin panel), filtered before the LIMIT, with pass used_at. */
  listOrders(eventId: string): Promise<AdminOrderRow[]>;
  findEventById(id: string): Promise<EventRow | null>;
  /** Ordered by starts_at ascending, nulls last. */
  listEvents(): Promise<EventRow[]>;
  /** Buyer flow (unlocked reads). */
  findEventBySlug(slug: string): Promise<EventRow | null>;
  countOccupied(eventId: string, now: Date): Promise<number>;
  findPassByOrderId(orderId: string): Promise<Pass | null>;
  /** Unique-safe insert: reports which unique constraint (slug / idempotency key) was violated. */
  insertEvent(e: EventRow): Promise<InsertEventResult>;
  findEventByRequestKey(key: string): Promise<EventRow | null>;
  /** The pass token is the capability: lookup used by the QR image endpoint. */
  findPassByToken(token: string): Promise<Pass | null>;
  /**
   * Atomic claim for the confirmation email: `UPDATE orders SET email_sent_at = now()
   * WHERE id = $1 AND email_sent_at IS NULL`. true only for the single winner.
   */
  claimPassEmail(orderId: string): Promise<boolean>;
  /** Clears the claim after a failed/skipped send so a later retry can resend. */
  releasePassEmail(orderId: string): Promise<void>;
}

export type PassEmailMessage = {
  orderId: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

/** Transactional mail. `{ skipped }` means the provider is not configured (silent no-op). */
export interface Mailer {
  sendPassEmail(msg: PassEmailMessage): Promise<{ id: string } | { skipped: true }>;
}
