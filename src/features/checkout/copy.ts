/** Short human-readable order reference (first 8 chars of the uuid). */
export function shortRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

/** "hace 4 s" / "hace 2 min" for the "Última actualización" label. */
export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
}

export type BuyerFieldErrors = { name?: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side per-field validation (server stays the source of truth). */
export function validateBuyerFields(i: { name: string; email: string }): BuyerFieldErrors {
  const errors: BuyerFieldErrors = {};
  if (!i.name.trim()) errors.name = "Escribe tu nombre completo";
  if (!EMAIL_RE.test(i.email.trim())) errors.email = "Escribe un correo válido, por ejemplo nombre@correo.com";
  return errors;
}
