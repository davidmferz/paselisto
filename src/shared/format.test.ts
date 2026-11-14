import { describe, expect, it } from "vitest";
import { formatEventDate, formatMxn } from "./format";

describe("formatMxn", () => {
  it("formats cents as MXN", () => {
    expect(formatMxn(15000)).toMatch(/150\.00/);
    expect(formatMxn(1)).toMatch(/0\.01/);
  });
});

describe("formatEventDate", () => {
  it("renders in America/Mexico_City regardless of server tz", () => {
    const out = formatEventDate(new Date("2026-11-21T17:00:00Z")); // 11:00 CST (UTC-6)
    expect(out).toMatch(/21/);
    expect(out).toMatch(/11:00/);
  });
});

import { eventDayLong, eventShortMeta, eventTimeLabel, groupCode } from "./format";

describe("event date helpers (America/Mexico_City)", () => {
  const d = new Date("2026-11-21T17:00:00Z");
  it("long day", () => expect(eventDayLong(d)).toBe("Sábado 21 de noviembre"));
  it("time label", () => expect(eventTimeLabel(d)).toBe("11:00 h"));
  it("short meta with venue", () => expect(eventShortMeta(d, "Casa Roma")).toBe("Sáb 21 nov · 11:00 h · Casa Roma"));
  it("short meta without venue or date", () => {
    expect(eventShortMeta(d, null)).toBe("Sáb 21 nov · 11:00 h");
    expect(eventShortMeta(null, "Casa Roma")).toBe("Casa Roma");
    expect(eventShortMeta(null, null)).toBe("");
  });
  it("uses CDMX day near midnight UTC", () => {
    expect(eventDayLong(new Date("2026-11-22T03:00:00Z"))).toBe("Sábado 21 de noviembre");
  });
});

describe("groupCode", () => {
  it("groups in 4s joined by middle dot", () => {
    expect(groupCode("ABCD1234EF")).toBe("ABCD·1234·EF");
    expect(groupCode("ABCD")).toBe("ABCD");
    expect(groupCode("")).toBe("");
  });
});
