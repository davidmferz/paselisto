import { notFound } from "next/navigation";
import { getOrderEventView } from "@/features/checkout/use-cases";
import { getRepo } from "@/shared/container";
import { formatEventDate } from "@/shared/format";
import { OrderView } from "./order-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qr?: string | string[] }>;
}) {
  const { id } = await params;
  const { qr } = await searchParams;
  // The order's own event, from the DB: never the global EVENT_* config.
  const event = await getOrderEventView(getRepo(), id);
  if (!event) notFound();
  return (
    <OrderView
      orderId={id}
      // Legacy fallback only: the server-persisted QR (API) always wins.
      legacyQr={typeof qr === "string" ? qr : null}
      event={{
        slug: event.slug,
        name: event.name,
        date: event.startsAt ? formatEventDate(event.startsAt) : null,
        contact: event.contact,
      }}
    />
  );
}
