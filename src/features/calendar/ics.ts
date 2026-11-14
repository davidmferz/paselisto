/** RFC 5545 calendar generation. Pure: no I/O, no globals except the optional `now`. */

export type CalendarEvent = {
  slug: string;
  name: string;
  venue?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
};

export type CalendarOrder = { id: string; passToken: string; passUrl: string };

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
const encoder = new TextEncoder();

/** 20261121T170000Z */
function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function endOf(e: CalendarEvent): Date {
  return e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_DURATION_MS);
}

/** TEXT escaping per RFC 5545 3.3.11. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold to <= 75 octets per line (continuations start with one space), never splitting a code point. */
function fold(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = encoder.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74; // leading space counts toward the 75 octets
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function details(order: CalendarOrder): string {
  return `Tu pase: ${order.passUrl}\nCódigo manual: ${order.passToken}`;
}

export function buildIcs(event: CalendarEvent, order: CalendarOrder, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PaseListo//Pase de entrada//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${order.id}@paselisto`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(event.startsAt)}`,
    `DTEND:${utc(endOf(event))}`,
    `SUMMARY:${escapeText(event.name)}`,
    ...(event.venue ? [`LOCATION:${escapeText(event.venue)}`] : []),
    `DESCRIPTION:${escapeText(details(order))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(event: CalendarEvent, order: CalendarOrder): string {
  const q = (v: string) => encodeURIComponent(v);
  const parts = [
    "action=TEMPLATE",
    `text=${q(event.name)}`,
    `dates=${utc(event.startsAt)}/${utc(endOf(event))}`,
    ...(event.venue ? [`location=${q(event.venue)}`] : []),
    `details=${q(details(order))}`,
  ];
  return `https://calendar.google.com/calendar/render?${parts.join("&")}`;
}

/** Links exposed by GET /api/orders/[id] once the order is paid. */
export function calendarLinks(
  event: CalendarEvent,
  order: { id: string; passToken: string },
  appUrl: string,
): { icsUrl: string; googleUrl: string } {
  const passUrl = `${appUrl.replace(/\/+$/, "")}/order/${order.id}`;
  return {
    icsUrl: `/api/orders/${order.id}/calendar`,
    googleUrl: googleCalendarUrl(event, { ...order, passUrl }),
  };
}
