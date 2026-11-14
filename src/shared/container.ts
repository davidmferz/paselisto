import { systemClock } from "@/shared/adapters/clock";
import { createNeonRepo } from "@/shared/adapters/neon-repo";
import { getConfig } from "@/shared/config";
import { createPeyClient } from "@/shared/adapters/pey-client";
import { createMailer } from "@/shared/adapters/resend-mailer";
import { sendPassEmailForOrder } from "@/features/email/send-pass-email";
import type { Clock, Mailer, OrdersRepo, PeyClient } from "@/shared/ports";

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

let mailer: Mailer | undefined;
export function getMailer(): Mailer {
  return (mailer ??= createMailer(process.env));
}

/** Post-commit hook for pending -> paid: sends the pass email (never throws). */
export function getOnPaid(repo: OrdersRepo = getRepo()): (orderId: string) => Promise<void> {
  return async (orderId) => {
    await sendPassEmailForOrder({ repo, mailer: getMailer(), appUrl: getConfig().appUrl }, orderId);
  };
}

/** Buyer-flow dependencies (checkout use-cases). */
export function getCheckoutDeps(): { repo: OrdersRepo; pey: PeyClient; clock: Clock; onPaid: (orderId: string) => Promise<void> } {
  const repo = getRepo();
  return { repo, pey: getPey(), clock: getClock(), onPaid: getOnPaid(repo) };
}
