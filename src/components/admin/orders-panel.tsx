"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  expired: "bg-slate-100 text-slate-500",
};
const ORDER: AdminStatus[] = ["paid", "used", "pending", "review", "expired"];

export function OrdersPanel() {
  const router = useRouter();
  const [view, setView] = useState<AdminOrdersView | null>(null);
  const [error, setError] = useState(false);

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
        }
      } catch {
        if (alive) setError(true);
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);

  if (!view) return <p className="text-sm text-muted-foreground">{error ? "Error de conexión, reintentando..." : "Cargando..."}</p>;

  return (
    <section className="flex flex-col gap-4">
      <ul className="grid grid-cols-5 gap-2 text-center">
        {ORDER.map((s) => (
          <li key={s} className={`rounded-md p-2 ${STYLE[s]}`}>
            <div className="text-xl font-bold">{view.counts[s]}</div>
            <div className="text-[11px] font-medium">{LABEL[s]}</div>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-600">Conexión inestable, reintentando...</p>}
      {view.orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay órdenes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {view.orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{o.buyerName}</p>
                <p className="truncate text-xs text-muted-foreground">{o.buyerEmail}</p>
                {o.status === "review" && (
                  <p className="text-xs font-semibold text-red-700">
                    Revisar manualmente{o.reviewReason ? `: ${o.reviewReason}` : ""}
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STYLE[o.status]}`}>
                {LABEL[o.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
