import { afterEach, describe, expect, it, vi } from "vitest";
import { createPeyClient, PeyError } from "./pey-client";

const cfg = { apiKey: "key_123", baseUrl: "https://api.pey.mx", sleep: async () => {} };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("pey-client createQr", () => {
  it("POSTs /codi/qr with MXN amount, metadata.orderId, expiration, generateImage:false and Bearer", async () => {
    const f = stubFetch(json(201, { id: "qr_1", qrString: "000201...", qrImage: null }));
    const out = await createPeyClient(cfg).createQr({
      amountCents: 12550,
      concept: "Entrada",
      expirationSec: 900,
      orderId: "ord_1",
    });
    expect(out).toEqual({ id: "qr_1", qrString: "000201..." });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.pey.mx/codi/qr");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer key_123");
    expect(JSON.parse(init.body)).toEqual({
      amount: 125.5,
      concept: "Entrada",
      expiration: 900,
      generateImage: false,
      metadata: { orderId: "ord_1" },
    });
  });

  it("clamps expiration below 360 up to 360", async () => {
    const f = stubFetch(json(201, { id: "q", qrString: "s" }));
    await createPeyClient(cfg).createQr({ amountCents: 1, concept: "c", expirationSec: 60, orderId: "o" });
    expect(JSON.parse(f.mock.calls[0][1].body).expiration).toBe(360);
    expect(JSON.parse(f.mock.calls[0][1].body).amount).toBe(0.01);
  });

  it("maps 400 to PeyError bad_request without retrying", async () => {
    const f = stubFetch(json(400, { message: "bad" }));
    await expect(
      createPeyClient(cfg).createQr({ amountCents: 1, concept: "c", expirationSec: 900, orderId: "o" }),
    ).rejects.toMatchObject({ name: "PeyError", kind: "bad_request", status: 400 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("maps 500 to PeyError server without retrying", async () => {
    const f = stubFetch(json(500, {}));
    await expect(
      createPeyClient(cfg).createQr({ amountCents: 1, concept: "c", expirationSec: 900, orderId: "o" }),
    ).rejects.toMatchObject({ kind: "server", status: 500 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries 503 up to 2 times then succeeds", async () => {
    const f = stubFetch(json(503, {}), json(503, {}), json(201, { id: "qr_2", qrString: "s" }));
    const out = await createPeyClient(cfg).createQr({
      amountCents: 100,
      concept: "c",
      expirationSec: 900,
      orderId: "o",
    });
    expect(out.id).toBe("qr_2");
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("throws unavailable after 3 consecutive 503 (1 + 2 retries)", async () => {
    const f = stubFetch(json(503, {}), json(503, {}), json(503, {}));
    const p = createPeyClient(cfg).createQr({ amountCents: 1, concept: "c", expirationSec: 900, orderId: "o" });
    await expect(p).rejects.toBeInstanceOf(PeyError);
    await expect(p).rejects.toMatchObject({ kind: "unavailable", status: 503 });
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("pey-client getQrStatus", () => {
  it("GETs /transaction/codi/qr/{id} and returns PAID when an item is PAID", async () => {
    const f = stubFetch(json(200, { items: [{ status: "PAID", datePaid: 1 }] }));
    expect(await createPeyClient(cfg).getQrStatus("qr_1")).toBe("PAID");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.pey.mx/transaction/codi/qr/qr_1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer key_123");
  });

  it("returns PENDING when no items are paid or list is empty", async () => {
    stubFetch(json(200, { items: [{ status: "PENDING" }] }));
    expect(await createPeyClient(cfg).getQrStatus("a")).toBe("PENDING");
    stubFetch(json(200, { items: [] }));
    expect(await createPeyClient(cfg).getQrStatus("b")).toBe("PENDING");
  });
});

describe("pey-client createPush", () => {
  it("POSTs /codi/pn with 10-digit phone and returns transactionId", async () => {
    const f = stubFetch(json(200, { transactionId: "tx_1", codiId: "c1" }));
    const out = await createPeyClient(cfg).createPush({ amountCents: 5000, phone: "5512345678", orderId: "ord_9" });
    expect(out).toEqual({ transactionId: "tx_1" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.pey.mx/codi/pn");
    expect(JSON.parse(init.body)).toMatchObject({
      amount: 50,
      phoneNumber: "5512345678",
      metadata: { orderId: "ord_9" },
    });
  });

  it("rejects an invalid phone locally without calling fetch", async () => {
    const f = stubFetch();
    await expect(
      createPeyClient(cfg).createPush({ amountCents: 100, phone: "123", orderId: "o" }),
    ).rejects.toMatchObject({ kind: "bad_request" });
    expect(f).not.toHaveBeenCalled();
  });
});
