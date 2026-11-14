"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parsePriceToCents, slugify, zonedMexicoCityToUtc, type EventField } from "@/features/events/domain";
import { whatsappLink, whatsappMessage } from "@/features/events/share";
import { formatEventDate, formatMxn } from "@/shared/format";

type Form = {
  name: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  price: string;
  capacity: string;
  contactEmail: string;
};
type Errors = Partial<Record<EventField, string>>;
type Published = { slug: string; name: string; url: string; startsAt: string | null };

const EMPTY: Form = { name: "", description: "", date: "", time: "", venue: "", price: "", capacity: "", contactEmail: "" };

function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-label">{label}</label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-no">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function NewEventFlow({ appUrl }: { appUrl: string }) {
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [form, setForm] = useState<Form>(EMPTY);
  const [slugEdit, setSlugEdit] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Published | null>(null);
  const [copied, setCopied] = useState(false);
  // One idempotency key per form session: retries of the same publish never duplicate the event.
  const keyRef = useRef<string | null>(null);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };
  const slug = slugEdit ?? slugify(form.name);
  const base = appUrl.replace(/\/+$/, "");
  const startsAt = useMemo(() => zonedMexicoCityToUtc(form.date, form.time), [form.date, form.time]);
  const dateLabel = startsAt ? formatEventDate(startsAt) : "";
  const priceCents = parsePriceToCents(form.price);

  function goReview() {
    // Light client check for fast feedback; the server is the source of truth and re-validates everything.
    const er: Errors = {};
    if (form.name.trim().length < 3) er.name = "Escribe el nombre del taller (mínimo 3 caracteres).";
    if (!startsAt) er.date = "Elige una fecha y una hora.";
    if (form.venue.trim().length < 3) er.venue = "Escribe dónde será el taller.";
    if (priceCents === null) er.price = "Escribe un precio válido en pesos, por ejemplo 350 o 350.50.";
    if (!/^\d+$/.test(form.capacity.trim()) || Number(form.capacity) < 1 || Number(form.capacity) > 500) er.capacity = "El cupo es un número de 1 a 500.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contactEmail.trim())) er.contactEmail = "Escribe un correo de contacto válido.";
    setErrors(er);
    if (Object.keys(er).length === 0) setStep("review");
  }

  async function publish() {
    setBusy(true);
    setFormError(null);
    keyRef.current ??= crypto.randomUUID();
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": keyRef.current },
        body: JSON.stringify({ ...form, ...(slugEdit ? { slug: slugEdit } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPublished(data.event as Published);
        setStep("done");
        return;
      }
      if (res.status === 422 || (res.status === 409 && data.errors)) {
        setErrors(data.errors ?? {});
        setStep("form");
        setFormError("Revisa los campos marcados.");
        // A rejected publish created nothing; allow a fresh key for the corrected submission.
        keyRef.current = null;
        return;
      }
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      setFormError(res.status === 403 ? "No disponible." : "No pudimos publicar el taller. Intenta de nuevo en unos segundos.");
    } catch {
      setFormError("Sin conexión. Intenta de nuevo; no se duplicará tu taller.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(published.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia este link", published.url);
    }
  }

  if (step === "done" && published) {
    const dl = published.startsAt ? formatEventDate(new Date(published.startsAt)) : dateLabel;
    const msg = whatsappMessage({ name: published.name, dateLabel: dl, url: published.url });
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-h1 font-display">¡Tu taller ya está a la venta!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comparte el link para que tus alumnos aparten su lugar.</p>
        </div>
        <Card className="flex flex-col gap-2">
          <span className="text-label text-muted-foreground">Mensaje para WhatsApp</span>
          <p className="whitespace-pre-wrap rounded-[14px] bg-sunken p-3 text-sm">{msg}</p>
        </Card>
        <a
          href={whatsappLink(msg)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-13 min-h-12 w-full items-center justify-center rounded-[14px] bg-mango px-5 text-base font-bold text-ink hover:brightness-95"
        >
          Enviar por WhatsApp
        </a>
        <Button variant="secondary" size="full" onClick={copyLink}>{copied ? "Link copiado" : "Copiar link"}</Button>
        <Link href="/admin/talleres" className="inline-flex h-13 min-h-12 w-full items-center justify-center rounded-[14px] text-base font-bold text-ink underline">
          Ir a Mis talleres
        </Link>
      </div>
    );
  }

  if (step === "review") {
    const rows: [string, string][] = [
      ["Nombre", form.name.trim()],
      ["Descripción", form.description.trim() || "Sin descripción"],
      ["Fecha y hora", `${dateLabel} (hora CDMX)`],
      ["Lugar", form.venue.trim()],
      ["Precio", priceCents !== null ? `${formatMxn(priceCents)} MXN` : ""],
      ["Cupo", `${form.capacity.trim()} lugares`],
      ["Correo de contacto", form.contactEmail.trim()],
      ["Link", `${base}/e/${slug}`],
    ];
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1 font-display">Revisa y publica</h1>
        <Card className="flex flex-col gap-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="text-label text-muted-foreground">{k}</span>
              <span className="break-words text-base">{v}</span>
            </div>
          ))}
        </Card>
        <p role="note" className="rounded-[14px] bg-wait-soft p-3 text-sm text-wait">
          Después de publicar, el link y la fecha no se pueden cambiar.
        </p>
        {formError && <p role="alert" className="text-sm text-no">{formError}</p>}
        <Button variant="primary" size="full" onClick={publish} disabled={busy}>
          {busy ? "Publicando…" : "Publicar taller"}
        </Button>
        <Button variant="secondary" size="full" onClick={() => setStep("form")} disabled={busy}>Corregir</Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        goReview();
      }}
    >
      <div>
        <Link href="/admin/talleres" className="text-sm underline">← Mis talleres</Link>
        <h1 className="mt-2 text-h1 font-display">Nuevo taller</h1>
      </div>
      {formError && <p role="alert" className="rounded-[14px] bg-no-soft p-3 text-sm text-no">{formError}</p>}

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 font-display">El taller</h2>
        <Field label="Nombre" htmlFor="name" error={errors.name}>
          <Input id="name" value={form.name} onChange={set("name")} maxLength={80} placeholder="Taller de cerámica" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} />
        </Field>
        <Field label="Descripción (opcional)" htmlFor="description" error={errors.description} hint={`${form.description.length}/280`}>
          <Textarea id="description" value={form.description} onChange={set("description")} maxLength={280} aria-invalid={!!errors.description} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" htmlFor="date" error={errors.date}>
            <Input id="date" type="date" value={form.date} onChange={set("date")} aria-invalid={!!errors.date} />
          </Field>
          <Field label="Hora" htmlFor="time">
            <Input id="time" type="time" value={form.time} onChange={set("time")} aria-invalid={!!errors.date} />
          </Field>
        </div>
        <p className="-mt-3 text-sm text-muted-foreground">Hora de la Ciudad de México (CDMX)</p>
        <Field label="Lugar" htmlFor="venue" error={errors.venue}>
          <Input id="venue" value={form.venue} onChange={set("venue")} maxLength={120} placeholder="Estudio Barro Vivo, Roma Norte" aria-invalid={!!errors.venue} />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 font-display">Venta</h2>
        <Field label="Precio" htmlFor="price" error={errors.price}>
          <Input id="price" inputMode="decimal" prefix="$" suffix="MXN" value={form.price} onChange={set("price")} placeholder="350" aria-invalid={!!errors.price} />
        </Field>
        <Field label="Cupo" htmlFor="capacity" error={errors.capacity}>
          <Input id="capacity" inputMode="numeric" suffix="lugares" value={form.capacity} onChange={set("capacity")} placeholder="20" aria-invalid={!!errors.capacity} />
        </Field>
        <Field label="Correo de contacto" htmlFor="contactEmail" error={errors.contactEmail} hint="Tus alumnos lo verán para resolver dudas.">
          <Input id="contactEmail" type="email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="hola@tuestudio.mx" aria-invalid={!!errors.contactEmail} />
        </Field>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-h2 font-display">Tu link</h2>
        <Field label="Así se verá tu link" htmlFor="slug" error={errors.slug} hint="Puedes editarlo ahora; después de publicar no cambia.">
          <Input id="slug" prefix={`${base.replace(/^https?:\/\//, "")}/e/`} value={slug} onChange={(e) => { setSlugEdit(e.target.value.toLowerCase()); setErrors((er) => ({ ...er, slug: undefined })); }} aria-invalid={!!errors.slug} />
        </Field>
      </section>

      <Button type="submit" variant="primary" size="full">Revisar</Button>
    </form>
  );
}
