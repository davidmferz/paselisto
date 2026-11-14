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
