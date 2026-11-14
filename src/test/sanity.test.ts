import { describe, expect, it } from "vitest";

describe("vitest harness", () => {
  it("runs and resolves the @ alias", async () => {
    const mod = await import("@/shared/ports");
    expect(mod).toBeDefined();
  });
});
