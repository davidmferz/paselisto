import { describe, expect, it } from "vitest";
import { buildIcs, calendarLinks, googleCalendarUrl } from "./ics";

const event = {
  slug: "taller-demo",
  name: "Taller de cerámica, nivel 1; demo",
  venue: "Estudio Barro Vivo, Roma Norte, CDMX",
  startsAt: new Date("2026-11-21T17:00:00Z"),
};
const order = { id: "11111111-2222-4333-8444-555555555555", passToken: "TOKEN_abc-123456789012", passUrl: "https://app.mx/order/11111111-2222-4333-8444-555555555555" };
const NOW = new Date("2026-11-14T12:00:00Z");

describe("buildIcs", () => {
  const ics = buildIcs(event, order, NOW);
  const lines = ics.split("\r\n");
  const unfolded = ics.replace(/\r\n /g, "");

  it("is a CRLF VCALENDAR with one VEVENT", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.includes("\n") && ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(unfolded).toContain("VERSION:2.0");
    expect(unfolded).toContain("PRODID:");
    expect(unfolded).toContain("BEGIN:VEVENT");
    expect(unfolded).toContain("END:VEVENT");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
  });

  it("uses UTC dates, default 2h duration, UID and DTSTAMP", () => {
    expect(unfolded).toContain("UID:11111111-2222-4333-8444-555555555555@paselisto");
    expect(unfolded).toContain("DTSTAMP:20261114T120000Z");
    expect(unfolded).toContain("DTSTART:20261121T170000Z");
    expect(unfolded).toContain("DTEND:20261121T190000Z");
  });

  it("honors an explicit end", () => {
    const out = buildIcs({ ...event, endsAt: new Date("2026-11-21T20:30:00Z") }, order, NOW);
    expect(out).toContain("DTEND:20261121T203000Z");
  });

  it("escapes commas, semicolons, backslashes and newlines in text values", () => {
    expect(unfolded).toContain("SUMMARY:Taller de cerámica\\, nivel 1\; demo");
    expect(unfolded).toContain("LOCATION:Estudio Barro Vivo\\, Roma Norte\\, CDMX");
    expect(unfolded).toContain("DESCRIPTION:Tu pase: https://app.mx/order/");
    expect(unfolded).toContain("\\nCódigo manual: TOKEN_abc-123456789012");
    expect(buildIcs({ ...event, name: "a\\b" }, order, NOW)).toContain("SUMMARY:a\\\\b");
  });

  it("folds lines longer than 75 octets (UTF-8) without splitting characters", () => {
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    const long = buildIcs({ ...event, name: "ñ".repeat(120) }, order, NOW);
    for (const l of long.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(long.replace(/\r\n /g, "")).toContain("SUMMARY:" + "ñ".repeat(120));
    expect(long).not.toContain("�");
  });

  it("omits LOCATION when venue is unknown", () => {
    expect(buildIcs({ ...event, venue: null }, order, NOW)).not.toContain("LOCATION");
  });
});

describe("googleCalendarUrl", () => {
  const url = new URL(googleCalendarUrl(event, order));
  it("targets the TEMPLATE action with UTC dates", () => {
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261121T170000Z/20261121T190000Z");
    expect(url.searchParams.get("text")).toBe(event.name);
    expect(url.searchParams.get("location")).toBe(event.venue);
    expect(url.searchParams.get("details")).toContain(order.passUrl);
    expect(url.searchParams.get("details")).toContain(order.passToken);
  });
});

describe("calendarLinks", () => {
  it("builds icsUrl and googleUrl", () => {
    const l = calendarLinks(event, { id: order.id, passToken: order.passToken }, "https://app.mx");
    expect(l.icsUrl).toBe(`/api/orders/${order.id}/calendar`);
    expect(l.googleUrl).toContain("calendar.google.com");
    expect(decodeURIComponent(l.googleUrl)).toContain(`https://app.mx/order/${order.id}`);
  });
});
