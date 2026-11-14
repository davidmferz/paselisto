"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const FOCUS = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/60";

export function LoginForm() {
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
        router.replace("/admin");
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
        <label htmlFor="admin-password" className="text-base font-medium">Contraseña</label>
        <div className="flex gap-2">
          <input
            id="admin-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`h-12 min-w-0 flex-1 rounded-md border bg-background px-3 text-base ${FOCUS}`}
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className={`h-12 min-w-12 rounded-md border px-3 text-sm font-medium ${FOCUS}`}
          >
            {show ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-base font-medium text-red-700">{error}</p>}
      <Button type="submit" className={`h-12 text-base ${FOCUS}`} disabled={busy || !password}>
        {busy ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
