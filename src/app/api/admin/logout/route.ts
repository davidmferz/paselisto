import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/features/organizer/login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
