import { describe, expect, it } from "vitest";
import { eventUrl, whatsappMessage, whatsappLink } from "./share";

describe("share helpers", () => {
  it("builds the public event url without double slashes", () => {
    expect(eventUrl("https://x.app/", "mi-taller")).toBe("https://x.app/e/mi-taller");
    expect(eventUrl("https://x.app", "mi-taller")).toBe("https://x.app/e/mi-taller");
  });
  it("builds a Spanish tuteo message containing name, date and link", () => {
    const m = whatsappMessage({ name: "Cerámica", dateLabel: "sábado 5 de diciembre", url: "https://x.app/e/c" });
    expect(m).toContain("Cerámica");
    expect(m).toContain("sábado 5 de diciembre");
    expect(m).toContain("https://x.app/e/c");
  });
  it("encodes it into a wa.me link", () => {
    const l = whatsappLink("hola & más");
    expect(l).toBe("https://wa.me/?text=" + encodeURIComponent("hola & más"));
  });
});
