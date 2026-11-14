import { getConfig } from "@/shared/config";
import { OrderView } from "./order-view";

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
  const { event } = getConfig();
  return (
    <OrderView
      orderId={id}
      // Legacy fallback only: the server-persisted QR (API) always wins.
      legacyQr={typeof qr === "string" ? qr : null}
      event={{ slug: event.slug, name: event.name, date: event.date ?? null, contact: event.contact ?? null }}
    />
  );
}
