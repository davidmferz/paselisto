import { verifySession } from "./session";

/** Pure authorization decision; pages redirect and API routes answer 401 based on it. */
export function isAuthorized(cookieValue: string | undefined, secret: string, now: Date): boolean {
  return verifySession(secret, cookieValue, now);
}
