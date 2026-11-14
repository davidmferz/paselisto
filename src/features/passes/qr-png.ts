import type { OrdersRepo } from "@/shared/ports";

/** generateToken() emits base64url; reject anything else before touching the DB. */
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

const notFound = () => Response.json({ error: "not found" }, { status: 404 });

/** PNG of the pass QR for email clients (they block data: URIs). The token is the capability. */
export async function handleQrPng(i: {
  repo: OrdersRepo;
  token: string;
  render: (text: string) => Promise<Buffer>;
}): Promise<Response> {
  if (!TOKEN_RE.test(i.token)) return notFound();
  try {
    const pass = await i.repo.findPassByToken(i.token);
    if (!pass) return notFound();
    const png = await i.render(pass.token);
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
    });
  } catch (err) {
    console.error("passes/qr.png failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
