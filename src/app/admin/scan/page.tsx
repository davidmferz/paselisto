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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Check-in</h1>
          {event && <p className="truncate text-sm text-muted-foreground">Escaneando: {event.name}</p>}
        </div>
        <Link href={event ? `/admin?event=${encodeURIComponent(event.slug)}` : "/admin"} className="inline-flex h-11 items-center px-2 text-base underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/60">Panel</Link>
      </header>
      {event ? (
        <Scanner eventId={event.id} />
      ) : (
        <p className="text-base text-muted-foreground">
          {typeof ref === "string" && ref ? "No encontramos ese taller." : "Todavía no hay talleres."}
        </p>
      )}
    </main>
  );
}
