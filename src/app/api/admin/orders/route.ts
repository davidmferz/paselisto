import { listOrders } from "@/features/organizer/list-orders";
import { requireAdminApi } from "@/features/organizer/server-auth";
import { getClock, getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    return Response.json(await listOrders(getRepo(), getClock()), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin orders failure", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
