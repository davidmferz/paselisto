"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { initialScan, scanReducer, type ScanOutcome } from "@/features/checkin/scan-state";

// Backgrounds chosen so white text is >= 4.5:1 (green-800 ~7:1, red-800 ~8:1, slate-800 ~12:1).
function view(o: ScanOutcome): { bg: string; title: string; sub?: string } {
  switch (o.kind) {
    case "OK":
      return { bg: "bg-green-800", title: "ACCESO OK", sub: o.buyer };
    case "ALREADY_USED":
      return {
        bg: "bg-red-800",
        title: "RECHAZADO: ya usado",
        sub: `Usado a las ${new Date(o.usedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
      };
    case "NOT_PAID":
      return { bg: "bg-red-800", title: "RECHAZADO: pago no confirmado" };
    case "NOT_FOUND":
      return { bg: "bg-red-800", title: "NO EXISTE", sub: "Código no encontrado" };
    default:
      return { bg: "bg-slate-800", title: "ERROR", sub: "No se pudo validar. Reintenta." };
  }
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-blue-600";

export function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<"idle" | "validating" | "result">("idle");
  const lastToken = useRef("");
  const [state, dispatch] = useReducer(scanReducer, initialScan);
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState<"starting" | "on" | "denied" | "off">("starting");
  const [cameraTry, setCameraTry] = useState(0);

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
          body: JSON.stringify({ token: t }),
        });
        if (res.status === 401) {
          dispatch({ type: "abort" });
          return router.replace("/admin/login");
        }
        const outcome: ScanOutcome = res.ok ? ((await res.json()) as ScanOutcome) : { kind: "ERROR" };
        phaseRef.current = "result";
        dispatch({ type: "resolve", outcome });
        if (fromManual && outcome.kind !== "ERROR") setCode(""); // keep typed code on error
      } catch {
        phaseRef.current = "result";
        dispatch({ type: "resolve", outcome: { kind: "ERROR" } });
      }
    },
    [router],
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

      {state.phase === "validating" && (
        <div className="flex min-h-40 w-full items-center justify-center rounded-xl bg-slate-800 p-4 text-center text-2xl font-bold text-white">
          Validando…
        </div>
      )}

      {v && (
        <div className={`${v.bg} flex min-h-40 w-full flex-col items-center justify-center gap-1 rounded-xl p-4 text-center text-white`}>
          <span className="text-3xl font-extrabold leading-tight">{v.title}</span>
          {v.sub && <span className="text-lg font-medium">{v.sub}</span>}
        </div>
      )}

      {v && (
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={next} className={`h-14 text-lg ${FOCUS}`} autoFocus>
            Escanear siguiente
          </Button>
          {state.phase === "result" && state.outcome.kind === "ERROR" && (
            <Button
              type="button"
              variant="outline"
              className={`h-12 text-base ${FOCUS}`}
              onClick={() => {
                const t = lastToken.current;
                next();
                void redeem(t, true);
              }}
            >
              Reintentar
            </Button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className={camera === "on" ? "aspect-square w-full object-cover" : "hidden"} />
        {camera !== "on" && (
          <div className="flex flex-col items-center gap-3 p-6 text-center text-white">
            <p className="text-base">
              {camera === "starting" && "Iniciando cámara..."}
              {camera === "denied" && "No tenemos permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a intentar, o usa el código manual."}
              {camera === "off" && "Cámara no disponible. Usa el código manual."}
            </p>
            {camera !== "starting" && (
              <Button type="button" variant="secondary" className={`h-12 px-6 text-base ${FOCUS}`} onClick={() => setCameraTry((n) => n + 1)}>
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
        <label className="text-base font-medium" htmlFor="code">Código manual</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Pega o escribe el código del pase"
          className={`h-12 rounded-md border bg-background px-3 text-base ${FOCUS}`}
        />
        <Button type="submit" className={`h-12 text-base ${FOCUS}`} disabled={!code.trim() || state.phase !== "idle"}>
          {state.phase === "validating" ? "Validando…" : "Validar"}
        </Button>
      </form>
    </div>
  );
}
