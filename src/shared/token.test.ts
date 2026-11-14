import { describe, expect, it } from "vitest";
import { generateToken } from "@/shared/token";

describe("generateToken (PC-R4)", () => {
  it("is 128-bit base64url (22 chars, url-safe)", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(t, "base64url")).toHaveLength(16);
  });
  it("is unique across many calls", () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateToken()));
    expect(set.size).toBe(2000);
  });
});
