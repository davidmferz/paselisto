import { randomUUID } from "node:crypto";
import { effectiveStatus, hasCapacity, validateBuyer } from "./domain";
import { applyPayment } from "@/features/webhook/handle-payment";
import type { Clock, OrderStatus, OrdersRepo, PeyClient } from "@/shared/ports";

export const ORDER_TTL_SEC = 900;
export const FALLBACK_AFTER_MS = 20_000;

type Deps = { repo: OrdersRepo; pey: PeyClient; clock: Clock };

export type CreateOrderResult =
  | { kind: "ok"; orderId: string; qrString: string; expiresAt: Date }
  | { kind: "invalid"; error: string }
  | { kind: "event_not_found" }
  | { kind: "sold_out" }
  | { kind: "pey_error" };

export async function createOrder(
  deps: Deps,
  i: { slug: string; name: unknown; email: unknown },
): Promise<CreateOrderResult> {
  const v = validateBuyer(i);
  if (!v.ok) return { kind: "invalid", error: v.error };

  const event = await deps.repo.findEventBySlug(i.slug);
  if (!event) return { kind: "event_not_found" };

  const now = deps.clock.now();
  const orderId = randomUUID();
  const expiresAt = new Date(now.getTime() + ORDER_TTL_SEC * 1000);

  // 1) Reserve the slot atomically (capacity check + insert under the event lock).
  const reserved = await deps.repo.withEventLock(event.id, async (tx) => {
    const occupied = await tx.countOccupied(event.id, now);
    if (!hasCapacity(occupied, event.capacity)) return false;
    await tx.insertOrder({
      id: orderId,
      eventId: event.id,
      buyerName: v.name,
      buyerEmail: v.email,
      amountCents: event.priceCents,
      status: "pending",
      channel: "qr",
      peyQrId: null,
      peyTransactionId: null,
      expiresAt,
      paidAt: null,
      reviewReason: null,
      createdAt: now,
    });
    return true;
  });
  if (!reserved) return { kind: "sold_out" };

  // 2) Call pey outside the lock (network). On failure release the slot.
  try {
    const qr = await deps.pey.createQr({
      amountCents: event.priceCents,
      concept: event.name.slice(0, 40),
      expirationSec: ORDER_TTL_SEC,
      orderId,
    });
    await deps.repo.withEventLock(event.id, (tx) => tx.updateOrder(orderId, { peyQrId: qr.id }));
    return { kind: "ok", orderId, qrString: qr.qrString, expiresAt };
  } catch (err) {
    console.error("createOrder: pey createQr failed", err instanceof Error ? err.message : err);
    // 'expired' with expiresAt=now frees capacity (countOccupied ignores it).
    await deps.repo.withEventLock(event.id, (tx) => tx.updateOrder(orderId, { status: "expired", expiresAt: now }));
    return { kind: "pey_error" };
  }
}

export type EventView = { slug: string; name: string; priceCents: number; capacity: number; spotsLeft: number };

export async function getEventView(
  deps: Pick<Deps, "repo" | "clock">,
  slug: string,
): Promise<EventView | null> {
  const event = await deps.repo.findEventBySlug(slug);
  if (!event) return null;
  const occupied = await deps.repo.countOccupied(event.id, deps.clock.now());
  return {
    slug: event.slug,
    name: event.name,
    priceCents: event.priceCents,
    capacity: event.capacity,
    spotsLeft: Math.max(0, event.capacity - occupied),
  };
}

export type OrderStatusResult =
  | { kind: "not_found" }
  | {
      kind: "found";
      status: OrderStatus;
      buyerName: string;
      expiresAt: Date;
      passToken?: string;
    };

export async function getOrderStatus(deps: Deps, orderId: string): Promise<OrderStatusResult> {
  let order = await deps.repo.findOrder({ orderId });
  if (!order) return { kind: "not_found" };

  const now = deps.clock.now();
  if (
    effectiveStatus(order, now) === "pending" &&
    order.peyQrId &&
    now.getTime() - order.createdAt.getTime() > FALLBACK_AFTER_MS
  ) {
    try {
      if ((await deps.pey.getQrStatus(order.peyQrId)) === "PAID") {
        // Same idempotent path as the webhook (no webhookId).
        await applyPayment(
          { repo: deps.repo, clock: deps.clock },
          {
            type: "poll.fallback",
            payload: { source: "getQrStatus" },
            orderId: order.id,
            peyQrId: order.peyQrId,
            amountCents: order.amountCents,
          },
        );
        order = (await deps.repo.findOrder({ orderId })) ?? order;
      }
    } catch (err) {
      // 404 / network / DB hiccup: keep polling, the webhook may still arrive.
      console.warn("getOrderStatus: fallback ignored", err instanceof Error ? err.message : err);
    }
  }

  const status = effectiveStatus(order, deps.clock.now());
  const pass = status === "paid" ? await deps.repo.findPassByOrderId(order.id) : null;
  return {
    kind: "found",
    status,
    buyerName: order.buyerName,
    expiresAt: order.expiresAt,
    ...(pass ? { passToken: pass.token } : {}),
  };
}
