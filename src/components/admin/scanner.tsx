"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Outcome =
  | { kind: "OK"; buyer: string }
  | { kind: "ALREADY_USED"; usedAt: string }
  | { kind: "NOT_FOUND" }
  | { kind: "NOT_PAID" }
  | { kind: "ERROR" };

function view(o: Outcome): { bg: string; title: string; sub?: string } {
  switch (o.kind) {
    case "OK":
      return { bg: "bg-green-600", title: "ACCESO OK", sub: o.buyer };
    case "ALREADY_USED":
      return {
        bg: "bg-red-600",
        title: "RECHAZADO: ya usado",
        sub: `Usado a las ${new Date(o.usedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
      };
    case "NOT_PAID":
      return { bg: "bg-red-600", title: "RECHAZADO: pago no confirmado" };
    case "NOT_FOUND":
      return { bg: "bg-red-600", title: "NO EXISTE", sub: "Código no encontrado" };
    default:
      return { bg: "bg-slate-700", title: "ERROR", sub: "Reintentá" };
  }
}

export function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");

  const redeem = useCallback(
    async (token: string) => {
      if (busyRef.current || !token.trim()) return;
      busyRef.current = true;
      try {
        const res = await fetch("/api/admin/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.status === 401) return router.replace("/admin/login");
        setOutcome(res.ok ? ((await res.json()) as Outcome) : { kind: "ERROR" });
      } catch {
        setOutcome({ kind: "ERROR" });
      } finally {
        // brief cool-down so one QR in frame does not fire repeatedly
        setTimeout(() => (busyRef.current = false), 1500);
      }
    },
    [router],
  );

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
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
      } catch {
        if (!cancelled) setCamera("off"); // denied / no camera: manual input still works
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [redeem]);

  const v = outcome ? view(outcome) : null;

  return (
    <div className="flex flex-col gap-4">
      {v && (
        <button
          type="button"
          onClick={() => setOutcome(null)}
          className={`${v.bg} flex min-h-40 w-full flex-col items-center justify-center gap-1 rounded-xl p-4 text-center text-white`}
        >
          <span className="text-3xl font-extrabold leading-tight">{v.title}</span>
          {v.sub && <span className="text-lg">{v.sub}</span>}
          <span className="mt-2 text-xs opacity-80">Tocá para limpiar</span>
        </button>
      )}

      <div className="overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className={camera === "on" ? "aspect-square w-full object-cover" : "hidden"} />
        {camera !== "on" && (
          <p className="p-6 text-center text-sm text-white">
            {camera === "starting" ? "Iniciando cámara..." : "Cámara no disponible. Usá el código manual."}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void redeem(code).then(() => setCode(""));
        }}
        className="flex flex-col gap-2"
      >
        <label className="text-sm font-medium" htmlFor="code">Código manual</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Pegá o escribí el código del pase"
          className="h-12 rounded-md border bg-background px-3 text-base"
        />
        <Button type="submit" size="lg" disabled={!code.trim()}>Validar</Button>
      </form>
    </div>
  );
}
