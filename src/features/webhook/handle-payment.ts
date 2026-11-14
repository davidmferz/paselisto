import { randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { decide } from "./domain";
import { toCents } from "@/shared/money";
import { generateToken } from "@/shared/token";
import type { Clock, OrdersRepo } from "@/shared/ports";

export type ApplyResult =
  | { kind: "duplicate" }
  | { kind: "unknown_order" }
  | { kind: "noop" }
  | { kind: "paid"; orderId: string }
  | { kind: "review"; reason: "amount" | "late" | "capacity" };

export type ApplyInput = {
  /** Present for webhooks (dedupe key); absent for the polling fallback. */
  webhookId?: string;
  type: string;
  payload: unknown;
  orderId?: string;
  peyQrId?: string;
  amountCents: number;
  transactionId?: string;
  paidAt?: Date;
  /** Who confirmed the payment; persisted only on the pending -> paid/review transition. */
  source: "webhook" | "poll";
};

/**
 * Idempotent payment application, shared by the webhook and the polling fallback.
 * One locked transaction: dedupe -> decide (pure) -> paid+pass | review | noop.
 * Any throw rolls back everything (including the dedupe row) so pey can retry.
 */
export async function applyPayment(
  deps: { repo: OrdersRepo; clock: Clock; onPaid?: (orderId: string) => Promise<void> },
  i: ApplyInput,
): Promise<ApplyResult> {
  const result = await applyPaymentTx(deps, i);
  // Strictly AFTER commit; a failing side effect (e.g. email) must never undo or fail the payment.
  if (result.kind === "paid" && deps.onPaid) {
    try {
      await deps.onPaid(result.orderId);
    } catch (err) {
      console.error("onPaid hook failed", err instanceof Error ? err.message : err);
    }
  }
  return result;
}

async function applyPaymentTx(
  deps: { repo: OrdersRepo; clock: Clock },
  i: ApplyInput,
): Promise<ApplyResult> {
  const found = await deps.repo.findOrder({ orderId: i.orderId, peyQrId: i.peyQrId });
  if (!found) return { kind: "unknown_order" };

  return deps.repo.withEventLock(found.eventId, async (tx) => {
    if (i.webhookId && !(await tx.recordWebhook(i.webhookId, i.type, i.payload))) {
      return { kind: "duplicate" } as const;
    }
    const order = await tx.getOrder(found.id);
    const event = await tx.getEvent(found.eventId);
    if (!order || !event) return { kind: "unknown_order" } as const;

    const now = deps.clock.now();
    const decision = decide({
      order,
      amountCents: i.amountCents,
      paidCount: await tx.countPaid(order.eventId),
      capacity: event.capacity,
      now,
    });

    if (decision.kind === "paid") {
      await tx.updateOrder(order.id, {
        status: "paid",
        paidAt: i.paidAt ?? now,
        peyTransactionId: i.transactionId ?? null,
        confirmedVia: i.source,
      });
      await tx.insertPass({ id: randomUUID(), orderId: order.id, token: generateToken(), usedAt: null });
      return { kind: "paid", orderId: order.id } as const;
    }
    if (decision.kind === "review") {
      await tx.updateOrder(order.id, { status: "review", reviewReason: decision.reason, confirmedVia: i.source });
      return { kind: "review", reason: decision.reason } as const;
    }
    return { kind: "noop" } as const;
  });
}

export type WebhookResponse = { status: number; body: string };

type PeyQrPayload = {
  type?: unknown;
  amount?: unknown;
  codiQrId?: unknown;
  transactionId?: unknown;
  datePaid?: unknown;
  metadata?: { externalMetadata?: { orderId?: unknown } };
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export async function handlePeyWebhook(i: {
  raw: string;
  headers: Headers;
  secret: string;
  repo: OrdersRepo;
  clock: Clock;
  onPaid?: (orderId: string) => Promise<void>;
  log?: (msg: string, data?: unknown) => void;
}): Promise<WebhookResponse> {
  const log = i.log ?? ((m, d) => console.log(m, d ?? ""));
  // Header NAMES only: signature header names are unconfirmed; never log values.
  log("pey webhook headers", { names: [...i.headers.keys()] });

  let webhookId: string;
  try {
    new Webhook(i.secret).verify(i.raw, Object.fromEntries(i.headers.entries()), {
      jsonParse: false,
    });
    webhookId = i.headers.get("webhook-id")!;
  } catch {
    return { status: 401, body: "invalid signature" };
  }

  let body: PeyQrPayload;
  try {
    body = JSON.parse(i.raw);
    if (typeof body !== "object" || body === null) throw new Error("not an object");
  } catch {
    return { status: 400, body: "malformed json" };
  }

  const type = str(body.type) ?? "";
  // codi.pn.* is handled only when door-sale is enabled (not yet): ack and ignore.
  if (type !== "codi.qr.payment_received") {
    log("pey webhook ignored", { type });
    return { status: 200, body: "ignored" };
  }
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount)) {
    return { status: 400, body: "invalid amount" };
  }

  try {
    const result = await applyPayment(
      { repo: i.repo, clock: i.clock, onPaid: i.onPaid },
      {
        webhookId,
        source: "webhook",
        type,
        payload: body,
        orderId: str(body.metadata?.externalMetadata?.orderId),
        peyQrId: str(body.codiQrId),
        amountCents: toCents(body.amount),
        transactionId: str(body.transactionId),
        paidAt: typeof body.datePaid === "number" ? new Date(body.datePaid * 1000) : undefined,
      },
    );
    log("pey webhook applied", { result: result.kind });
    return { status: 200, body: result.kind };
  } catch (err) {
    log("pey webhook internal error", { error: err instanceof Error ? err.message : String(err) });
    return { status: 500, body: "internal error" };
  }
}
