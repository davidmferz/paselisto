import { describe, expect, it } from "vitest";
import { resolveEvent } from "./resolve-event";
import { FakeRepo } from "@/test/fakes";

const e = (id: string, slug: string, startsAt?: Date) => ({ id, slug, name: id, priceCents: 1, capacity: 1, startsAt });

describe("resolveEvent", () => {
  it("resolves by slug or id, defaults to the first listed event, null when none/unknown", async () => {
    const repo = new FakeRepo();
    expect(await resolveEvent(repo, undefined)).toBeNull();
    repo.seedEvent(e("e2", "later", new Date("2026-12-01T00:00:00Z")));
    repo.seedEvent(e("e1", "sooner", new Date("2026-11-01T00:00:00Z")));
    expect((await resolveEvent(repo, "later"))?.id).toBe("e2");
    expect((await resolveEvent(repo, "e1"))?.slug).toBe("sooner");
    expect((await resolveEvent(repo, undefined))?.id).toBe("e1");
    expect((await resolveEvent(repo, ""))?.id).toBe("e1");
    expect(await resolveEvent(repo, "nope")).toBeNull();
  });
});
