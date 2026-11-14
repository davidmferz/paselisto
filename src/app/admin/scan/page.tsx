import Link from "next/link";
import { requireAdminPage } from "@/features/organizer/server-auth";
import { resolveEvent } from "@/features/organizer/resolve-event";
import { Scanner } from "@/components/admin/scanner";
import { getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  await requireAdminPage();
  const { event: ref } = await searchParams;
  const event = await resolveEvent(getRepo(), typeof ref === "string" ? ref : undefined);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label text-muted-foreground">Escaneando</p>
          {event && <h1 className="text-h2 truncate">{event.name}</h1>}
        </div>
        <Link href={event ? `/admin?event=${encodeURIComponent(event.slug)}` : "/admin"} className="inline-flex h-12 shrink-0 items-center rounded-[14px] px-3 text-sm font-bold underline outline-none focus-visible:ring-[3px] focus-visible:ring-mango">Panel</Link>
      </header>
      {event ? (
        <Scanner eventId={event.id} eventSlug={event.slug} />
      ) : (
        <p className="text-base text-muted-foreground">
          {typeof ref === "string" && ref ? "No encontramos ese taller." : "Todavía no hay talleres."}
        </p>
      )}
    </main>
  );
}
