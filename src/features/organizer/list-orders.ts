import type { Clock, OrdersRepo } from "@/shared/ports";

export type AdminStatus = "pending" | "paid" | "used" | "review" | "expired";

export type AdminOrder = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  amountCents: number;
  status: AdminStatus;
  reviewReason: string | null;
  confirmedVia: "webhook" | "poll" | null;
  createdAt: string;
  usedAt: string | null;
};

export type AdminOrdersView = { orders: AdminOrder[]; counts: Record<AdminStatus, number> };

export async function listOrders(repo: OrdersRepo, clock: Clock): Promise<AdminOrdersView> {
  const now = clock.now();
  const rows = await repo.listOrders();
  const counts: Record<AdminStatus, number> = { pending: 0, paid: 0, used: 0, review: 0, expired: 0 };
  const sorted = [...rows].sort((a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime());
  const orders = sorted.map(({ order, usedAt }): AdminOrder => {
    let status: AdminStatus;
    if (order.status === "paid") status = usedAt ? "used" : "paid";
    else if (order.status === "pending" && order.expiresAt <= now) status = "expired";
    else status = order.status;
    counts[status]++;
    return {
      id: order.id,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      amountCents: order.amountCents,
      status,
      reviewReason: order.reviewReason,
      confirmedVia: order.confirmedVia,
      createdAt: order.createdAt.toISOString(),
      usedAt: usedAt ? usedAt.toISOString() : null,
    };
  });
  return { orders, counts };
}
