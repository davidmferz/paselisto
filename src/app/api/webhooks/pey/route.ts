import { handlePeyWebhook } from "@/features/webhook/handle-payment";
import { systemClock } from "@/shared/adapters/clock";
import { createNeonRepo } from "@/shared/adapters/neon-repo";
import { getConfig } from "@/shared/config";
import { getOnPaid } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // RAW body: the signature is computed over the exact bytes, never re-serialized JSON.
  const raw = await req.text();
  try {
    const cfg = getConfig();
    const repo = createNeonRepo(cfg.databaseUrl);
    const res = await handlePeyWebhook({
      raw,
      headers: req.headers,
      secret: cfg.pey.webhookSecret,
      repo,
      clock: systemClock,
      onPaid: getOnPaid(repo),
    });
    return new Response(res.body, { status: res.status });
  } catch (err) {
    console.error("pey webhook route failure", err instanceof Error ? err.message : err);
    return new Response("internal error", { status: 500 });
  }
}
