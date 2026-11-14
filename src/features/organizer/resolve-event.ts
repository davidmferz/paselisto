import type { EventRow, OrdersRepo } from "@/shared/ports";

/** Resolves `?event=<slug|id>`; missing/blank -> first event; unknown ref -> null. */
export async function resolveEvent(repo: OrdersRepo, ref: string | undefined | null): Promise<EventRow | null> {
  const r = ref?.trim();
  if (!r) return (await repo.listEvents())[0] ?? null;
  return (await repo.findEventBySlug(r)) ?? (await repo.findEventById(r));
}
