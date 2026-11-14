import { createOrder } from "@/features/checkout/use-cases";
import { getCheckoutDeps } from "@/shared/container";
import { getConfig } from "@/shared/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: { slug?: unknown; name?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const slug = typeof body.slug === "string" && body.slug ? body.slug : getConfig().event.slug;
    const r = await createOrder(getCheckoutDeps(), { slug, name: body.name, email: body.email });
    switch (r.kind) {
      case "ok":
        return Response.json(
          { orderId: r.orderId, qrString: r.qrString, expiresAt: r.expiresAt.toISOString() },
          { status: 201 },
        );
      case "invalid":
        return Response.json({ error: "Revisá tu nombre y email", code: "invalid" }, { status: 400 });
      case "event_not_found":
        return Response.json({ error: "Evento no encontrado", code: "event_not_found" }, { status: 404 });
      case "sold_out":
        return Response.json({ error: "Agotado", code: "sold_out" }, { status: 409 });
      case "pey_error":
        return Response.json(
          { error: "Reintentá en unos segundos", code: "pey_error" },
          { status: 503 },
        );
    }
  } catch (err) {
    console.error("POST /api/orders failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Reintentá en unos segundos", code: "internal" }, { status: 500 });
  }
}
