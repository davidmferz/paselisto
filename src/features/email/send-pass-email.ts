import { renderPassEmail } from "./render";
import type { Mailer, OrdersRepo } from "@/shared/ports";

export type SendPassEmailResult = "sent" | "already_sent" | "skipped" | "not_applicable" | "failed";

type Deps = {
  repo: OrdersRepo;
  mailer: Mailer;
  appUrl: string;
  log?: (msg: string, data?: unknown) => void;
};

/**
 * Sends the pass confirmation email at most once per order. Runs AFTER the payment commit.
 * Atomic claim (email_sent_at) before sending; the claim is released on failure/skip so a later
 * retry can resend. NEVER throws: email problems must not affect the payment.
 */
export async function sendPassEmailForOrder(deps: Deps, orderId: string): Promise<SendPassEmailResult> {
  const log = deps.log ?? ((m: string, d?: unknown) => console.error(m, d ?? ""));
  let claimed = false;
  try {
    const order = await deps.repo.findOrder({ orderId });
    if (!order || order.status !== "paid") return "not_applicable";
    const [pass, event] = await Promise.all([deps.repo.findPassByOrderId(order.id), deps.repo.findEventById(order.eventId)]);
    if (!pass || !event) return "not_applicable";

    if (!(await deps.repo.claimPassEmail(order.id))) return "already_sent";
    claimed = true;

    const { subject, html, text } = renderPassEmail({
      appUrl: deps.appUrl,
      orderId: order.id,
      passToken: pass.token,
      buyerName: order.buyerName,
      eventSlug: event.slug,
      eventName: event.name,
      startsAt: event.startsAt ?? null,
      venue: event.venue ?? null,
      organizerName: event.organizerName ?? null,
      contactEmail: event.contactEmail ?? null,
      amountCents: order.amountCents,
      paidAt: order.paidAt,
    });
    const res = await deps.mailer.sendPassEmail({
      orderId: order.id,
      to: order.buyerEmail,
      ...(event.contactEmail ? { replyTo: event.contactEmail } : {}),
      subject,
      html,
      text,
    });
    if ("skipped" in res) {
      await deps.repo.releasePassEmail(order.id);
      return "skipped";
    }
    return "sent";
  } catch (err) {
    log("pass email failed", { orderId, error: err instanceof Error ? err.message : String(err) });
    if (claimed) {
      try {
        await deps.repo.releasePassEmail(orderId);
      } catch (e) {
        log("pass email claim release failed", { orderId, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return "failed";
  }
}
