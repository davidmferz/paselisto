import { describe, expect, it } from "vitest";
import { adminNavItems, safeNextPath, sectionTitle, loginHref, ADMIN_HOME } from "./nav";

describe("safeNextPath", () => {
  it("accepts relative /admin paths (with query)", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/admin/scan?event=taller-1")).toBe("/admin/scan?event=taller-1");
    expect(safeNextPath("/admin/talleres/nuevo")).toBe("/admin/talleres/nuevo");
  });
  it.each([
    undefined, "", "https://evil.com/admin", "//evil.com/admin", "/\\evil.com", "/admin/../etc", "/adminx", "/api/admin/orders",
    "/admin/login", "/admin/login?next=/admin", "javascript:alert(1)", "/admin\nfoo", "/admin%2F%2Fevil", " /admin",
  ])("falls back to /admin/talleres for %j", (v) => {
    expect(safeNextPath(v as string | undefined)).toBe(ADMIN_HOME);
  });
  it("uses the first value of an array and ignores non-strings", () => {
    expect(safeNextPath(["/admin/scan", "/x"])).toBe("/admin/scan");
    expect(safeNextPath(["https://x.com"])).toBe(ADMIN_HOME);
  });
});

describe("loginHref", () => {
  it("encodes the target path", () => {
    expect(loginHref("/admin/scan?event=a b")).toBe("/admin/login?next=%2Fadmin%2Fscan%3Fevent%3Da%20b");
  });
});

describe("adminNavItems", () => {
  it("without event: scan and panel go to the picker", () => {
    const items = adminNavItems("/admin/talleres", null);
    expect(items.map((i) => [i.key, i.href, i.active])).toEqual([
      ["talleres", "/admin/talleres", true],
      ["scan", "/admin/scan", false],
      ["panel", "/admin", false],
    ]);
  });
  it("with event: hrefs carry the slug (encoded)", () => {
    const items = adminNavItems("/admin", "mi taller");
    expect(items.map((i) => i.href)).toEqual(["/admin/talleres", "/admin/scan?event=mi%20taller", "/admin?event=mi%20taller"]);
    expect(items.map((i) => i.active)).toEqual([false, false, true]);
  });
  it("marks the right tab per path; nuevo belongs to talleres", () => {
    const act = (p: string) => adminNavItems(p, null).find((i) => i.active)?.key;
    expect(act("/admin/scan")).toBe("scan");
    expect(act("/admin/talleres/nuevo")).toBe("talleres");
    expect(act("/admin")).toBe("panel");
    expect(act("/admin/login")).toBeUndefined();
  });
});

describe("sectionTitle", () => {
  it("maps paths to titles", () => {
    expect(sectionTitle("/admin")).toBe("Panel");
    expect(sectionTitle("/admin/scan")).toBe("Escanear");
    expect(sectionTitle("/admin/talleres")).toBe("Mis talleres");
    expect(sectionTitle("/admin/talleres/nuevo")).toBe("Nuevo taller");
  });
});
