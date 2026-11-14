import type { Clock, OrdersRepo, RedeemResult } from "@/shared/ports";
import { normalizeToken } from "./domain";

/**
 * Malformed tokens never reach the DB and are reported as NOT_FOUND (no error leak, PC-R4).
 * `eventId` is the event being scanned: passes of other events are rejected, not consumed.
 */
export async function redeemToken(repo: OrdersRepo, clock: Clock, raw: string, eventId: string): Promise<RedeemResult> {
  const token = normalizeToken(raw);
  if (!token) return { kind: "NOT_FOUND" };
  return repo.redeem(token, eventId, clock.now());
}
