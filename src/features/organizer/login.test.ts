import { describe, expect, it } from "vitest";
import { login, SESSION_COOKIE } from "@/features/organizer/login";
import { verifySession } from "@/features/organizer/session";
import { FakeClock } from "@/test/fakes";

const deps = () => ({ expectedPassword: "hunter2", secret: "s3cret", clock: new FakeClock() });

describe("login use-case (PC-S2)", () => {
  it("wrong password -> not ok, no cookie", () => {
    const r = login({ password: "nope", ...deps() });
    expect(r).toEqual({ ok: false });
  });
  it("empty password -> not ok", () => {
    expect(login({ password: "", ...deps() })).toEqual({ ok: false });
  });
  it("right password -> signed cookie that verifies, 12h maxAge", () => {
    const d = deps();
    const r = login({ password: "hunter2", ...d });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cookie.name).toBe(SESSION_COOKIE);
    expect(verifySession(d.secret, r.cookie.value, d.clock.now())).toBe(true);
    expect(r.cookie.maxAgeSec).toBe(12 * 60 * 60);
  });
});
