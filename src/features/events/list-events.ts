import { listOrders, type Counters } from "@/features/organizer/list-orders";
import type { Clock, OrdersRepo } from "@/shared/ports";

export type EventStatus = "a_la_venta" | "agotado" | "finalizado";

export function deriveEventStatus(startsAt: Date | null | undefined, available: number, now: Date): EventStatus {
  if (startsAt && startsAt.getTime() <= now.getTime()) return "finalizado";
  if (available <= 0) return "agotado";
  return "a_la_venta";
}

export type EventSummary = {
  id: string;
  slug: string;
  name: string;
  startsAt: string | null;
  priceCents: number;
  capacity: number;
  counters: Counters;
  status: EventStatus;
};

export async function listMyEvents(repo: OrdersRepo, clock: Clock): Promise<EventSummary[]> {
  const events = await repo.listEvents();
  const now = clock.now();
  const views = await Promise.all(events.map((e) => listOrders(repo, clock, e.id)));
  const out: EventSummary[] = [];
  events.forEach((e, i) => {
    const v = views[i];
    if (!v) return;
    out.push({
      id: e.id,
      slug: e.slug,
      name: e.name,
      startsAt: e.startsAt ? e.startsAt.toISOString() : null,
      priceCents: e.priceCents,
      capacity: e.capacity,
      counters: v.counters,
      status: deriveEventStatus(e.startsAt, v.counters.available, now),
    });
  });
  return out;
}
