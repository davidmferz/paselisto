import { notFound } from "next/navigation";
import { CalendarDays, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { getEventView } from "@/features/checkout/use-cases";
import { getClock, getRepo } from "@/shared/container";
import { eventDayLong, eventTimeLabel, formatMxn } from "@/shared/format";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand";
import { BuyForm } from "./buy-form";
import { Cancellations } from "./cancellations";
import { priceEyebrow } from "./view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function InfoRow({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-ink [&_svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

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
        <span className="text-sm text-muted-foreground">Pago con CoDi</span>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-label w-fit rounded-full bg-mango-soft px-3 py-1.5 text-ink">Taller · {event.capacity} lugares</p>
        <h1 className="text-display text-balance text-[clamp(26px,8vw,34px)] break-words">{event.name}</h1>
        {event.description && <p className="text-base text-muted-foreground">{event.description}</p>}
      </section>

      {hasDetails && (
        <Card className="flex flex-col gap-4">
          {event.startsAt && (
            <InfoRow icon={<CalendarDays />} title={eventDayLong(event.startsAt)} sub={`${eventTimeLabel(event.startsAt)} (hora CDMX)`} />
          )}
          {event.venue && <InfoRow icon={<MapPin />} title={event.venue} />}
          {event.organizer && (
            <InfoRow icon={<UserRound />} title={`Organiza: ${event.organizer}`} sub="Recibe tu pago directo en su cuenta" />
          )}
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {event.contact && (
              <a
                href={`mailto:${event.contact}`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-line px-4 text-sm font-bold outline-none hover:bg-sunken focus-visible:ring-[3px] focus-visible:ring-mango"
              >
                Contactar
              </a>
            )}
            <Cancellations />
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <p className="text-label text-muted-foreground">{priceEyebrow(event.priceCents)}</p>
        <div className="flex items-end justify-between gap-3">
          <span className="font-data text-[36px] leading-none font-bold">{price} <span className="text-sm font-medium text-muted-foreground">MXN</span></span>
          <span className={`text-sm font-bold ${event.spotsLeft > 0 ? "text-ok" : "text-muted-foreground"}`}>
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
