import type { PeyClient } from "../ports";

export type PeyErrorKind = "bad_request" | "unauthorized" | "server" | "unavailable";

export class PeyError extends Error {
  readonly name = "PeyError";
  constructor(
    readonly kind: PeyErrorKind,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type PeyClientConfig = {
  apiKey: string;
  baseUrl: string;
  /** injectable for tests; defaults to a short backoff */
  sleep?: (ms: number) => Promise<void>;
};

const MIN_EXPIRATION_SEC = 360;
const MAX_503_RETRIES = 2;
const PHONE_RE = /^[0-9]{10}$/;

// cents -> MXN number: the only place the unit changes (pey speaks pesos).
const toMxn = (cents: number) => Math.round(cents) / 100;

function kindFor(status: number): PeyErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 503) return "unavailable";
  if (status >= 500) return "server";
  return "bad_request";
}

export function createPeyClient(cfg: PeyClientConfig): PeyClient & {
  createPush(i: { amountCents: number; phone: string; orderId: string }): Promise<{ transactionId: string }>;
} {
  const sleep = cfg.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 503 && attempt < MAX_503_RETRIES) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw new PeyError(kindFor(res.status), res.status, `pey ${method} ${path} failed with ${res.status}`);
    }
  }

  return {
    async createQr({ amountCents, concept, expirationSec, orderId }) {
      const r = await request<{ id: string; qrString: string }>("POST", "/codi/qr", {
        amount: toMxn(amountCents),
        concept,
        expiration: Math.max(MIN_EXPIRATION_SEC, expirationSec),
        generateImage: false,
        metadata: { orderId },
      });
      return { id: r.id, qrString: r.qrString };
    },

    async getQrStatus(id) {
      const r = await request<{ items?: { status: string }[] } | { status: string }[]>(
        "GET",
        `/transaction/codi/qr/${encodeURIComponent(id)}`,
      );
      const items = Array.isArray(r) ? r : (r.items ?? []);
      return items.some((t) => t.status === "PAID") ? "PAID" : "PENDING";
    },

    async createPush({ amountCents, phone, orderId }) {
      if (!PHONE_RE.test(phone)) throw new PeyError("bad_request", 400, "phone must be 10 digits");
      const r = await request<{ transactionId: string }>("POST", "/codi/pn", {
        amount: toMxn(amountCents),
        phoneNumber: phone,
        metadata: { orderId },
      });
      return { transactionId: r.transactionId };
    },
  };
}
