import { describe, expect, it } from "vitest";
import { isAuthorized } from "@/features/organizer/auth-guard";
import { signSession, SESSION_TTL_MS } from "@/features/organizer/session";

const secret = "s3cret";
const t0 = new Date("2026-01-01T00:00:00Z");

describe("auth guard (PC-S1)", () => {
  it("denies missing cookie", () => {
    expect(isAuthorized(undefined, secret, t0)).toBe(false);
  });
  it("denies tampered cookie", () => {
    expect(isAuthorized(signSession(secret, t0) + "x", secret, t0)).toBe(false);
  });
  it("denies cookie signed with another secret", () => {
    expect(isAuthorized(signSession("other", t0), secret, t0)).toBe(false);
  });
  it("denies expired cookie", () => {
    const c = signSession(secret, t0);
    expect(isAuthorized(c, secret, new Date(t0.getTime() + SESSION_TTL_MS + 1))).toBe(false);
  });
  it("allows valid cookie", () => {
    expect(isAuthorized(signSession(secret, t0), secret, t0)).toBe(true);
  });
});
