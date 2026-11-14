import { describe, expect, it } from "vitest";
import { passwordMatches, signSession, verifySession, SESSION_TTL_MS } from "@/features/organizer/session";

const secret = "s3cret";
const t0 = new Date("2026-01-01T00:00:00Z");

describe("session (PC-S1, PC-S2)", () => {
  it("signs v1.<exp>.<sig> and verifies", () => {
    const c = signSession(secret, t0);
    expect(c).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]+$/);
    expect(verifySession(secret, c, t0)).toBe(true);
  });
  it("rejects after expiry (12h)", () => {
    const c = signSession(secret, t0);
    expect(verifySession(secret, c, new Date(t0.getTime() + SESSION_TTL_MS - 1))).toBe(true);
    expect(verifySession(secret, c, new Date(t0.getTime() + SESSION_TTL_MS + 1))).toBe(false);
  });
  it("rejects tampered signature", () => {
    const c = signSession(secret, t0);
    const bad = c.slice(0, -1) + (c.endsWith("A") ? "B" : "A");
    expect(verifySession(secret, bad, t0)).toBe(false);
  });
  it("rejects tampered expiry", () => {
    const [v, exp, sig] = signSession(secret, t0).split(".");
    expect(verifySession(secret, `${v}.${Number(exp) + 999999999}.${sig}`, t0)).toBe(false);
  });
  it("rejects wrong secret, malformed, empty, undefined", () => {
    const c = signSession(secret, t0);
    expect(verifySession("other", c, t0)).toBe(false);
    expect(verifySession(secret, "garbage", t0)).toBe(false);
    expect(verifySession(secret, "", t0)).toBe(false);
    expect(verifySession(secret, undefined, t0)).toBe(false);
    expect(verifySession(secret, "v1.x.y.z", t0)).toBe(false);
  });
  it("passwordMatches is constant-time safe for differing lengths", () => {
    expect(passwordMatches("abc", "abc")).toBe(true);
    expect(passwordMatches("abc", "abd")).toBe(false);
    expect(passwordMatches("abc", "abcd")).toBe(false);
    expect(passwordMatches("", "abc")).toBe(false);
  });
});
