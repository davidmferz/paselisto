import { notFound } from "next/navigation";
import { getEventView } from "@/features/checkout/use-cases";
import { getClock, getRepo } from "@/shared/container";
import { getConfig } from "@/shared/config";
import { formatMxn } from "@/shared/format";
import { BuyForm } from "./buy-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventView({ repo: getRepo(), clock: getClock() }, slug);
  if (!event) notFound();
  const info = getConfig().event;
  const rows = [
    ["Fecha", info.date],
    ["Lugar", info.venue],
    ["Organiza", info.organizer],
    ["Contacto", info.contact],
  ].filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">PaseListo</p>
        <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
        <p className="text-lg">
          {formatMxn(event.priceCents)} <span className="text-sm text-muted-foreground">por entrada</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {event.spotsLeft > 0 ? `Quedan ${event.spotsLeft} lugares` : "Sin lugares disponibles"}
        </p>
      </header>

      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border p-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-sm text-muted-foreground">
        El pago se confirma automáticamente con CoDi. Tu pase llega en esta misma página.
      </p>

      {event.spotsLeft > 0 ? (
        <BuyForm slug={event.slug} />
      ) : (
        <div role="status" className="rounded-xl border bg-muted p-6 text-center text-2xl font-bold">
          Agotado
        </div>
      )}
    </main>
  );
}
