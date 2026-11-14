import { getOrderStatus, type OrderStatusResult } from "@/features/checkout/use-cases";
import { getCheckoutDeps } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Found = Extract<OrderStatusResult, { kind: "found" }>;

function body(r: Found) {
  return {
    status: r.status,
    buyerName: r.buyerName,
    expiresAt: r.expiresAt.toISOString(),
    passToken: r.passToken ?? null,
    orderRef: r.orderRef,
    qrString: r.qrString ?? null,
  };
}

async function handle(ctx: { params: Promise<{ id: string }> }, forceCheck: boolean): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const r = await getOrderStatus(getCheckoutDeps(), id, { forceCheck });
    if (r.kind === "not_found") return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(body(r), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("orders/[id] failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(ctx, false);
}

/** Buyer-initiated "Ya realicé el pago": one forced status check against pey (idempotent). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(ctx, true);
}
