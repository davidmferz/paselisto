"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialScan, scanReducer, type ScanOutcome } from "@/features/checkin/scan-state";

// Fixed (non-themed) backgrounds so white text keeps >= 4.5:1 in light and dark mode.
type ResultView = { bg: string; title: string; sub?: string; icon: React.ReactNode; retry?: boolean };

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false });
}

function view(o: ScanOutcome): ResultView {
  switch (o.kind) {
    case "OK":
      return { bg: "bg-[#0B7A4B]", title: "Acceso permitido", sub: o.buyer, icon: <Check className="size-16" aria-hidden /> };
    case "ALREADY_USED":
      return { bg: "bg-[#B42318]", title: "Pase ya utilizado", sub: `Ingresó a las ${timeLabel(o.usedAt)}`, icon: <X className="size-16" aria-hidden /> };
    case "NOT_PAID":
      return { bg: "bg-[#B42318]", title: "Pago no confirmado", sub: "No se registró entrada", icon: <X className="size-16" aria-hidden /> };
    case "WRONG_EVENT":
      return {
        bg: "bg-[#9A5B00]",
        title: "Otro taller",
        sub: `Válido para «${o.eventName}»${o.startsAt ? ` (${new Date(o.startsAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` : ""} · No se registró entrada`,
        icon: <TriangleAlert className="size-16" aria-hidden />,
      };
    case "NOT_FOUND":
      return { bg: "bg-[#B42318]", title: "No existe", sub: "Código no encontrado", icon: <X className="size-16" aria-hidden /> };
    default:
      return { bg: "bg-[#334155]", title: "No pudimos verificar", sub: "El pase NO se marcó como usado", icon: <WifiOff className="size-16" aria-hidden />, retry: true };
  }
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mango focus-visible:ring-offset-2";

export function Scanner({ eventId, eventSlug }: { eventId: string; eventSlug: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<"idle" | "validating" | "result">("idle");
  const lastToken = useRef("");
  const [state, dispatch] = useReducer(scanReducer, initialScan);
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState<"starting" | "on" | "denied" | "off">("starting");
  const [cameraTry, setCameraTry] = useState(0);
  const [entered, setEntered] = useState<{ n: number; of: number } | null>(null);

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders?event=${encodeURIComponent(eventSlug)}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { counters: { entered: number; sold: number } };
      setEntered({ n: d.counters.entered, of: d.counters.sold });
    } catch {
      /* counts are decorative */
    }
  }, [eventSlug]);

  useEffect(() => {
    const t = setTimeout(() => void loadCounts(), 0);
    return () => clearTimeout(t);
  }, [loadCounts]);

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const redeem = useCallback(
    async (token: string, fromManual = false) => {
      const t = token.trim();
      // Frozen/in-flight: ignore camera frames and duplicate submits.
      if (phaseRef.current !== "idle" || !t) return;
      phaseRef.current = "validating";
      lastToken.current = t;
      dispatch({ type: "submit" });
      try {
        const res = await fetch("/api/admin/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t, eventId }),
        });
        if (res.status === 401) {
          dispatch({ type: "abort" });
          return router.replace("/admin/login");
        }
        const outcome: ScanOutcome = res.ok ? ((await res.json()) as ScanOutcome) : { kind: "ERROR" };
        phaseRef.current = "result";
        dispatch({ type: "resolve", outcome });
        if (outcome.kind === "OK") void loadCounts();
        if (fromManual && outcome.kind !== "ERROR") setCode(""); // keep typed code on error
      } catch {
        phaseRef.current = "result";
        dispatch({ type: "resolve", outcome: { kind: "ERROR" } });
      }
    },
    [router, eventId, loadCounts],
  );

  const next = useCallback(() => {
    phaseRef.current = "idle";
    dispatch({ type: "next" });
  }, []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    setCamera("starting");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera api");
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result) void redeem(result.getText());
        });
        if (cancelled) return controls.stop();
        stop = () => controls.stop();
        setCamera("on");
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (!cancelled) setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "off");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [redeem, cameraTry]);

  const v = state.phase === "result" ? view(state.outcome) : null;
  const announce =
    state.phase === "validating" ? "Validando" : v ? `${v.title}${v.sub ? `. ${v.sub}` : ""}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite" role="status" className="sr-only">{announce}</div>

      {entered && (
        <p className="text-sm text-muted-foreground">
          Ingresaron <span className="font-data font-bold text-ink">{entered.n}</span> de <span className="font-data font-bold text-ink">{entered.of}</span>
        </p>
      )}

      {state.phase === "validating" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#334155] p-6 text-center text-white">
          <span className="text-h1">Validando…</span>
        </div>
      )}

      {v && (
        <div className={`${v.bg} fixed inset-0 z-50 flex flex-col items-center justify-between gap-6 p-6 text-center text-white`}>
          <p className="text-label self-start opacity-90">
            Escaneando{entered ? ` · Ingresaron ${entered.n} de ${entered.of}` : ""}
          </p>
          <div className="flex flex-col items-center gap-4">
            <span className="flex size-28 items-center justify-center rounded-full bg-white/20">{v.icon}</span>
            <h2 className="text-display">{v.title}</h2>
            {v.sub && <p className="text-lg font-medium">{v.sub}</p>}
          </div>
          <div className="flex w-full max-w-[430px] flex-col gap-3">
            {v.retry && (
              <button
                type="button"
                className={`h-14 w-full rounded-[14px] border-[1.5px] border-white text-base font-bold text-white ${FOCUS}`}
                onClick={() => {
                  const t = lastToken.current;
                  next();
                  void redeem(t, true);
                }}
              >
                Reintentar verificación
              </button>
            )}
            <button
              type="button"
              onClick={next}
              autoFocus
              className={`h-14 w-full rounded-[14px] bg-white text-lg font-bold text-[#12142B] ${FOCUS}`}
            >
              Escanear siguiente
            </button>
            <Link
              href={`/admin?event=${encodeURIComponent(eventSlug)}`}
              className={`flex h-14 w-full items-center justify-center rounded-[14px] border-[1.5px] border-white text-base font-bold text-white ${FOCUS}`}
            >
              Panel
            </Link>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[24px] bg-black">
        <video ref={videoRef} muted playsInline className={camera === "on" ? "aspect-square w-full object-cover" : "hidden"} />
        {camera !== "on" && (
          <div className="flex flex-col items-center gap-3 p-6 text-center text-white">
            <p className="text-base">
              {camera === "starting" && "Iniciando cámara..."}
              {camera === "denied" && "No tenemos permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a intentar, o usa el código manual."}
              {camera === "off" && "Cámara no disponible. Usa el código manual."}
            </p>
            {camera !== "starting" && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setCameraTry((n) => n + 1)}>
                Reintentar cámara
              </Button>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void redeem(code, true);
        }}
        className="flex flex-col gap-2"
      >
        <label className="text-sm font-bold" htmlFor="code">Código manual</label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Pega o escribe el código del pase"
        />
        <Button type="submit" variant="primary" size="full" disabled={!code.trim() || state.phase !== "idle"}>
          {state.phase === "validating" ? "Validando…" : "Validar"}
        </Button>
      </form>
    </div>
  );
}
