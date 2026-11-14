export const EVENT_TZ = "America/Mexico_City";
export const SLUG_MAX = 48;
export const MAX_PRICE_CENTS = 100_000_000; // $1,000,000.00 MXN

export type NewEventInput = {
  name: unknown;
  description?: unknown;
  /** YYYY-MM-DD, interpreted in America/Mexico_City */
  date: unknown;
  /** HH:mm (24h), interpreted in America/Mexico_City */
  time: unknown;
  venue: unknown;
  /** MXN as a decimal string, e.g. "350" or "350.50" */
  price: unknown;
  capacity: unknown;
  contactEmail: unknown;
  /** Optional organizer-edited slug; defaults to slugify(name). */
  slug?: unknown;
};

export type NewEventValue = {
  name: string;
  description: string | null;
  startsAt: Date;
  venue: string;
  priceCents: number;
  capacity: number;
  contactEmail: string;
  slug: string;
};

export type EventField = "name" | "description" | "date" | "time" | "venue" | "price" | "capacity" | "contactEmail" | "slug";
export type NewEventResult = { ok: true; value: NewEventValue } | { ok: false; errors: Partial<Record<EventField, string>> };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Offset (ms) of `tz` from UTC at the instant `utcMs` (positive = ahead of UTC). */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock date+time in America/Mexico_City -> UTC instant; null if malformed or non-existent. */
export function zonedMexicoCityToUtc(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  const probe = new Date(wall);
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== da) return null;
  // Two-pass offset resolution (handles DST zones too; CDMX has been fixed UTC-6 since 2022).
  let utc = wall - tzOffsetMs(wall, EVENT_TZ);
  utc = wall - tzOffsetMs(utc, EVENT_TZ);
  return new Date(utc);
}

/** Exact MXN decimal string -> integer cents. null if malformed, > 2 decimals, <= 0 or > 1,000,000. */
export function parsePriceToCents(raw: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_PRICE_CENTS) return null;
  return cents;
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateNewEvent(input: NewEventInput, now: Date): NewEventResult {
  const errors: Partial<Record<EventField, string>> = {};

  const name = str(input.name);
  if (name.length < 3 || name.length > 80) errors.name = "El nombre debe tener entre 3 y 80 caracteres.";

  const description = str(input.description);
  if (description.length > 280) errors.description = "La descripción puede tener máximo 280 caracteres.";

  const venue = str(input.venue);
  if (venue.length < 3 || venue.length > 120) errors.venue = "El lugar debe tener entre 3 y 120 caracteres.";

  const startsAt = zonedMexicoCityToUtc(str(input.date), str(input.time));
  if (!startsAt) errors.date = "Elige una fecha y hora válidas.";
  else if (startsAt.getTime() <= now.getTime()) errors.date = "La fecha y hora deben ser en el futuro.";

  const priceCents = parsePriceToCents(typeof input.price === "number" ? String(input.price) : str(input.price));
  if (priceCents === null) errors.price = "Escribe un precio válido en pesos, de $0.01 a $1,000,000, con máximo 2 decimales.";

  const capRaw = typeof input.capacity === "number" ? String(input.capacity) : str(input.capacity);
  const capacity = /^\d+$/.test(capRaw) ? Number(capRaw) : NaN;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) errors.capacity = "El cupo debe ser un número entero de 1 a 500.";

  const contactEmail = str(input.contactEmail);
  if (!EMAIL_RE.test(contactEmail) || contactEmail.length > 254) errors.contactEmail = "Escribe un correo de contacto válido.";

  const slugRaw = str(input.slug);
  let slug = slugRaw;
  if (slugRaw) {
    if (slugRaw.length < 3 || slugRaw.length > SLUG_MAX || !SLUG_RE.test(slugRaw)) {
      errors.slug = "El link solo puede tener minúsculas, números y guiones (3 a 48 caracteres).";
    }
  } else {
    slug = slugify(name);
    if (!errors.name && slug.length < 3) errors.name = "El nombre necesita al menos 3 letras o números.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      description: description || null,
      startsAt: startsAt as Date,
      venue,
      priceCents: priceCents as number,
      capacity,
      contactEmail,
      slug,
    },
  };
}
