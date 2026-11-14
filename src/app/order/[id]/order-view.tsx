"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarPlus, Check, Download, Copy, Smartphone, WifiOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo, Steps, Ticket } from "@/components/brand";
import { StatusPill } from "@/components/ui/status-pill";
import { formatAgo } from "@/features/checkout/copy";

type Status = "pending" | "paid" | "review" | "expired";
type OrderData = {
  status: Status;
  buyerName: string;
  expiresAt: string;
  passToken: string | null;
  orderRef: string;
  qrString: string | null;
  calendar?: { icsUrl: string; googleUrl: string } | null;
};
type EventInfo = { slug: string; name: string; date: string | null; venue: string | null; contact: string | null };

const POLL_MS = 2500;
const REVIEW_POLL_MS = 10_000;

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

/**
 * Mobile browsers (iOS Safari, WhatsApp/Instagram in-app views) ignore `<a download>`
 * on data URLs, so on touch devices we hand the PNG to the native share sheet
 * ("Guardar imagen" → Photos). Desktop keeps a direct download via a blob URL.
 */
async function download(dataUrl: string, filename: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: "image/png" });
  const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}


function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Composes the downloadable pass image: event, date, venue, QR, holder and manual code. */
async function composePassImage(
  qrDataUrl: string,
  info: { eventName: string; date: string | null; venue: string | null; holder: string; code: string },
): Promise<string> {
  const img = new Image();
  img.src = qrDataUrl;
  await img.decode();
  const W = 720;
  const pad = 48;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = "800 48px system-ui, sans-serif";
  const titleLines = wrapText(probe, info.eventName, W - pad * 2);
  const qrBox = W - pad * 2;
  let H = pad + 28 + titleLines.length * 56 + (info.date ? 36 : 0) + (info.venue ? 32 : 0) + 40 + qrBox + 40 + 32 + 40 + pad;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#12142B";
  ctx.fillRect(0, 0, W, H);
  let y = pad;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#FF8A1F";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("PASE DE ENTRADA", pad, y);
  y += 28 + 8;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 48px system-ui, sans-serif";
  for (const l of titleLines) {
    ctx.fillText(l, pad, y);
    y += 56;
  }
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.globalAlpha = 0.85;
  if (info.date) {
    ctx.fillText(info.date, pad, y);
    y += 36;
  }
  if (info.venue) {
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText(info.venue, pad, y);
    y += 32;
  }
  ctx.globalAlpha = 1;
  y += 32;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(pad, y, qrBox, qrBox, 24);
  ctx.fill();
  const inner = qrBox - 48;
  ctx.drawImage(img, pad + 24, y + 24, inner, inner);
  y += qrBox + 32;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText(info.holder, pad, y);
  ctx.font = "500 22px ui-monospace, monospace";
  ctx.globalAlpha = 0.8;
  ctx.textAlign = "right";
  ctx.fillText(info.code, W - pad, y + 3);
  H = canvas.height;
  return canvas.toDataURL("image/png");
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
    <span className="font-data" aria-hidden="true">
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
  return <span className="font-data">{at === null ? "aún no" : formatAgo(now - at)}</span>;
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
  amount,
}: {
  orderId: string;
  legacyQr: string | null;
  event: EventInfo;
  amount: string | null;
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
        <h1 className="text-h1">Orden no encontrada</h1>
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
          <p role="alert" className="flex items-center gap-2 rounded-[14px] bg-sunken p-3 text-sm font-medium">
            <WifiOff className="size-4" aria-hidden /> Sin conexión, reintentando…
          </p>
        )}
      </Shell>
    );
  }

  if (data.status === "paid") {
    return (
      <Shell>
        {live}
        <StatusPill status="pagado" label="Pago confirmado" className="w-fit" />
        <h1 className="text-h1">¡Listo, {data.buyerName}! Este es tu pase.</h1>
        {data.passToken ? (
          <PassBody
            token={data.passToken}
            qr={passQr}
            event={event}
            holder={data.buyerName}
            calendar={data.calendar ?? null}
          />
        ) : (
          <p className="text-muted-foreground">Generando tu pase…</p>
        )}
        <p className="text-xs text-muted-foreground">Referencia: <span className="font-data">{data.orderRef}</span></p>
      </Shell>
    );
  }

  if (data.status === "review") {
    return (
      <Shell>
        {live}
        <h1 className="text-h1">Tu pago requiere revisión</h1>
        <p role="alert" className="rounded-[14px] bg-wait-soft p-4 text-sm font-bold text-wait">
          Tu pago requiere revisión. Aún no tienes un pase. No vuelvas a pagar.
        </p>
        <Card>
          <p className="text-label text-muted-foreground">Referencia de tu orden</p>
          <p className="font-data text-2xl font-bold">{data.orderRef}</p>
          {event.contact && (
            <p className="mt-3 text-sm text-muted-foreground">
              Contacta al organizador con esa referencia: <strong className="text-ink">{event.contact}</strong>
            </p>
          )}
        </Card>
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
        <h1 className="text-h1">El QR venció</h1>
        {checkedNoPayment ? (
          <p role="status" className="rounded-[14px] bg-sunken p-3 text-sm">
            No encontramos un pago para esta orden. Si ya pagaste, espera unos minutos y vuelve a consultar.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Antes de generar uno nuevo, confirma que no hayas pagado ya: así evitas pagar dos veces.
          </p>
        )}
        <Button variant="primary" size="full" onClick={onClaimPaid} disabled={checking}>
          {checking ? "Consultando pago…" : "Ya realicé el pago"}
        </Button>
        {offline && (
          <p role="alert" className="text-sm font-bold text-no">
            Sin conexión, reintentando…
          </p>
        )}
        {checkedNoPayment && <BackLink slug={event.slug} label="Generar nuevo QR" variant="secondary" />}
        <p className="text-xs text-muted-foreground">Referencia: <span className="font-data">{data.orderRef}</span></p>
      </Shell>
    );
  }

  return (
    <Shell>
      {live}
      <Steps steps={["Datos", "Pago", "Pase"]} current={1} />
      <section className="flex flex-col gap-1">
        <p className="text-label text-muted-foreground">Total a pagar</p>
        {amount && <p className="font-data text-[44px] leading-none font-bold">{amount}</p>}
        <p className="text-sm text-muted-foreground">Para: {event.name}</p>
      </section>

      {qrString && payQr && (
        <Card className="flex flex-col gap-2 border-transparent bg-mango-soft">
          <p className="text-h2 flex items-center gap-2">
            <Smartphone className="size-5" aria-hidden /> ¿Pagas desde este celular?
          </p>
          <p className="text-sm">Guarda el QR en tu galería y súbelo desde la app de tu banco (CoDi), si tu banco lo permite.</p>
          <Button variant="accent" size="full" onClick={() => download(payQr, `codi-qr-${data.orderRef}.png`)}>
            <Download /> Guardar QR de pago
          </Button>
        </Card>
      )}

      <Card className="flex flex-col items-center gap-4">
        <StatusPill status="pendiente" label="Esperando tu pago…" />
        {qrString ? (
          payQr ? (
            <div className="rounded-[18px] border border-line bg-white p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payQr} alt="QR de pago CoDi" className="size-56 max-w-full" />
            </div>
          ) : (
            <p className="text-muted-foreground">Generando QR…</p>
          )
        ) : (
          <p role="alert" className="rounded-[14px] bg-sunken p-3 text-sm">
            No pudimos cargar el QR de pago. Recarga la página; no generes otra orden todavía.
          </p>
        )}
        <p className="text-center text-sm text-muted-foreground">O escanéalo con la app de tu banco desde otro dispositivo</p>
        <p className="text-sm font-bold">
          Vence en <span className="font-data text-base"><Countdown expiresAt={data.expiresAt} /></span>
        </p>
        <p className="text-xs text-muted-foreground">
          {offline ? (
            <span role="alert" className="font-bold text-no">Sin conexión, reintentando…</span>
          ) : (
            <>Actualizado <Ago at={lastOk} /></>
          )}
        </p>
      </Card>

      <section className="flex flex-col gap-3">
        <p className="text-center text-sm font-bold">¿Ya pagaste? No vuelvas a pagar.</p>
        <Button variant="secondary" size="full" onClick={onClaimPaid} disabled={checking}>
          {checking ? "Consultando pago…" : "Revisar estado del pago"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Este botón solo consulta el estado; no confirma tu pago. Tu pase aparece aquí en cuanto el banco lo confirma.
        </p>
      </section>
    </Shell>
  );
}

function PassBody({
  token,
  qr,
  event,
  holder,
  calendar,
}: {
  token: string;
  qr: string | null;
  event: EventInfo;
  holder: string;
  calendar: { icsUrl: string; googleUrl: string } | null;
}) {
  const codeRef = useRef<HTMLSpanElement>(null);
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

  async function downloadPass() {
    if (!qr) return;
    try {
      const img = await composePassImage(qr, { eventName: event.name, date: event.date, venue: event.venue, holder, code: token });
      await download(img, "pase-entrada.png");
    } catch {
      await download(qr, "pase-entrada.png");
    }
  }

  const meta = [event.date, event.venue].filter(Boolean).join(" · ");
  return (
    <>
      <Ticket
        eyebrow="Pase de entrada"
        title={event.name}
        meta={meta || undefined}
        holder={holder}
        code={<span ref={codeRef} className="select-all break-all">{token}</span>}
      >
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR de tu pase de entrada" className="size-56 max-w-full" />
        ) : (
          <div className="size-56" />
        )}
      </Ticket>
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="full" disabled={!qr} onClick={downloadPass}>
          <Download /> Descargar pase
        </Button>
        <Button variant="secondary" size="full" onClick={copy}>
          <Copy /> Copiar código
        </Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {copied === "ok" && (
          <span className="inline-flex items-center gap-1 font-bold text-ok"><Check className="size-4" aria-hidden /> Código copiado.</span>
        )}
        {copied === "fail" && "No pudimos copiar. Mantén presionado el código para copiarlo."}
      </p>
      {calendar && (
        <div className="flex flex-col gap-3">
          <a
            href={calendar.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary", size: "full" })}
          >
            <CalendarPlus /> Agregar a Google Calendar
          </a>
          <a href={calendar.icsUrl} className={buttonVariants({ variant: "secondary", size: "full" })}>
            <CalendarPlus /> Agregar al calendario (iPhone/Outlook)
          </a>
        </div>
      )}
      <p className="rounded-[14px] bg-wait-soft p-3 text-sm font-bold text-wait">
        No compartas este pase: solo permite una entrada.
      </p>
      <p className="text-sm text-muted-foreground">Muestra este QR en la entrada. Guarda esta página: es tu entrada.</p>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-6 px-6 py-6">
      <Logo />
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
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={`/e/${slug}`} className={buttonVariants({ variant, size: "full" })}>
      {label}
    </Link>
  );
}
