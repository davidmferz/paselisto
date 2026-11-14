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
        <Link href="/admin" className="inline-flex h-11 items-center px-2 text-base underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/60">Panel</Link>
      </header>
      <Scanner />
    </main>
  );
}
