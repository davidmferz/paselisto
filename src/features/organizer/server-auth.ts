import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/shared/config";
import { getClock } from "@/shared/container";
import { isAuthorized } from "./auth-guard";
import { SESSION_COOKIE } from "./login";
import { loginHref, safeNextPath } from "./nav";

async function hasSession(): Promise<boolean> {
  const store = await cookies();
  return isAuthorized(store.get(SESSION_COOKIE)?.value, getConfig().sessionSecret, getClock().now());
}

/** Pages: redirect unauthenticated visitors to the login page (PC-R1). */
export async function requireAdminPage(path: string = "/admin"): Promise<void> {
  if (!(await hasSession())) redirect(loginHref(path));
}

/** Login page: an already-authenticated organizer goes straight to Mis talleres (or a safe `next`). */
export async function redirectIfAuthed(next?: string | string[]): Promise<void> {
  if (await hasSession()) redirect(safeNextPath(next));
}

/** API routes: returns a 401 Response when unauthenticated, otherwise null. */
export async function requireAdminApi(): Promise<Response | null> {
  if (await hasSession()) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
