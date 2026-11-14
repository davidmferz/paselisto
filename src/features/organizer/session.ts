import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function signSession(secret: string, now: Date): string {
  const payload = `v1.${now.getTime() + SESSION_TTL_MS}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifySession(secret: string, cookie: string | undefined, now: Date): boolean {
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [v, exp, sig] = parts;
  if (!safeEqual(sig, sign(secret, `${v}.${exp}`))) return false;
  const expMs = Number(exp);
  return Number.isFinite(expMs) && now.getTime() <= expMs;
}

/** Constant-time password compare (hashes first so length does not leak). */
export function passwordMatches(input: string, expected: string): boolean {
  const h = (s: string) => createHmac("sha256", "pw").update(s).digest();
  return timingSafeEqual(h(input), h(expected)) && input.length > 0;
}
