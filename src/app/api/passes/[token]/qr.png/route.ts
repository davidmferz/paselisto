import QRCode from "qrcode";
import { handleQrPng } from "@/features/passes/qr-png";
import { getRepo } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  return handleQrPng({
    repo: getRepo(),
    token,
    render: (text) => QRCode.toBuffer(text, { type: "png", width: 400, margin: 2, errorCorrectionLevel: "M" }),
  });
}
