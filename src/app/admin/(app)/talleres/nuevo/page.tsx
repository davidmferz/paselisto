import Link from "next/link";
import { NewEventFlow } from "@/features/events/components/new-event-flow";
import { createEventsEnabled } from "@/features/events/flag";
import { requireAdminPage } from "@/features/organizer/server-auth";
import { getConfig } from "@/shared/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NuevoTallerPage() {
  await requireAdminPage("/admin/talleres/nuevo");
  if (!createEventsEnabled()) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
          <h1 className="text-h1 font-display">No disponible</h1>
        <p className="text-muted-foreground">Crear talleres todavía no está activado.</p>
        <Link href="/admin/talleres" className="underline">Ir a Mis talleres</Link>
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 p-4">
      <NewEventFlow appUrl={getConfig().appUrl} />
    </main>
  );
}
