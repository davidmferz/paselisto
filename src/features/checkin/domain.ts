import type { Order, Pass, RedeemResult } from "@/shared/ports";

/** Maps the outcome of an atomic redeem UPDATE + follow-up lookup to a RedeemResult. */
export function mapRedeem(i: { redeemed: boolean; pass: Pass | null; order: Order | null }): RedeemResult {
  if (!i.pass || !i.order) return { kind: "NOT_FOUND" };
  if (i.order.status !== "paid") return { kind: "NOT_PAID" };
  if (i.redeemed) return { kind: "OK", buyer: i.order.buyerName };
  return { kind: "ALREADY_USED", usedAt: i.pass.usedAt as Date };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Returns trimmed token or null if malformed (no error leak). */
export function normalizeToken(raw: string): string | null {
  const t = raw.trim();
  return TOKEN_RE.test(t) ? t : null;
}
