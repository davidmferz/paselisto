import { describe, expect, it } from "vitest";
import { parsePriceToCents, slugify, validateNewEvent, zonedMexicoCityToUtc } from "./domain";

const NOW = new Date("2026-11-14T12:00:00Z");
const valid = {
  name: "Taller de cerámica",
  description: "Aprende a tornear",
  date: "2026-12-05",
  time: "11:00",
  venue: "Estudio Barro Vivo, Roma Norte",
  price: "350",
  capacity: "20",
  contactEmail: "hola@barro.mx",
};

describe("zonedMexicoCityToUtc", () => {
  it("interprets wall time in America/Mexico_City (UTC-6, no DST)", () => {
    expect(zonedMexicoCityToUtc("2026-12-05", "11:00")?.toISOString()).toBe("2026-12-05T17:00:00.000Z");
    expect(zonedMexicoCityToUtc("2026-07-05", "11:00")?.toISOString()).toBe("2026-07-05T17:00:00.000Z");
  });
  it("rejects impossible dates / times", () => {
    expect(zonedMexicoCityToUtc("2026-02-30", "11:00")).toBeNull();
    expect(zonedMexicoCityToUtc("2026-12-05", "25:00")).toBeNull();
    expect(zonedMexicoCityToUtc("05/12/2026", "11:00")).toBeNull();
  });
});

describe("parsePriceToCents", () => {
  it.each([
    ["350", 35000],
    ["350.5", 35050],
    ["350.50", 35050],
    ["0.01", 1],
    [" 1000000 ", 100_000_000],
  ])("%s -> %i", (s, c) => expect(parsePriceToCents(s)).toBe(c));
  it.each(["", "0", "0.00", "-5", "1.234", "abc", "1e3", "1000000.01", "1,5", "10."])("rejects %s", (s) =>
    expect(parsePriceToCents(s)).toBeNull(),
  );
  it("is exact (no float drift)", () => {
    expect(parsePriceToCents("19.99")).toBe(1999);
    expect(parsePriceToCents("0.29")).toBe(29);
  });
});

describe("slugify", () => {
  it("lowercases, strips accents, hyphenates", () => {
    expect(slugify("  Taller de Cerámica & Café ¡Hoy! ")).toBe("taller-de-ceramica-cafe-hoy");
  });
  it("caps at 48 chars without trailing hyphen", () => {
    const s = slugify("a".repeat(30) + " " + "b".repeat(30));
    expect(s.length).toBeLessThanOrEqual(48);
    expect(s.endsWith("-")).toBe(false);
  });
  it("returns empty for no usable chars", () => expect(slugify("¡¡¡")).toBe(""));
});

describe("validateNewEvent", () => {
  it("accepts a valid input and normalizes it", () => {
    const r = validateNewEvent(valid, NOW);
    expect(r).toEqual({
      ok: true,
      value: {
        name: "Taller de cerámica",
        description: "Aprende a tornear",
        startsAt: new Date("2026-12-05T17:00:00Z"),
        venue: "Estudio Barro Vivo, Roma Norte",
        priceCents: 35000,
        capacity: 20,
        contactEmail: "hola@barro.mx",
        slug: "taller-de-ceramica",
      },
    });
  });
  it("accepts numeric capacity and empty description", () => {
    const r = validateNewEvent({ ...valid, capacity: 20, description: "" }, NOW);
    expect(r.ok && r.value.capacity).toBe(20);
    expect(r.ok && r.value.description).toBeNull();
  });
  it("uses an explicit valid slug, rejects an invalid one", () => {
    const ok = validateNewEvent({ ...valid, slug: "mi-taller" }, NOW);
    expect(ok.ok && ok.value.slug).toBe("mi-taller");
    const bad = validateNewEvent({ ...valid, slug: "Mi Taller!" }, NOW);
    expect(!bad.ok && bad.errors.slug).toBeTruthy();
  });
  it("reports per-field errors", () => {
    const r = validateNewEvent(
      { name: "ab", description: "x".repeat(281), date: "2026-11-01", time: "10:00", venue: "ab", price: "1.234", capacity: "501", contactEmail: "nope" },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["capacity", "contactEmail", "date", "description", "name", "price", "venue"]);
  });
  it("rejects name > 80, venue > 120, capacity 0 / 1.5", () => {
    const r = validateNewEvent({ ...valid, name: "n".repeat(81), venue: "v".repeat(121), capacity: "0" }, NOW);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["capacity", "name", "venue"]);
    const r2 = validateNewEvent({ ...valid, capacity: "1.5" }, NOW);
    expect(!r2.ok && r2.errors.capacity).toBeTruthy();
  });
  it("accepts boundary capacity 1 and 500 and name 3 / 80", () => {
    expect(validateNewEvent({ ...valid, capacity: "1", name: "abc" }, NOW).ok).toBe(true);
    expect(validateNewEvent({ ...valid, capacity: "500", name: "n".repeat(80) }, NOW).ok).toBe(true);
  });
  it("date must be in the future (in CDMX time)", () => {
    // 2026-11-14T12:00Z == 06:00 CDMX
    expect(validateNewEvent({ ...valid, date: "2026-11-14", time: "05:59" }, NOW).ok).toBe(false);
    expect(validateNewEvent({ ...valid, date: "2026-11-14", time: "06:01" }, NOW).ok).toBe(true);
  });
  it("rejects non-object / non-string inputs gracefully", () => {
    const r = validateNewEvent({ name: 5, description: null, date: undefined } as never, NOW);
    expect(r.ok).toBe(false);
  });
});
