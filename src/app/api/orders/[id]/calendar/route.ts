import { buildIcs } from "@/features/calendar/ics";
import { getCalendarInfo } from "@/features/checkout/use-cases";
import { getRepo } from "@/shared/container";
import { getConfig } from "@/shared/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** .ics for the buyer's own paid order. 404 for anything else (no state leak). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const info = await getCalendarInfo(getRepo(), id);
    if (!info || !info.event.startsAt) return Response.json({ error: "not found" }, { status: 404 });
    const passUrl = `${getConfig().appUrl.replace(/\/+$/, "")}/order/${info.orderId}`;
    const ics = buildIcs(
      { slug: info.event.slug, name: info.event.name, venue: info.event.venue, startsAt: info.event.startsAt },
      { id: info.orderId, passToken: info.passToken, passUrl },
    );
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="paselisto-${info.event.slug.replace(/[^A-Za-z0-9_-]/g, "")}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("orders/[id]/calendar failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
