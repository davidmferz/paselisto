"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const inputCls =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function BuyForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        router.push(`/order/${data.orderId}?qr=${encodeURIComponent(data.qrString)}`);
        return;
      }
      if (res.status === 409) {
        router.refresh();
        return;
      }
      setError(data.error ?? "Reintentá en unos segundos");
    } catch {
      setError("Reintentá en unos segundos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nombre completo</span>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          className={inputCls}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
        {loading ? "Generando QR..." : "Pagar con CoDi"}
      </Button>
    </form>
  );
}
