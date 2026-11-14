import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/brand";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center gap-8 px-6 py-6">
      <Logo />
      <h1 className="text-h1">Panel de organizadora</h1>
      <LoginForm />
    </main>
  );
}
