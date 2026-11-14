"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { whatsappLink, whatsappMessage } from "@/features/events/share";
import type { EventStatus } from "@/features/events/list-events";

export type EventCardData = {
  slug: string;
  name: string;
  dateLabel: string;
  status: EventStatus;
  sold: number;
  reserved: number;
  available: number;
  capacity: number;
  url: string;
};

const CHIP: Record<EventStatus, { label: string; cls: string }> = {
  a_la_venta: { label: "A LA VENTA", cls: "bg-ok-soft text-ok" },
  agotado: { label: "AGOTADO", cls: "bg-wait-soft text-wait" },
  finalizado: { label: "FINALIZADO", cls: "bg-sunken text-muted-foreground" },
};

export function EventCard({ e }: { e: EventCardData }) {
  const [copied, setCopied] = useState(false);
  const pct = e.capacity > 0 ? Math.min(100, Math.round(((e.sold + e.reserved) / e.capacity) * 100)) : 0;
  const chip = CHIP[e.status];

  async function copy() {
    try {
      await navigator.clipboard.writeText(e.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia este link", e.url);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-label rounded-full px-3 py-1.5 ${chip.cls}`}>{chip.label}</span>
        <span className="text-sm text-muted-foreground">{e.dateLabel}</span>
      </div>
      <h2 className="text-h2 font-display">{e.name}</h2>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Lugares ocupados"
        className="h-2 w-full overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full rounded-full bg-mango" style={{ width: `${pct}%` }} />
      </div>
      <p className="font-data text-sm">
        {e.sold} vendidos · {e.reserved} reservados · {e.available} disponibles
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copy} className="flex-1">
          {copied ? "Link copiado" : "Copiar link"}
        </Button>
        <a
          href={whatsappLink(whatsappMessage({ name: e.name, dateLabel: e.dateLabel, url: e.url }))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-sunken"
        >
          Compartir
        </a>
        <Link
          href={`/admin?event=${encodeURIComponent(e.slug)}`}
          className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-ink px-4 text-sm font-bold text-on-ink hover:bg-ink/90"
        >
          Ver panel
        </Link>
      </div>
    </Card>
  );
}
