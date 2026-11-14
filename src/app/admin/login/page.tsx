import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/brand";
import { safeNextPath } from "@/features/organizer/nav";
import { redirectIfAuthed } from "@/features/organizer/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  await redirectIfAuthed(next);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center gap-8 px-6 py-6">
      <Logo />
      <h1 className="text-h1">Panel de organizadora</h1>
      <LoginForm next={safeNextPath(next)} />
    </main>
  );
}
