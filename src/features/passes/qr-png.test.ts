import { describe, expect, it, vi } from "vitest";
import { handleQrPng } from "./qr-png";
import { FakeRepo } from "@/test/fakes";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("handleQrPng", () => {
  it("returns a cacheable PNG for a known token, encoding the raw token", async () => {
    const repo = new FakeRepo();
    repo.passes.set("p", { id: "p", orderId: "o", token: "tok12345", usedAt: null });
    const render = vi.fn(async () => PNG);
    const res = await handleQrPng({ repo, token: "tok12345", render });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
    expect(render).toHaveBeenCalledWith("tok12345");
  });

  it("404s for unknown tokens without rendering", async () => {
    const render = vi.fn(async () => PNG);
    const res = await handleQrPng({ repo: new FakeRepo(), token: "nope", render });
    expect(res.status).toBe(404);
    expect(render).not.toHaveBeenCalled();
  });

  it("404s for malformed tokens without touching the repo", async () => {
    const repo = new FakeRepo();
    const spy = vi.spyOn(repo, "findPassByToken");
    const res = await handleQrPng({ repo, token: "a/../b?x", render: async () => PNG });
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  it("500s when rendering fails", async () => {
    const repo = new FakeRepo();
    repo.passes.set("p", { id: "p", orderId: "o", token: "tok12345", usedAt: null });
    const res = await handleQrPng({ repo, token: "tok12345", render: async () => { throw new Error("x"); } });
    expect(res.status).toBe(500);
  });
});
