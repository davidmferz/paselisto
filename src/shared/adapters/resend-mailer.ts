import { Resend } from "resend";
import type { Mailer, PassEmailMessage } from "../ports";

type SendResult = { data: { id: string } | null; error: { message: string } | null };
/** Minimal surface of the Resend SDK we use (lets tests inject a fake). */
export type ResendLike = {
  emails: {
    send(payload: Record<string, unknown>, options?: { idempotencyKey?: string }): Promise<SendResult>;
  };
};

type Env = Record<string, string | undefined>;

/**
 * Resend adapter. Missing RESEND_API_KEY / EMAIL_FROM (or EMAIL_ENABLED=0|false) => silent no-op
 * that logs once. A provider error THROWS so the caller can release its claim and retry later.
 */
export function createMailer(
  env: Env,
  opts: { client?: ResendLike; log?: (msg: string) => void } = {},
): Mailer {
  const log = opts.log ?? ((m: string) => console.warn(m));
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  const disabled = ["0", "false"].includes((env.EMAIL_ENABLED ?? "").trim().toLowerCase());

  if (!apiKey || !from || disabled) {
    let warned = false;
    return {
      async sendPassEmail() {
        if (!warned) {
          warned = true;
          log(
            disabled
              ? "email disabled (EMAIL_ENABLED=0): pass emails are skipped"
              : "email not configured (RESEND_API_KEY / EMAIL_FROM missing): pass emails are skipped",
          );
        }
        return { skipped: true as const };
      },
    };
  }

  const client = opts.client ?? (new Resend(apiKey) as unknown as ResendLike);
  return {
    async sendPassEmail(msg: PassEmailMessage) {
      const { data, error } = await client.emails.send(
        {
          from,
          to: msg.to,
          ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        },
        { idempotencyKey: `pass-email/${msg.orderId}` },
      );
      if (error || !data) throw new Error(error?.message ?? "resend: empty response");
      return { id: data.id };
    },
  };
}
