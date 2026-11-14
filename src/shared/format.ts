const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMxn(cents: number): string {
  return mxn.format(cents / 100);
}

const EVENT_TZ = "America/Mexico_City";
const eventDate = new Intl.DateTimeFormat("es-MX", {
  timeZone: EVENT_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
});

/** Human date/time of an event in Mexico City time, e.g. "sábado, 21 de noviembre, 11:00". */
export function formatEventDate(d: Date): string {
  return eventDate.format(d);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parts(d: Date, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("es-MX", { timeZone: EVENT_TZ, ...opts }).formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** "Sábado 21 de noviembre" in Mexico City time. */
export function eventDayLong(d: Date): string {
  const p = parts(d, { weekday: "long", day: "numeric", month: "long" });
  return `${capitalize(p.weekday!)} ${p.day} de ${p.month}`;
}

/** "11:00 h" in Mexico City time. */
export function eventTimeLabel(d: Date): string {
  const p = parts(d, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${p.hour === "24" ? "00" : p.hour}:${p.minute} h`;
}

/** "Sáb 21 nov · 11:00 h · Venue"; omits missing pieces. */
export function eventShortMeta(d: Date | null, venue: string | null): string {
  const out: string[] = [];
  if (d) {
    const p = parts(d, { weekday: "short", day: "numeric", month: "short" });
    out.push(`${capitalize(p.weekday!.replace(".", ""))} ${p.day} ${p.month!.replace(".", "")}`, eventTimeLabel(d));
  }
  if (venue) out.push(venue);
  return out.join(" · ");
}

/** Display-only grouping of a pass code in blocks of 4 ("ABCD·1234·EF"). */
export function groupCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("·") ?? "";
}
