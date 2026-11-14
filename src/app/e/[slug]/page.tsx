import { notFound } from "next/navigation";
import { getEventView } from "@/features/checkout/use-cases";
import { getClock, getRepo } from "@/shared/container";
import { formatMxn } from "@/shared/format";
import { BuyForm } from "./buy-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventView({ repo: getRepo(), clock: getClock() }, slug);
  if (!event) notFound();

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
