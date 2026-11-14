import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Mail, ShieldCheck } from "lucide-react";
import { getEventView } from "@/features/checkout/use-cases";
import { getClock, getRepo } from "@/shared/container";
import { formatEventDate, formatMxn } from "@/shared/format";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand";
import { BuyForm } from "./buy-form";
import { priceEyebrow } from "./view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventView({ repo: getRepo(), clock: getClock() }, slug);
  if (!event) notFound();
  const price = formatMxn(event.priceCents);
  const pct = event.capacity > 0 ? Math.round((event.spotsLeft / event.capacity) * 100) : 0;
  const hasDetails = Boolean(event.startsAt || event.venue || event.contact);

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="text-label rounded-full bg-sunken px-3 py-1.5 text-muted-foreground">Pago con CoDi</span>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-label w-fit rounded-full bg-mango-soft px-3 py-1.5 text-ink">Taller · Entrada individual</p>
        <h1 className="text-display">{event.name}</h1>
        {event.description && <p className="text-base text-muted-foreground">{event.description}</p>}
      </section>

      {hasDetails && (
        <Card className="flex flex-col gap-3">
          {event.startsAt && (
            <p className="flex items-start gap-3 text-sm font-medium">
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>{formatEventDate(event.startsAt)}</span>
            </p>
          )}
          {event.venue && (
            <p className="flex items-start gap-3 text-sm font-medium">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>{event.venue}</span>
            </p>
          )}
          {event.contact && (
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="flex min-w-0 items-center gap-3 text-sm">
                <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{event.contact}</span>
              </p>
              <a
                href={`mailto:${event.contact}`}
                className="inline-flex h-12 shrink-0 items-center rounded-[14px] border-[1.5px] border-line px-4 text-sm font-bold outline-none hover:bg-sunken focus-visible:ring-[3px] focus-visible:ring-mango"
              >
                Contactar
              </a>
            </div>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <p className="text-label text-muted-foreground">{priceEyebrow(event.priceCents)}</p>
        <div className="flex items-end justify-between gap-3">
          <span className="font-data text-[36px] leading-none font-bold">{price}</span>
          <span className="text-sm text-muted-foreground">
            {event.spotsLeft > 0 ? `${event.spotsLeft} disponibles` : "Sin lugares disponibles"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="h-full rounded-full bg-mango" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {event.spotsLeft > 0 ? (
        <BuyForm slug={event.slug} price={price} />
      ) : (
        <div role="status" className="text-h2 rounded-[24px] bg-sunken p-6 text-center">
          Agotado
        </div>
      )}

      <p className="flex items-start gap-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
        <span>Tu pase aparece en esta página en cuanto el banco confirma el pago. No necesitas enviar capturas.</span>
      </p>
    </main>
  );
}
