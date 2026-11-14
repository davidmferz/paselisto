"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAgo } from "@/features/checkout/copy";

type Status = "pending" | "paid" | "review" | "expired";
type OrderData = {
  status: Status;
  buyerName: string;
  expiresAt: string;
  passToken: string | null;
  orderRef: string;
  qrString: string | null;
};
type EventInfo = { slug: string; name: string; date: string | null; contact: string | null };

const POLL_MS = 2500;
const REVIEW_POLL_MS = 10_000;
const BTN = "h-12 min-h-11 w-full px-4 text-base";

function useQrDataUrl(text: string | null, width: number) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!text) return;
    QRCode.toDataURL(text, { width, margin: 2, errorCorrectionLevel: "M" })
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null));
    return () => {
      cancelled = true;
    };
  }, [text, width]);
  return text ? url : null;
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Visual countdown; hidden from assistive tech so it never spams the live region. */
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const s = Math.floor(left / 1000);
  return (
    <span className="tabular-nums" aria-hidden="true">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/** Re-renders every second so "hace Xs" stays fresh (visual only). */
function Ago({ at }: { at: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{at === null ? "aún no" : formatAgo(now - at)}</span>;
}

const STATUS_ANNOUNCE: Record<Status, string> = {
  pending: "Esperando tu pago.",
  paid: "Pago confirmado. Tu pase de entrada está listo.",
  review: "Tu pago requiere revisión. Aún no tienes un pase.",
  expired: "El QR venció.",
};

export function OrderView({
  orderId,
  legacyQr,
  event,
}: {
  orderId: string;
  legacyQr: string | null;
  event: EventInfo;
}) {
  const [data, setData] = useState<OrderData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [checkedNoPayment, setCheckedNoPayment] = useState(false);
  const inFlight = useRef(false);

  const fetchStatus = useCallback(
    async (method: "GET" | "POST" = "GET"): Promise<OrderData | null> => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { method, cache: "no-store" });
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        const next: OrderData = await res.json();
        setData(next);
        setOffline(false);
        setLastOk(Date.now());
        return next;
      } catch {
        setOffline(true);
        return null;
      }
    },
    [orderId],
  );

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      await fetchStatus();
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [fetchStatus]);

  const status = data?.status;
  const stopped = notFound || status === "paid" || status === "expired";
  const intervalMs = status === "review" ? REVIEW_POLL_MS : POLL_MS;
  useEffect(() => {
    if (stopped) return;
    // First fetch via timeout(0) keeps setState out of the effect body.
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [poll, stopped, intervalMs]);

  // Server-persisted QR first; ?qr= only as backwards-compat fallback.
  const qrString = data?.status === "pending" ? (data.qrString ?? legacyQr) : null;
  const payQr = useQrDataUrl(qrString, 320);
  const passQr = useQrDataUrl(data?.status === "paid" ? data.passToken : null, 360);

  async function onClaimPaid() {
    setChecking(true);
    setCheckedNoPayment(false);
    const next = await fetchStatus("POST");
    setChecking(false);
    if (next && next.status === "expired") setCheckedNoPayment(true);
  }

  const live = (
    <p className="sr-only" role="status" aria-live="polite">
      {notFound ? "Orden no encontrada." : status ? STATUS_ANNOUNCE[status] : "Cargando."}
      {offline ? " Sin conexión, reintentando." : ""}
    </p>
  );

  if (notFound) {
    return (
      <Shell>
        {live}
        <h1 className="text-2xl font-bold">Orden no encontrada</h1>
        <p className="text-muted-foreground">Revisa el enlace o vuelve a comprar tu entrada.</p>
        <BackLink slug={event.slug} />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        {live}
        <p className="text-muted-foreground">Cargando…</p>
        {offline && (
          <p role="alert" className="rounded-lg bg-muted p-3 text-sm">
            Sin conexión, reintentando…
          </p>
        )}
      </Shell>
    );
  }

  if (data.status === "paid") {
    return (
      <Shell>
        {live}
        <p className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-900">
          Pase de entrada
        </p>
        <h1 className="text-2xl font-bold">Pase de entrada · pago confirmado</h1>
        <p className="text-muted-foreground">
          {data.buyerName}, esta es tu entrada para <strong className="text-foreground">{event.name}</strong>
          {event.date ? ` (${event.date})` : ""}.
        </p>
        {data.passToken ? (
          <PassBody token={data.passToken} qr={passQr} />
        ) : (
          <p className="text-muted-foreground">Generando tu pase…</p>
        )}
        <p className="text-xs text-muted-foreground">Referencia: {data.orderRef}</p>
      </Shell>
    );
  }

  if (data.status === "review") {
    return (
      <Shell>
        {live}
        <h1 className="text-2xl font-bold">Tu pago requiere revisión</h1>
        <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-950">
          Tu pago requiere revisión. Aún no tienes un pase. No vuelvas a pagar.
        </p>
        <p className="text-muted-foreground">
          Referencia de tu orden: <strong className="font-mono text-foreground">{data.orderRef}</strong>
        </p>
        {event.contact && (
          <p className="text-muted-foreground">
            Contacta al organizador con esa referencia: <strong className="text-foreground">{event.contact}</strong>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Seguimos revisando; si se aprueba, tu pase aparecerá en esta misma página.
          {offline ? " Sin conexión, reintentando…" : ""}
        </p>
      </Shell>
    );
  }

  if (data.status === "expired") {
    return (
      <Shell>
        {live}
        <h1 className="text-2xl font-bold">El QR venció</h1>
        {checkedNoPayment ? (
          <p role="status" className="rounded-lg bg-muted p-3 text-sm">
            No encontramos un pago para esta orden. Si ya pagaste, espera unos minutos y vuelve a consultar.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Antes de generar uno nuevo, confirma que no hayas pagado ya: así evitas pagar dos veces.
          </p>
        )}
        <Button className={BTN} onClick={onClaimPaid} disabled={checking}>
          {checking ? "Consultando pago…" : "Ya realicé el pago"}
        </Button>
        {offline && (
          <p role="alert" className="text-sm font-medium text-destructive">
            Sin conexión, reintentando…
          </p>
        )}
        {checkedNoPayment && <BackLink slug={event.slug} label="Generar nuevo QR" variant="outline" />}
        <p className="text-xs text-muted-foreground">Referencia: {data.orderRef}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      {live}
      <p className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest">QR para pagar</p>
      <h1 className="text-2xl font-bold">Paga con CoDi</h1>
      <p className="text-muted-foreground">
        Escanea este QR con la app de tu banco (CoDi). Vence en <Countdown expiresAt={data.expiresAt} />
      </p>
      {qrString ? (
        payQr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={payQr} alt="QR de pago CoDi" className="w-full max-w-xs rounded-xl border bg-white" />
            <Button variant="outline" className={BTN} onClick={() => download(payQr, `codi-qr-${data.orderRef}.png`)}>
              Descargar QR
            </Button>
            <div className="w-full rounded-lg bg-muted p-3 text-left text-sm">
              <p className="font-medium">¿Estás en tu celular?</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                <li>Descarga el QR.</li>
                <li>Abre CoDi en la app de tu banco.</li>
                <li>Elige &quot;subir imagen&quot; o &quot;galería&quot; y selecciona el QR (si tu banco lo permite).</li>
              </ol>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Generando QR…</p>
        )
      ) : (
        <p role="alert" className="rounded-lg bg-muted p-3 text-sm">
          No pudimos cargar el QR de pago. Recarga la página; no generes otra orden todavía.
        </p>
      )}
      <div className="space-y-1">
        <p className="font-medium">Esperando tu pago…</p>
        <p className="text-sm text-muted-foreground">
          Última actualización <Ago at={lastOk} />
        </p>
        {offline && (
          <p role="alert" className="text-sm font-medium text-destructive">
            Sin conexión, reintentando…
          </p>
        )}
      </div>
      <Button variant="outline" className={BTN} onClick={onClaimPaid} disabled={checking}>
        {checking ? "Consultando pago…" : "Ya pagué"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Este botón solo consulta el estado; no confirma tu pago. Tu pase aparece aquí en cuanto CoDi lo confirma.
      </p>
    </Shell>
  );
}

function PassBody({ token, qr }: { token: string; qr: string | null }) {
  const codeRef = useRef<HTMLParagraphElement>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied("ok");
    } catch {
      // Fallback: select the text so the user can copy manually.
      const el = codeRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        try {
          setCopied(document.execCommand("copy") ? "ok" : "fail");
          return;
        } catch {
          /* fall through */
        }
      }
      setCopied("fail");
    }
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="QR de tu pase de entrada" className="w-full max-w-xs rounded-xl border bg-white" />}
      <div className="w-full space-y-1">
        <p className="text-xs text-muted-foreground">Código manual</p>
        <p ref={codeRef} className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-lg font-semibold select-all">
          {token}
        </p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        <Button className={BTN} disabled={!qr} onClick={() => qr && download(qr, "pase-entrada.png")}>
          Descargar pase
        </Button>
        <Button variant="outline" className={BTN} onClick={copy}>
          Copiar código
        </Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {copied === "ok" && "Código copiado."}
        {copied === "fail" && "No pudimos copiar. Mantén presionado el código para copiarlo."}
      </p>
      <p className="rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-950">
        No compartas este pase: solo permite una entrada.
      </p>
      <p className="text-sm text-muted-foreground">Muestra este QR en la entrada. Guarda esta página: es tu entrada.</p>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 py-8 text-center">
      {children}
    </main>
  );
}

function BackLink({
  slug,
  label = "Volver al evento",
  variant = "primary",
}: {
  slug: string;
  label?: string;
  variant?: "primary" | "outline";
}) {
  return (
    <Link
      href={`/e/${slug}`}
      className={
        "inline-flex h-12 min-h-11 w-full items-center justify-center rounded-lg px-4 text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring " +
        (variant === "primary"
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-background text-foreground")
      }
    >
      {label}
    </Link>
  );
}
