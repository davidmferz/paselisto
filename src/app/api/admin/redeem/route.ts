import { redeemToken } from "@/features/checkin/redeem";
import { requireAdminApi } from "@/features/organizer/server-auth";
import { getClock, getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const denied = await requireAdminApi();
  if (denied) return denied;
  let token = "";
  let eventId = "";
  try {
    const body = (await req.json()) as { token?: unknown; eventId?: unknown };
    if (typeof body.token === "string") token = body.token;
    if (typeof body.eventId === "string") eventId = body.eventId.trim();
  } catch {
    /* malformed body -> rejected below */
  }
  // The scanned event is mandatory: without it a pass could be consumed at the wrong workshop.
  if (!eventId) return Response.json({ error: "eventId required" }, { status: 400 });
  try {
    const r = await redeemToken(getRepo(), getClock(), token, eventId);
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin redeem failure", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
