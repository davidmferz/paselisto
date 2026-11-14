import { cookies } from "next/headers";
import { login } from "@/features/organizer/login";
import { getConfig } from "@/shared/config";
import { getClock } from "@/shared/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    /* malformed body is treated as an empty password */
  }
  const cfg = getConfig();
  const r = login({ password, expectedPassword: cfg.organizerPassword, secret: cfg.sessionSecret, clock: getClock() });
  if (!r.ok) return Response.json({ error: "invalid_credentials" }, { status: 401 });
  (await cookies()).set(r.cookie.name, r.cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: r.cookie.maxAgeSec,
  });
  return Response.json({ ok: true });
}
