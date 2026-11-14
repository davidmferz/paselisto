import type { Clock, OrdersRepo, RedeemResult } from "@/shared/ports";
import { normalizeToken } from "./domain";

/** Malformed tokens never reach the DB and are reported as NOT_FOUND (no error leak, PC-R4). */
export async function redeemToken(repo: OrdersRepo, clock: Clock, raw: string): Promise<RedeemResult> {
  const token = normalizeToken(raw);
  if (!token) return { kind: "NOT_FOUND" };
  return repo.redeem(token, clock.now());
}
