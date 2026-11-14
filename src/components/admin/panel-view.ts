import type { AdminOrder } from "@/features/organizer/list-orders";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((p) => p[0]!.toUpperCase()).join("") : "?";
}

export function barPercents(c: { sold: number; reserved: number; capacity: number }): { sold: number; reserved: number } {
  if (c.capacity <= 0) return { sold: 0, reserved: 0 };
  const sold = Math.min(100, Math.round((c.sold / c.capacity) * 100));
  const reserved = Math.max(0, Math.min(100 - sold, Math.round((c.reserved / c.capacity) * 100)));
  return { sold, reserved };
}

const clock = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false });
function hhmm(iso: string): string {
  return clock.format(new Date(iso));
}

export function orderSubline(o: Pick<AdminOrder, "status" | "createdAt" | "usedAt">, now: number): string {
  switch (o.status) {
    case "pending":
      return `Reservado · hace ${Math.max(0, Math.floor((now - new Date(o.createdAt).getTime()) / 60000))} min`;
    case "paid":
      return `Pagó ${hhmm(o.createdAt)}`;
    case "used":
      return `Pagó ${hhmm(o.createdAt)}${o.usedAt ? ` · Ingresó ${hhmm(o.usedAt)}` : ""}`;
    case "review":
      return "Pago por revisar";
    default:
      return "QR vencido";
  }
}
