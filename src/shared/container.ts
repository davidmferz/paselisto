import { systemClock } from "@/shared/adapters/clock";
import { createNeonRepo } from "@/shared/adapters/neon-repo";
import { getConfig } from "@/shared/config";
import { createPeyClient } from "@/shared/adapters/pey-client";
import type { Clock, OrdersRepo, PeyClient } from "@/shared/ports";

/** Composition root helpers for route handlers (keeps routes thin and adapter-agnostic). */
export function getRepo(): OrdersRepo {
  return createNeonRepo(getConfig().databaseUrl);
}

export function getClock(): Clock {
  return systemClock;
}

export function getPey(): PeyClient {
  const { pey } = getConfig();
  return createPeyClient({ apiKey: pey.apiKey, baseUrl: pey.baseUrl });
}

/** Buyer-flow dependencies (checkout use-cases). */
export function getCheckoutDeps(): { repo: OrdersRepo; pey: PeyClient; clock: Clock } {
  return { repo: getRepo(), pey: getPey(), clock: getClock() };
}
