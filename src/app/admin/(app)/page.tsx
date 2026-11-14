import Link from "next/link";
import { requireAdminPage } from "@/features/organizer/server-auth";
import { resolveEvent } from "@/features/organizer/resolve-event";
import { OrdersPanel } from "@/components/admin/orders-panel";
import { EventPicker } from "@/components/admin/event-picker";
import { getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const { event: raw } = await searchParams;
  const ref = typeof raw === "string" ? raw.trim() : "";
  await requireAdminPage(ref ? `/admin?event=${encodeURIComponent(ref)}` : "/admin");
  const repo = getRepo();
  // Never guess: without an explicit ?event= the organizer picks one.
  const event = ref ? await resolveEvent(repo, ref) : null;
  if (!event) {
    const events = await repo.listEvents();
    return (
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-6 py-6">
        {ref && <p role="alert" className="rounded-[14px] bg-no-soft p-3 text-sm text-no">No encontramos ese taller. Elige uno de la lista.</p>}
        <EventPicker title="¿De qué taller quieres ver el panel?" events={events} base="/admin" />
      </main>
    );
  }
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label text-muted-foreground">Panel de</p>
          <h1 className="text-h2 truncate">{event.name}</h1>
        </div>
        <Link href="/admin/talleres" className="inline-flex h-12 shrink-0 items-center rounded-[14px] px-3 text-sm font-bold underline outline-none focus-visible:ring-[3px] focus-visible:ring-mango">
          Cambiar taller
        </Link>
      </header>
      <OrdersPanel eventSlug={event.slug} />
    </main>
  );
}
