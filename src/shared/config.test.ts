import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

const base = {
  PEY_API_KEY: "k",
  PEY_WEBHOOK_SECRET: "whsec_x",
  DATABASE_URL: "postgres://x",
  ORGANIZER_PASSWORD: "pw",
  SESSION_SECRET: "s".repeat(32),
  EVENT_SLUG: "demo",
  EVENT_NAME: "Demo",
  EVENT_PRICE_CENTS: "1",
  EVENT_CAPACITY: "50",
  APP_URL: "http://localhost:3000",
};

describe("parseConfig", () => {
  it("parses numbers and applies PEY_BASE_URL default", () => {
    const c = parseConfig(base);
    expect(c.event.priceCents).toBe(1);
    expect(c.event.capacity).toBe(50);
    expect(c.pey.baseUrl).toBe("https://api.pey.mx");
    expect(c.event.slug).toBe("demo");
  });

  it("honors PEY_BASE_URL override and other numbers", () => {
    const c = parseConfig({ ...base, PEY_BASE_URL: "https://sandbox", EVENT_PRICE_CENTS: "25000", EVENT_CAPACITY: "3" });
    expect(c.pey.baseUrl).toBe("https://sandbox");
    expect(c.event.priceCents).toBe(25000);
    expect(c.event.capacity).toBe(3);
  });

  it("throws listing every missing required var", () => {
    expect(() => parseConfig({})).toThrow(/PEY_API_KEY[\s\S]*DATABASE_URL/);
  });

  it("rejects non-positive or non-integer price/capacity", () => {
    expect(() => parseConfig({ ...base, EVENT_PRICE_CENTS: "0" })).toThrow(/EVENT_PRICE_CENTS/);
    expect(() => parseConfig({ ...base, EVENT_CAPACITY: "abc" })).toThrow(/EVENT_CAPACITY/);
  });
});
