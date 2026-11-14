import { LoginForm } from "@/components/admin/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">PaseListo · Organizador</h1>
      <LoginForm />
    </main>
  );
}
