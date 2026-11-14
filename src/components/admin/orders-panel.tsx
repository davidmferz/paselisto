"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, ScanLine } from "lucide-react";
import { agoLabel, reviewReasonView } from "@/features/organizer/format";
import type { AdminOrdersView, AdminStatus } from "@/features/organizer/list-orders";
import { StatStrip } from "@/components/brand";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { barPercents, initials, orderSubline } from "./panel-view";

const POLL_MS = 3000;

const PILL: Record<AdminStatus, "pagado" | "pendiente" | "revision" | "usado"> = {
  pending: "pendiente",
  paid: "pagado",
  used: "usado",
  review: "revision",
  expired: "usado",
};

export function OrdersPanel({ eventSlug }: { eventSlug: string }) {
  const router = useRouter();
  const [view, setView] = useState<AdminOrdersView | null>(null);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch(`/api/admin/orders?event=${encodeURIComponent(eventSlug)}`, { cache: "no-store" });
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
  }, [router, eventSlug]);

  if (!view) {
    return <p role="status" className="text-base text-muted-foreground">{error ? "Sin conexión, reintentando…" : "Cargando..."}</p>;
  }

  const c = view.counters;
  const bar = barPercents({ sold: c.sold, reserved: c.reserved, capacity: c.capacity });
  const visible = view.orders;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p role="status" className={`flex items-center gap-2 text-xs font-bold ${error ? "text-no" : "text-ok"}`}>
          <span aria-hidden className={`size-2 rounded-full bg-current ${error ? "" : "animate-pulse"}`} />
          {error ? "Sin conexión, reintentando…" : `En vivo · ${updatedAt ? agoLabel(now - updatedAt) : ""}`}
        </p>
        <h2 className="text-h1">{view.event.name}</h2>
        <p className="text-sm text-muted-foreground">Capacidad {c.capacity}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-[24px] bg-ink p-5 text-on-ink">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-label opacity-80">Vendidos</p>
            <p className="font-data text-[44px] leading-none font-bold">
              {c.sold}<span className="text-2xl opacity-70"> / {c.capacity}</span>
            </p>
          </div>
          <p className="text-right text-sm opacity-90">
            <span className="text-label block opacity-80">Ingresaron</span>
            <span className="font-data font-bold">{c.entered}</span> de {c.sold} vendidos
          </p>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-on-ink/15" aria-hidden>
          <div className="h-full bg-mango" style={{ width: `${bar.sold}%` }} />
          <div className="h-full bg-mango/45" style={{ width: `${bar.reserved}%` }} />
        </div>
        <p className="text-xs opacity-90">
          {c.sold} vendidos · {c.reserved} reservados · {c.available} disponibles
        </p>
      </div>

      <StatStrip
        className="sm:grid-cols-3"
        stats={[
          { label: "Reservados", value: c.reserved, tone: "wait" },
          { label: "En revisión", value: view.counts.review, tone: "no" },
          { label: "Por ingresar", value: Math.max(0, c.sold - c.entered), tone: "ok" },
        ]}
      />

      {visible.length === 0 ? (
        <p className="text-base text-muted-foreground">Todavía no hay órdenes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((o) => (
            <li key={o.id} className="flex items-center gap-3 rounded-[24px] border border-line bg-surface p-3">
              <span aria-hidden className="font-data flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold">
                {initials(o.buyerName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-bold">
                  <span className="truncate">{o.buyerName}</span>
                  {o.confirmedVia === "webhook" && (
                    <Zap className="size-4 shrink-0 text-mango" aria-label="Confirmado al instante por el webhook de pey" />
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{orderSubline(o, now)}</p>
                {o.status === "review" && (
                  <p className="text-xs font-bold text-no">{reviewReasonView(o.reviewReason).title}</p>
                )}
              </div>
              <StatusPill status={PILL[o.status]} label={o.status === "expired" ? "Expirado" : o.status === "review" ? "En revisión" : undefined} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Zap className="size-3.5 text-mango" aria-hidden /> = confirmado al instante por el webhook de pey
      </p>

      <Link href={`/admin/scan?event=${encodeURIComponent(eventSlug)}`} className={buttonVariants({ variant: "primary", size: "full" })}>
        <ScanLine /> Escanear entradas de este taller
      </Link>
    </section>
  );
}
