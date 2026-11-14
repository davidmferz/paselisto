import { createEvent } from "./create-event";
import { eventUrl } from "./share";
import type { Clock, EventRow, OrdersRepo } from "@/shared/ports";

type Deps = { repo: OrdersRepo; clock: Clock; enabled: boolean; appUrl: string; organizerName?: string | null };

export type HandlerResponse = { status: number; json: unknown };

function publicEvent(e: EventRow, appUrl: string) {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    description: e.description ?? null,
    startsAt: e.startsAt ? e.startsAt.toISOString() : null,
    venue: e.venue ?? null,
    priceCents: e.priceCents,
    capacity: e.capacity,
    contactEmail: e.contactEmail ?? null,
    url: eventUrl(appUrl, e.slug),
  };
}

/** Transport-agnostic POST /api/admin/events logic (auth is enforced by the route before this). */
export async function handleCreateEvent(deps: Deps, body: unknown, idempotencyKey: string | null): Promise<HandlerResponse> {
  if (!deps.enabled) return { status: 403, json: { error: "No disponible", code: "feature_disabled" } };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, json: { error: "Solicitud inválida", code: "bad_request" } };
  }
  if (!idempotencyKey?.trim()) return { status: 400, json: { error: "Falta Idempotency-Key", code: "idempotency_key_required" } };
  const r = await createEvent(
    { repo: deps.repo, clock: deps.clock, organizerName: deps.organizerName },
    body as Parameters<typeof createEvent>[1],
    idempotencyKey,
  );
  switch (r.kind) {
    case "created":
      return { status: 201, json: { event: publicEvent(r.event, deps.appUrl) } };
    case "existing":
      return { status: 200, json: { event: publicEvent(r.event, deps.appUrl) } };
    case "invalid":
      return { status: 422, json: { error: "Revisa los campos", code: "invalid", errors: r.errors } };
    case "invalid_key":
      return { status: 400, json: { error: "Idempotency-Key inválida", code: "idempotency_key_invalid" } };
    case "slug_unavailable":
      return { status: 409, json: { error: "Ese link ya está en uso. Prueba con otro nombre.", code: "slug_unavailable", errors: { slug: "Ese link ya está en uso." } } };
  }
}
