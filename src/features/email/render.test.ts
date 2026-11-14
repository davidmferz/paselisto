import { describe, expect, it } from "vitest";
import { renderPassEmail, type PassEmailView } from "./render";

const view: PassEmailView = {
  appUrl: "https://paselisto.app/",
  orderId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  passToken: "tok_ABC-123_xyz",
  buyerName: "Ana",
  eventSlug: "ceramica",
  eventName: "Taller de cerámica",
  startsAt: new Date("2026-11-21T17:00:00Z"), // 11:00 CDMX
  venue: "Casa Clara, Roma Norte",
  organizerName: "Estudio Barro",
  contactEmail: "hola@estudiobarro.mx",
  amountCents: 35000,
  paidAt: new Date("2026-11-14T18:30:00Z"),
};

describe("renderPassEmail", () => {
  it("builds the subject with event name and short date", () => {
    const { subject } = renderPassEmail(view);
    expect(subject).toMatch(/^Tu pase para Taller de cerámica · 21 nov/);
  });

  it("omits the date from the subject when the event has none", () => {
    expect(renderPassEmail({ ...view, startsAt: null }).subject).toBe("Tu pase para Taller de cerámica");
  });

  it("greets in Mexican Spanish with tuteo and confirms payment", () => {
    const { html, text } = renderPassEmail(view);
    expect(html).toContain("Pago confirmado");
    expect(html).toContain("¡Listo, Ana! Ya tienes tu lugar.");
    expect(text).toContain("¡Listo, Ana! Ya tienes tu lugar.");
  });

  it("links to the pass page, the QR image and shows the manual code", () => {
    const { html, text } = renderPassEmail(view);
    expect(html).toContain('href="https://paselisto.app/order/0f8fad5b-d9cb-469f-a165-70867728950e"');
    expect(html).toContain('src="https://paselisto.app/api/passes/tok_ABC-123_xyz/qr.png"');
    expect(html).toContain("tok_ABC-123_xyz");
    expect(html).toContain("Abrir mi pase");
    expect(html).toContain("PASE DE ENTRADA · 1 PERSONA");
    expect(text).toContain("https://paselisto.app/order/0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(text).toContain("tok_ABC-123_xyz");
  });

  it("includes the QR fallback sentence", () => {
    const { html, text } = renderPassEmail(view);
    const s = "Si el QR no se ve, abre tu pase con el botón o dicta el código manual en la entrada.";
    expect(html).toContain(s);
    expect(text).toContain(s);
  });

  it("never embeds data: URIs (email clients block them)", () => {
    const { html } = renderPassEmail(view);
    expect(html).not.toMatch(/data:/i);
  });

  it("renders the receipt rows", () => {
    const { html, text } = renderPassEmail(view);
    expect(html).toContain("CoDi");
    expect(html).toContain("Estudio Barro");
    expect(html).toContain("0F8FAD5B");
    expect(html).toMatch(/\$350\.00/);
    expect(text).toContain("Pedido #0F8FAD5B");
  });

  it("falls back to the event name as payee when there is no organizer", () => {
    const { text } = renderPassEmail({ ...view, organizerName: null });
    expect(text).toContain("Pagado a Taller de cerámica");
  });

  it("adds Google Calendar and .ics links only when the event has a date", () => {
    const { html, text } = renderPassEmail(view);
    expect(html).toContain("https://calendar.google.com/calendar/render?");
    expect(html).toContain("https://paselisto.app/api/orders/0f8fad5b-d9cb-469f-a165-70867728950e/calendar");
    expect(text).toContain("/api/orders/0f8fad5b-d9cb-469f-a165-70867728950e/calendar");
    const none = renderPassEmail({ ...view, startsAt: null });
    expect(none.html).not.toContain("calendar.google.com");
    expect(none.html).not.toContain("/calendar");
  });

  it("shows the help box with reply guidance only when a contact email exists", () => {
    const withContact = renderPassEmail(view);
    expect(withContact.html).toContain("¿Dudas sobre el taller?");
    expect(withContact.html).toContain("Responde a este correo");
    const without = renderPassEmail({ ...view, contactEmail: null });
    expect(without.html).not.toContain("Responde a este correo");
    expect(without.text).not.toContain("Responde a este correo");
  });

  it("is email-safe: tables, inline styles, max-width 560, web-safe fonts", () => {
    const { html } = renderPassEmail(view);
    expect(html).toContain("<table");
    expect(html).toContain("max-width:560px");
    expect(html).toContain("#12142B");
    expect(html).toContain("#FF8A1F");
    expect(html).toMatch(/font-family:[^;"]*Arial/);
    expect(html).not.toContain("<script");
  });

  it("escapes every user-provided string (HTML injection)", () => {
    const evil = `<img src=x onerror=alert(1)>"&'`;
    const { html, subject } = renderPassEmail({
      ...view,
      buyerName: evil,
      eventName: evil,
      venue: evil,
      organizerName: evil,
      contactEmail: `a"><script>x</script>@x.mx`,
      passToken: `t"><b>`,
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>x");
    expect(html).not.toContain('t"><b>');
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;&quot;&amp;&#39;");
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("strips CR/LF from the subject (header injection)", () => {
    const { subject } = renderPassEmail({ ...view, eventName: "A\r\nBcc: x@y.z" });
    expect(subject).not.toMatch(/[\r\n]/);
  });
});
