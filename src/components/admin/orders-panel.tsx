"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { agoLabel, confirmedViaLabel, reviewReasonView } from "@/features/organizer/format";
import type { AdminOrdersView, AdminStatus } from "@/features/organizer/list-orders";

const POLL_MS = 3000;

const LABEL: Record<AdminStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  used: "Usado",
  review: "Revisar",
  expired: "Expirado",
};
const STYLE: Record<AdminStatus, string> = {
  pending: "bg-yellow-100 text-yellow-900",
  paid: "bg-green-100 text-green-900",
  used: "bg-slate-200 text-slate-800",
  review: "bg-red-100 text-red-900",
  expired: "bg-slate-100 text-slate-600",
};
const ORDER: AdminStatus[] = ["paid", "used", "pending", "review", "expired"];

export function OrdersPanel() {
  const router = useRouter();
  const [view, setView] = useState<AdminOrdersView | null>(null);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/admin/orders", { cache: "no-store" });
        if (res.status === 401) return router.replace("/admin/login");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as AdminOrdersView;
        if (alive) {
          setView(data);
          setError(false);
          setUpdatedAt(Date.now());
        }
      } catch {
        if (alive) setError(true);
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(clock);
    };
  }, [router]);

  if (!view) return <p className="text-base text-muted-foreground">{error ? "Sin conexión, reintentando…" : "Cargando..."}</p>;

  return (
    <section className="flex flex-col gap-4">
      <p role="status" className={`text-sm ${error ? "font-semibold text-red-700" : "text-muted-foreground"}`}>
        {error ? "Sin conexión, reintentando…" : updatedAt ? agoLabel(now - updatedAt) : ""}
      </p>
      <ul className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
        {ORDER.map((s) => (
          <li key={s} className={`rounded-md p-2 ${STYLE[s]}`}>
            <div className="text-xl font-bold">{view.counts[s]}</div>
            <div className="text-sm font-medium">{LABEL[s]}</div>
          </li>
        ))}
      </ul>
      {view.orders.length === 0 ? (
        <p className="text-base text-muted-foreground">Todavía no hay órdenes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {view.orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{o.buyerName}</p>
                <p className="truncate text-sm text-muted-foreground">{o.buyerEmail}</p>
                {(o.status === "paid" || o.status === "used") && confirmedViaLabel(o.confirmedVia) && (
                  <p className="text-[13px] text-muted-foreground">{confirmedViaLabel(o.confirmedVia)}</p>
                )}
                {o.status === "review" && (
                  <div className="mt-1">
                    <p className="text-sm font-semibold text-red-700">{reviewReasonView(o.reviewReason).title}</p>
                    <p className="text-[13px] text-muted-foreground">{reviewReasonView(o.reviewReason).hint}</p>
                  </div>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold ${STYLE[o.status]}`}>
                {LABEL[o.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
