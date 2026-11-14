"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
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
      setError(res.status === 401 ? "Contraseña incorrecta" : "Error inesperado, reintentá");
    } catch {
      setError("Sin conexión, reintentá");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Contraseña
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 rounded-md border bg-background px-3 text-base"
          required
        />
      </label>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || !password}>
        {busy ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
