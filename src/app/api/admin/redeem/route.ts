import { redeemToken } from "@/features/checkin/redeem";
import { requireAdminApi } from "@/features/organizer/server-auth";
import { getClock, getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const denied = await requireAdminApi();
  if (denied) return denied;
  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token;
  } catch {
    /* malformed body -> NOT_FOUND below */
  }
  try {
    const r = await redeemToken(getRepo(), getClock(), token);
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin redeem failure", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
