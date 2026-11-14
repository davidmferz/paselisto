export function agoLabel(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  if (s < 5) return "Actualizado ahora";
  if (s < 60) return `Actualizado hace ${s} s`;
  return `Actualizado hace ${Math.floor(s / 60)} min`;
}

const REASONS: Record<string, { title: string; hint: string }> = {
  amount: { title: "Monto diferente", hint: "Verifica el pago en tu banco antes de dar acceso." },
  late: { title: "Pago fuera de plazo", hint: "El pago llegó después de que expiró la orden. Confirma con el comprador." },
  capacity: { title: "Sin cupo", hint: "Ya no quedaban lugares. Reembolsa o resuelve con el comprador." },
};

export function reviewReasonView(reason: string | null | undefined): { title: string; hint: string } {
  return (reason && REASONS[reason]) || { title: "Requiere revisión", hint: "Revisa esta orden manualmente antes de dar acceso." };
}

export function confirmedViaLabel(via: string | null | undefined): string | null {
  if (via === "webhook") return "Confirmado por pey · webhook";
  if (via === "poll") return "Confirmado por pey · consulta";
  return null;
}
