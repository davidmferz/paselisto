import { handleCreateEvent } from "@/features/events/handler";
import { createEventsEnabled } from "@/features/events/flag";
import { listMyEvents } from "@/features/events/list-events";
import { requireAdminApi } from "@/features/organizer/server-auth";
import { getConfig } from "@/shared/config";
import { getClock, getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/events: every event with vendidos/reservados/disponibles counters. */
export async function GET(): Promise<Response> {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    const events = await listMyEvents(getRepo(), getClock());
    return Response.json({ events, canCreate: createEventsEnabled() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin events list failure", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}

/** POST /api/admin/events (header Idempotency-Key). 403 unless FEATURE_CREATE_EVENTS=1. */
export async function POST(req: Request): Promise<Response> {
  const denied = await requireAdminApi();
  if (denied) return denied;
  if (!createEventsEnabled()) return Response.json({ error: "No disponible", code: "feature_disabled" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido", code: "bad_request" }, { status: 400 });
  }
  try {
    const cfg = getConfig();
    const r = await handleCreateEvent(
      { repo: getRepo(), clock: getClock(), enabled: true, appUrl: cfg.appUrl, organizerName: cfg.event.organizer ?? null },
      body,
      req.headers.get("idempotency-key"),
    );
    return Response.json(r.json, { status: r.status });
  } catch (err) {
    console.error("admin events create failure", err instanceof Error ? err.message : err);
    return Response.json({ error: "Intenta de nuevo en unos segundos", code: "internal" }, { status: 500 });
  }
}
