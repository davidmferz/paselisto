import type { Clock } from "@/shared/ports";
import { passwordMatches, signSession, SESSION_TTL_MS } from "./session";

export const SESSION_COOKIE = "pl_admin";

export type LoginResult =
  | { ok: true; cookie: { name: string; value: string; maxAgeSec: number } }
  | { ok: false };

export function login(i: { password: string; expectedPassword: string; secret: string; clock: Clock }): LoginResult {
  if (!passwordMatches(i.password, i.expectedPassword)) return { ok: false };
  return {
    ok: true,
    cookie: {
      name: SESSION_COOKIE,
      value: signSession(i.secret, i.clock.now()),
      maxAgeSec: SESSION_TTL_MS / 1000,
    },
  };
}
