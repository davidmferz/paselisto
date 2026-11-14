import type { Clock, OrdersRepo } from "@/shared/ports";

export type AdminStatus = "pending" | "paid" | "used" | "review" | "expired";

export type AdminOrder = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  amountCents: number;
  status: AdminStatus;
  reviewReason: string | null;
  confirmedVia: "webhook" | "poll" | null;
  createdAt: string;
  usedAt: string | null;
};

export type Counters = { sold: number; reserved: number; available: number; entered: number; capacity: number };

export type AdminOrdersView = {
  event: { id: string; slug: string; name: string; capacity: number; startsAt: string | null; venue: string | null };
  orders: AdminOrder[];
  counts: Record<AdminStatus, number>;
  counters: Counters;
};

/**
 * Coherent capacity counters: vendidos = paid + used, reservados = pending (unexpired),
 * disponibles = capacity - vendidos - reservados, ingresaron = used.
 */
export function computeCounters(counts: Record<AdminStatus, number>, capacity: number): Counters {
  const sold = counts.paid + counts.used;
  const reserved = counts.pending;
  return { sold, reserved, available: Math.max(0, capacity - sold - reserved), entered: counts.used, capacity };
}

/** Orders of one event; null when the event does not exist. */
export async function listOrders(repo: OrdersRepo, clock: Clock, eventId: string): Promise<AdminOrdersView | null> {
  const event = await repo.findEventById(eventId);
  if (!event) return null;
  const now = clock.now();
  const rows = await repo.listOrders(eventId);
  const counts: Record<AdminStatus, number> = { pending: 0, paid: 0, used: 0, review: 0, expired: 0 };
  const sorted = [...rows].sort((a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime());
  const orders = sorted.map(({ order, usedAt }): AdminOrder => {
    let status: AdminStatus;
    if (order.status === "paid") status = usedAt ? "used" : "paid";
    else if (order.status === "pending" && order.expiresAt <= now) status = "expired";
    else status = order.status;
    counts[status]++;
    return {
      id: order.id,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      amountCents: order.amountCents,
      status,
      reviewReason: order.reviewReason,
      confirmedVia: order.confirmedVia,
      createdAt: order.createdAt.toISOString(),
      usedAt: usedAt ? usedAt.toISOString() : null,
    };
  });
  return {
    event: { id: event.id, slug: event.slug, name: event.name, capacity: event.capacity, startsAt: event.startsAt?.toISOString() ?? null, venue: event.venue ?? null },
    orders,
    counts,
    counters: computeCounters(counts, event.capacity),
  };
}
