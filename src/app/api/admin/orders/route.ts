import { listOrders } from "@/features/organizer/list-orders";
import { resolveEvent } from "@/features/organizer/resolve-event";
import { requireAdminApi } from "@/features/organizer/server-auth";
import { getClock, getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/orders?event=<slug|id> (defaults to the first event). Never lists other events. */
export async function GET(req: Request): Promise<Response> {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    const repo = getRepo();
    const event = await resolveEvent(repo, new URL(req.url).searchParams.get("event"));
    if (!event) return Response.json({ error: "event not found" }, { status: 404 });
    const view = await listOrders(repo, getClock(), event.id);
    if (!view) return Response.json({ error: "event not found" }, { status: 404 });
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin orders failure", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
