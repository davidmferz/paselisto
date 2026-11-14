import { randomUUID } from "node:crypto";
import { SLUG_MAX, validateNewEvent, type EventField, type NewEventInput } from "./domain";
import type { Clock, EventRow, OrdersRepo } from "@/shared/ports";

export const MAX_SLUG_ATTEMPTS = 5;
const MAX_KEY_LEN = 100;

type Deps = { repo: OrdersRepo; clock: Clock; organizerName?: string | null };

export type CreateEventResult =
  | { kind: "created"; event: EventRow }
  | { kind: "existing"; event: EventRow }
  | { kind: "invalid"; errors: Partial<Record<EventField, string>> }
  | { kind: "invalid_key" }
  | { kind: "slug_unavailable" };

function withSuffix(base: string, n: number): string {
  if (n === 1) return base;
  const suffix = `-${n}`;
  return base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "") + suffix;
}

/**
 * Publishes an event immediately. Idempotent per `idempotencyKey` (DB-unique): replays and
 * concurrent retries return the already-created event. Slug collisions retry with -2, -3... (bounded).
 */
export async function createEvent(deps: Deps, input: NewEventInput, idempotencyKey: string): Promise<CreateEventResult> {
  const key = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  if (!key || key.length > MAX_KEY_LEN) return { kind: "invalid_key" };

  const prior = await deps.repo.findEventByRequestKey(key);
  if (prior) return { kind: "existing", event: prior };

  const now = deps.clock.now();
  const v = validateNewEvent(input, now);
  if (!v.ok) return { kind: "invalid", errors: v.errors };

  const id = randomUUID();
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const event: EventRow = {
      id,
      slug: withSuffix(v.value.slug, attempt),
      name: v.value.name,
      priceCents: v.value.priceCents,
      capacity: v.value.capacity,
      description: v.value.description,
      startsAt: v.value.startsAt,
      venue: v.value.venue,
      contactEmail: v.value.contactEmail,
      createdAt: now,
      organizerName: deps.organizerName ?? null,
      createdByRequest: key,
    };
    const r = await deps.repo.insertEvent(event);
    if (r === "ok") return { kind: "created", event };
    if (r === "key_taken") {
      const winner = await deps.repo.findEventByRequestKey(key);
      if (winner) return { kind: "existing", event: winner };
      // key vanished: treat as transient and retry the same slug
      attempt--;
    }
    // slug_taken -> next suffix
  }
  return { kind: "slug_unavailable" };
}
