import Link from "next/link";
import { requireAdminPage } from "@/features/organizer/server-auth";
import { resolveEvent } from "@/features/organizer/resolve-event";
import { OrdersPanel } from "@/components/admin/orders-panel";
import { LogoutButton } from "@/components/admin/logout-button";
import { getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  await requireAdminPage();
  const { event: ref } = await searchParams;
  const repo = getRepo();
  const [event, events] = await Promise.all([resolveEvent(repo, typeof ref === "string" ? ref : undefined), repo.listEvents()]);
  if (!event) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4">
        <h1 className="text-xl font-bold">Panel</h1>
        <p className="text-base text-muted-foreground">
          {typeof ref === "string" && ref ? "No encontramos ese taller." : "Todavía no hay talleres."}
        </p>
        {events.length > 0 && <Link href="/admin" className="underline">Ver el primer taller</Link>}
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">Panel</h1>
          <p className="truncate text-sm text-muted-foreground">{event.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/scan?event=${encodeURIComponent(event.slug)}`} className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/60">
            Escanear
          </Link>
          <LogoutButton />
        </div>
      </header>
      {events.length > 1 && (
        <nav aria-label="Talleres" className="flex flex-wrap gap-2">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/admin?event=${encodeURIComponent(e.slug)}`}
              aria-current={e.id === event.id ? "page" : undefined}
              className={`inline-flex h-11 items-center rounded-full border px-4 text-sm ${e.id === event.id ? "bg-primary font-semibold text-primary-foreground" : ""}`}
            >
              {e.name}
            </Link>
          ))}
        </nav>
      )}
      <OrdersPanel eventSlug={event.slug} />
    </main>
  );
}
