"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setError(res.status === 401 ? "Contraseña incorrecta" : "Error inesperado, reintenta");
    } catch {
      setError("Sin conexión, reintenta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="admin-password" className="text-sm font-bold">Contraseña</label>
        <Input
          id="admin-password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          icon={<Lock />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          wrapperClassName="min-h-[52px] h-[52px] pr-1"
          required
          aria-invalid={error ? true : undefined}
          suffix={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-pressed={show}
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="flex size-12 items-center justify-center rounded-[14px] text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-mango"
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        />
      </div>
      {error && <p role="alert" className="text-sm font-bold text-no">{error}</p>}
      <Button type="submit" variant="primary" size="full" disabled={busy || !password}>
        {busy ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
