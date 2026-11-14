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
  return <OrderView orderId={id} qrString={typeof qr === "string" ? qr : null} />;
}
