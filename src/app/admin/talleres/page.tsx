import Link from "next/link";
import { Logo } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { EventCard } from "@/features/events/components/event-card";
import { createEventsEnabled } from "@/features/events/flag";
import { listMyEvents } from "@/features/events/list-events";
import { eventUrl } from "@/features/events/share";
import { requireAdminPage } from "@/features/organizer/server-auth";
import { getConfig } from "@/shared/config";
import { getClock, getRepo } from "@/shared/container";
import { formatEventDate } from "@/shared/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TalleresPage() {
  await requireAdminPage();
  const cfg = getConfig();
  const events = await listMyEvents(getRepo(), getClock());
  const canCreate = createEventsEnabled();
  const selling = events.filter((e) => e.status === "a_la_venta").length;
  const sold = events.reduce((n, e) => n + e.counters.sold, 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 p-4">
      <header className="flex items-center justify-between gap-2">
        <Logo />
        <span className="truncate text-sm text-muted-foreground">{cfg.event.organizer ?? "Organizador"}</span>
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-display">Mis talleres</h1>
        <p className="text-sm text-muted-foreground">
          {events.length === 0
            ? "Todavía no tienes talleres."
            : `${selling} a la venta · ${sold} lugares vendidos en total`}
        </p>
      </div>
      {canCreate && (
        <Link href="/admin/talleres/nuevo" className={buttonVariants({ variant: "accent", size: "full" })}>
          + Nuevo taller
        </Link>
      )}
      {events.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line-strong bg-surface p-6 text-center">
          <p className="font-display text-lg font-bold">Aún no hay talleres</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canCreate ? "Crea tu primer taller y comparte el link para vender lugares." : "Cuando se publique uno, aparecerá aquí."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((e) => (
            <EventCard
              key={e.id}
              e={{
                slug: e.slug,
                name: e.name,
                dateLabel: e.startsAt ? formatEventDate(new Date(e.startsAt)) : "Fecha por definir",
                status: e.status,
                sold: e.counters.sold,
                reserved: e.counters.reserved,
                available: e.counters.available,
                capacity: e.capacity,
                url: eventUrl(cfg.appUrl, e.slug),
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
