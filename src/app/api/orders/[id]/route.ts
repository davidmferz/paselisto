import { getOrderStatus } from "@/features/checkout/use-cases";
import { getCheckoutDeps } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const r = await getOrderStatus(getCheckoutDeps(), id);
    if (r.kind === "not_found") return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(
      {
        status: r.status,
        buyerName: r.buyerName,
        expiresAt: r.expiresAt.toISOString(),
        passToken: r.passToken ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("GET /api/orders/[id] failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
