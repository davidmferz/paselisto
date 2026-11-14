"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { validateBuyerFields, type BuyerFieldErrors } from "@/features/checkout/copy";

const inputCls =
  "h-12 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-[invalid=true]:border-destructive";

export function BuyForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BuyerFieldErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = validateBuyerFields({ name, email });
    setFieldErrors(errs);
    if (errs.name || errs.email) {
      // Keep the typed values; move focus to the first invalid field.
      (errs.name ? nameRef : emailRef).current?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        // The QR is persisted server-side; the order page loads it by id.
        router.push(`/order/${data.orderId}`);
        return;
      }
      if (res.status === 409) {
        router.refresh();
        return;
      }
      setError(data.error ?? "Intenta de nuevo en unos segundos");
    } catch {
      setError("Sin conexión. Intenta de nuevo en unos segundos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="buyer-name" className="text-sm font-medium">
          Nombre completo
        </label>
        <input
          id="buyer-name"
          ref={nameRef}
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "buyer-name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="buyer-name-error" role="alert" className="text-sm text-destructive">
            {fieldErrors.name}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="buyer-email" className="text-sm font-medium">
          Correo electrónico
        </label>
        <input
          id="buyer-email"
          ref={emailRef}
          className={inputCls}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "buyer-email-error buyer-email-hint" : "buyer-email-hint"}
        />
        <p id="buyer-email-hint" className="text-xs text-muted-foreground">
          Para identificar tu compra
        </p>
        {fieldErrors.email && (
          <p id="buyer-email-error" role="alert" className="text-sm text-destructive">
            {fieldErrors.email}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 min-h-11 w-full text-base" disabled={loading}>
        {loading ? "Generando QR…" : "Pagar con CoDi"}
      </Button>
    </form>
  );
}
