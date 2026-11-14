import Link from "next/link";
import { requireAdminPage } from "@/features/organizer/server-auth";
import { Scanner } from "@/components/admin/scanner";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  await requireAdminPage();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Check-in</h1>
        <Link href="/admin" className="text-sm underline">Panel</Link>
      </header>
      <Scanner />
    </main>
  );
}
