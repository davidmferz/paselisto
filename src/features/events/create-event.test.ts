import { describe, expect, it } from "vitest";
import { createEvent } from "./create-event";
import { createOrder } from "@/features/checkout/use-cases";
import { FakeClock, FakePey, FakeRepo } from "@/test/fakes";

const clock = new FakeClock(new Date("2026-11-14T12:00:00Z"));
const input = {
  name: "Taller de cerámica",
  description: "Aprende a tornear",
  date: "2026-12-05",
  time: "11:00",
  venue: "Estudio Barro Vivo",
  price: "350",
  capacity: "20",
  contactEmail: "hola@barro.mx",
};
const mk = () => {
  const repo = new FakeRepo();
  return { repo, deps: { repo, clock, organizerName: "Barro Vivo" } };
};

describe("createEvent", () => {
  it("creates a published event with the full result shape", async () => {
    const { repo, deps } = mk();
    const r = await createEvent(deps, input, "key-1");
    expect(r.kind).toBe("created");
    if (r.kind !== "created") return;
    expect(r.event).toMatchObject({
      slug: "taller-de-ceramica",
      name: "Taller de cerámica",
      priceCents: 35000,
      capacity: 20,
      venue: "Estudio Barro Vivo",
      contactEmail: "hola@barro.mx",
      organizerName: "Barro Vivo",
      createdByRequest: "key-1",
    });
    expect(r.event.startsAt).toEqual(new Date("2026-12-05T17:00:00Z"));
    expect(r.event.id).toBeTruthy();
    expect(await repo.findEventBySlug("taller-de-ceramica")).toMatchObject({ id: r.event.id });
  });

  it("returns field errors and persists nothing when invalid", async () => {
    const { repo, deps } = mk();
    const r = await createEvent(deps, { ...input, price: "0", capacity: "999" }, "key-1");
    expect(r.kind).toBe("invalid");
    if (r.kind === "invalid") expect(Object.keys(r.errors).sort()).toEqual(["capacity", "price"]);
    expect(await repo.listEvents()).toHaveLength(0);
  });

  it("rejects a missing / oversized idempotency key", async () => {
    const { deps } = mk();
    expect((await createEvent(deps, input, "")).kind).toBe("invalid_key");
    expect((await createEvent(deps, input, "k".repeat(101))).kind).toBe("invalid_key");
  });

  it("suffixes -2, -3 on slug collision", async () => {
    const { deps } = mk();
    const a = await createEvent(deps, input, "k1");
    const b = await createEvent(deps, input, "k2");
    const c = await createEvent(deps, input, "k3");
    expect([a, b, c].map((r) => r.kind === "created" && r.event.slug)).toEqual([
      "taller-de-ceramica",
      "taller-de-ceramica-2",
      "taller-de-ceramica-3",
    ]);
  });

  it("suffix never exceeds the 48 char slug cap", async () => {
    const { deps } = mk();
    const long = { ...input, name: "x".repeat(60) };
    await createEvent(deps, long, "k1");
    const b = await createEvent(deps, long, "k2");
    expect(b.kind === "created" && b.event.slug.length).toBeLessThanOrEqual(48);
    expect(b.kind === "created" && b.event.slug.endsWith("-2")).toBe(true);
  });

  it("gives up with slug_unavailable after 5 attempts", async () => {
    const { deps } = mk();
    for (let i = 1; i <= 5; i++) expect((await createEvent(deps, input, `k${i}`)).kind).toBe("created");
    expect((await createEvent(deps, input, "k6")).kind).toBe("slug_unavailable");
  });

  it("is idempotent: same key returns the existing event, no duplicate", async () => {
    const { repo, deps } = mk();
    const a = await createEvent(deps, input, "same");
    const b = await createEvent(deps, { ...input, name: "Otro nombre" }, "same");
    expect(a.kind).toBe("created");
    expect(b.kind).toBe("existing");
    if (a.kind === "created" && b.kind === "existing") expect(b.event.id).toBe(a.event.id);
    expect(await repo.listEvents()).toHaveLength(1);
  });

  it("is idempotent under concurrent retries with the same key", async () => {
    const { repo, deps } = mk();
    const rs = await Promise.all([1, 2, 3, 4].map(() => createEvent(deps, input, "race")));
    expect(await repo.listEvents()).toHaveLength(1);
    const ids = new Set(rs.map((r) => (r.kind === "created" || r.kind === "existing" ? r.event.id : "x")));
    expect(ids.size).toBe(1);
    expect(rs.filter((r) => r.kind === "created")).toHaveLength(1);
  });

  it("concurrent creations with different keys get unique slugs", async () => {
    const { repo, deps } = mk();
    const rs = await Promise.all([1, 2, 3].map((i) => createEvent(deps, input, `c${i}`)));
    const slugs = rs.map((r) => (r.kind === "created" ? r.event.slug : "x"));
    expect(new Set(slugs).size).toBe(3);
    expect(await repo.listEvents()).toHaveLength(3);
  });

  it("integration: the new event accepts orders through checkout, isolated from others", async () => {
    const { repo, deps } = mk();
    const other = await createEvent(deps, { ...input, name: "Otro taller" }, "o");
    const made = await createEvent({ ...deps }, { ...input, capacity: "1" }, "n");
    expect(made.kind).toBe("created");
    if (made.kind !== "created" || other.kind !== "created") return;
    const pey = new FakePey();
    const ok = await createOrder({ repo, pey, clock }, { slug: made.event.slug, name: "Ana Pérez", email: "ana@x.mx" });
    expect(ok.kind).toBe("ok");
    const full = await createOrder({ repo, pey, clock }, { slug: made.event.slug, name: "Beto", email: "b@x.mx" });
    expect(full.kind).toBe("sold_out"); // capacity 1 enforced for the new event
    const elsewhere = await createOrder({ repo, pey, clock }, { slug: other.event.slug, name: "Beto", email: "b@x.mx" });
    expect(elsewhere.kind).toBe("ok"); // other event unaffected
    expect((await repo.listOrders(made.event.id)).length).toBe(1);
    expect((await repo.listOrders(other.event.id)).length).toBe(1);
    expect(pey.createQrCalls[0].amountCents).toBe(35000);
  });
});
