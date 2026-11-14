import { describe, expect, it } from "vitest";
import { handleCreateEvent } from "./handler";
import { FakeClock, FakeRepo } from "@/test/fakes";

const clock = new FakeClock(new Date("2026-11-14T12:00:00Z"));
const body = {
  name: "Taller de cerámica", description: "", date: "2026-12-05", time: "11:00", venue: "Estudio Barro",
  price: "350", capacity: "20", contactEmail: "hola@barro.mx",
};
const mk = (flag = true) => {
  const repo = new FakeRepo();
  return { repo, deps: { repo, clock, enabled: flag, appUrl: "https://x.app", organizerName: null } };
};

describe("handleCreateEvent", () => {
  it("403 when the feature flag is off (server-side), creating nothing", async () => {
    const { repo, deps } = mk(false);
    const r = await handleCreateEvent(deps, body, "k1");
    expect(r.status).toBe(403);
    expect(await repo.listEvents()).toHaveLength(0);
  });
  it("400 on missing idempotency key", async () => {
    const r = await handleCreateEvent(mk().deps, body, null);
    expect(r.status).toBe(400);
  });
  it("400 on non-object body", async () => {
    expect((await handleCreateEvent(mk().deps, null, "k")).status).toBe(400);
    expect((await handleCreateEvent(mk().deps, "x", "k")).status).toBe(400);
  });
  it("422 with per-field errors", async () => {
    const r = await handleCreateEvent(mk().deps, { ...body, price: "-1" }, "k");
    expect(r.status).toBe(422);
    expect((r.json as { errors: Record<string, string> }).errors.price).toBeTruthy();
  });
  it("201 on create, 200 on replay, with url", async () => {
    const { deps } = mk();
    const a = await handleCreateEvent(deps, body, "k");
    expect(a.status).toBe(201);
    expect(a.json).toMatchObject({ event: { slug: "taller-de-ceramica", url: "https://x.app/e/taller-de-ceramica", priceCents: 35000, capacity: 20 } });
    const b = await handleCreateEvent(deps, body, "k");
    expect(b.status).toBe(200);
  });
  it("409 when the slug cannot be made unique", async () => {
    const { deps } = mk();
    for (let i = 0; i < 5; i++) await handleCreateEvent(deps, body, `k${i}`);
    expect((await handleCreateEvent(deps, body, "z")).status).toBe(409);
  });
});
