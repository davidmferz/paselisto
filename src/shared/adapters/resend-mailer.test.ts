import { describe, expect, it, vi } from "vitest";
import { createMailer, type ResendLike } from "./resend-mailer";

const msg = { orderId: "ord-1", to: "ana@x.mx", replyTo: "hola@x.mx", subject: "S", html: "<p>h</p>", text: "t" };

function fakeClient(result: { data: { id: string } | null; error: { message: string } | null }) {
  const send = vi.fn(async (..._args: unknown[]) => result);
  return { client: { emails: { send } } as unknown as ResendLike, send };
}

describe("createMailer (Resend adapter)", () => {
  it("is a silent no-op (skipped) when RESEND_API_KEY or EMAIL_FROM is missing, logging once", async () => {
    const log = vi.fn();
    const m1 = createMailer({ EMAIL_FROM: "A <a@x.mx>" }, { log });
    expect(await m1.sendPassEmail(msg)).toEqual({ skipped: true });
    expect(await m1.sendPassEmail(msg)).toEqual({ skipped: true });
    expect(log).toHaveBeenCalledTimes(1);
    const m2 = createMailer({ RESEND_API_KEY: "re_1" }, { log: () => {} });
    expect(await m2.sendPassEmail(msg)).toEqual({ skipped: true });
  });

  it("is a no-op when EMAIL_ENABLED is 0/false", async () => {
    const { client, send } = fakeClient({ data: { id: "x" }, error: null });
    const m = createMailer({ RESEND_API_KEY: "k", EMAIL_FROM: "a@x.mx", EMAIL_ENABLED: "false" }, { client, log: () => {} });
    expect(await m.sendPassEmail(msg)).toEqual({ skipped: true });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends with from, to, replyTo, html, text and the idempotency key pass-email/<orderId>", async () => {
    const { client, send } = fakeClient({ data: { id: "em_1" }, error: null });
    const m = createMailer({ RESEND_API_KEY: "k", EMAIL_FROM: "PaseListo <pases@paselisto.app>" }, { client });
    expect(await m.sendPassEmail(msg)).toEqual({ id: "em_1" });
    expect(send).toHaveBeenCalledWith(
      { from: "PaseListo <pases@paselisto.app>", to: "ana@x.mx", replyTo: "hola@x.mx", subject: "S", html: "<p>h</p>", text: "t" },
      { idempotencyKey: "pass-email/ord-1" },
    );
  });

  it("omits replyTo when absent", async () => {
    const { client, send } = fakeClient({ data: { id: "em_1" }, error: null });
    const m = createMailer({ RESEND_API_KEY: "k", EMAIL_FROM: "a@x.mx" }, { client });
    await m.sendPassEmail({ ...msg, replyTo: undefined });
    expect(send.mock.calls[0][0]).not.toHaveProperty("replyTo");
  });

  it("throws on provider error so the caller can release the claim", async () => {
    const { client } = fakeClient({ data: null, error: { message: "domain not verified" } });
    const m = createMailer({ RESEND_API_KEY: "k", EMAIL_FROM: "a@x.mx" }, { client });
    await expect(m.sendPassEmail(msg)).rejects.toThrow("domain not verified");
  });
});
