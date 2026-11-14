"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "pending" | "paid" | "review" | "expired";
type OrderData = { status: Status; buyerName: string; expiresAt: string; passToken: string | null };

const POLL_MS = 2500;

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

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const s = Math.floor(left / 1000);
  return (
    <span className="tabular-nums">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

export function OrderView({ orderId, qrString }: { orderId: string; qrString: string | null }) {
  const [data, setData] = useState<OrderData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      if (res.status === 404) return setNotFound(true);
      if (res.ok) setData(await res.json());
    } catch {
      /* transient network error: next tick retries */
    }
  }, [orderId]);

  const terminal = data?.status === "paid" || data?.status === "review" || data?.status === "expired";
  useEffect(() => {
    if (notFound || terminal) return;
    // First fetch via timeout(0) keeps setState out of the effect body.
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [poll, notFound, terminal]);

  const payQr = useQrDataUrl(data?.status === "pending" ? qrString : null, 320);
  const passQr = useQrDataUrl(data?.status === "paid" ? data.passToken : null, 360);

  if (notFound) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Orden no encontrada</h1>
        <p className="text-muted-foreground">Revisá el enlace o volvé a comprar tu entrada.</p>
        <BackLink />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <p className="text-muted-foreground">Cargando...</p>
      </Shell>
    );
  }

  if (data.status === "paid") {
    return (
      <Shell>
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Tu pase</p>
        <h1 className="text-2xl font-bold">¡Pago confirmado, {data.buyerName}!</h1>
        {data.passToken ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {passQr && <img src={passQr} alt="QR de tu pase" className="w-full max-w-xs rounded-xl border bg-white" />}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Código manual</p>
              <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-lg font-semibold select-all">
                {data.passToken}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Mostrá este QR en la entrada. Guardá esta página: es tu entrada.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Generando tu pase...</p>
        )}
      </Shell>
    );
  }

  if (data.status === "review") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Estamos verificando tu pago</h1>
        <p className="text-muted-foreground">
          Recibimos tu pago pero necesitamos revisarlo. Un organizador te va a confirmar en breve; guardá esta
          página y mostrala en la entrada.
        </p>
      </Shell>
    );
  }

  if (data.status === "expired") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">El QR venció</h1>
        <p className="text-muted-foreground">El tiempo para pagar terminó. Podés generar uno nuevo.</p>
        <BackLink label="Volver a intentar" />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Pagá con CoDi</h1>
      <p className="text-muted-foreground">
        Escaneá el QR desde la app de tu banco. Vence en <Countdown expiresAt={data.expiresAt} />
      </p>
      {qrString ? (
        payQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={payQr} alt="QR de pago CoDi" className="w-full max-w-xs rounded-xl border bg-white" />
        ) : (
          <p className="text-muted-foreground">Generando QR...</p>
        )
      ) : (
        <p role="alert" className="rounded-lg bg-muted p-3 text-sm">
          Para ver el QR de pago abrí esta página desde el mismo enlace con el que llegaste, o generá una nueva
          orden.
        </p>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Esperando tu pago...
      </p>
      <Button variant="outline" onClick={poll}>
        Ya pagué
      </Button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 py-8 text-center">{children}</main>;
}

function BackLink({ label = "Volver al evento" }: { label?: string }) {
  return (
    <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
      {label}
    </Link>
  );
}
