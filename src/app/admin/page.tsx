import Link from "next/link";
import { requireAdminPage } from "@/features/organizer/server-auth";
import { OrdersPanel } from "@/components/admin/orders-panel";
import { LogoutButton } from "@/components/admin/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Panel</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/scan" className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/60">
            Escanear
          </Link>
          <LogoutButton />
        </div>
      </header>
      <OrdersPanel />
    </main>
  );
}
