import type { Order, OrderStatus } from "@/shared/ports";

export function hasCapacity(occupied: number, capacity: number): boolean {
  return occupied < capacity;
}

/** `expired` is derived lazily: pending and past expiresAt. */
export function effectiveStatus(order: Pick<Order, "status" | "expiresAt">, now: Date): OrderStatus {
  if (order.status === "pending" && order.expiresAt <= now) return "expired";
  return order.status;
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "review", "expired"],
  expired: ["review"],
  review: [],
  paid: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BuyerValidation = { ok: true; name: string; email: string } | { ok: false; error: string };

export function validateBuyer(i: { name: unknown; email: unknown }): BuyerValidation {
  const name = typeof i.name === "string" ? i.name.trim() : "";
  const email = typeof i.email === "string" ? i.email.trim() : "";
  if (!name) return { ok: false, error: "name required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid email" };
  return { ok: true, name, email };
}
