import { effectiveStatus } from "@/features/checkout/domain";
import type { Order } from "@/shared/ports";

export type Decision =
  | { kind: "noop" }
  | { kind: "paid" }
  | { kind: "review"; reason: "amount" | "late" | "capacity" };

export function decide(i: {
  order: Order;
  amountCents: number;
  paidCount: number;
  capacity: number;
  now: Date;
}): Decision {
  const { order } = i;
  if (order.status === "paid" || order.status === "review") return { kind: "noop" };
  if (effectiveStatus(order, i.now) === "expired") return { kind: "review", reason: "late" };
  if (i.amountCents !== order.amountCents) return { kind: "review", reason: "amount" };
  if (i.paidCount >= i.capacity) return { kind: "review", reason: "capacity" };
  return { kind: "paid" };
}
