/** Pure, email-safe renderer for the "pass issued" confirmation. No I/O, no data: URIs. */
import { googleCalendarUrl } from "@/features/calendar/ics";
import { shortRef } from "@/features/checkout/copy";
import { formatEventDate, formatMxn } from "@/shared/format";

export type PassEmailView = {
  appUrl: string;
  orderId: string;
  passToken: string;
  buyerName: string;
  eventSlug: string;
  eventName: string;
  startsAt: Date | null;
  venue: string | null;
  organizerName: string | null;
  contactEmail: string | null;
  amountCents: number;
  paidAt: Date | null;
};

const TZ = "America/Mexico_City";
const shortDate = new Intl.DateTimeFormat("es-MX", { timeZone: TZ, day: "numeric", month: "short" });
const paidDate = new Intl.DateTimeFormat("es-MX", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
});

const INK = "#12142B";
const MANGO = "#FF8A1F";
const FONT = "'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const e = escapeHtml;

export function renderPassEmail(v: PassEmailView): { subject: string; html: string; text: string } {
  const base = v.appUrl.replace(/\/+$/, "");
  const orderUrl = `${base}/order/${encodeURIComponent(v.orderId)}`;
  const qrUrl = `${base}/api/passes/${encodeURIComponent(v.passToken)}/qr.png`;
  const ref = shortRef(v.orderId);
  const amount = formatMxn(v.amountCents);
  const payee = v.organizerName?.trim() || v.eventName;
  const when = v.startsAt ? formatEventDate(v.startsAt) : null;
  const paid = v.paidAt ? paidDate.format(v.paidAt) : null;

  const subject = oneLine(
    v.startsAt ? `Tu pase para ${v.eventName} · ${shortDate.format(v.startsAt)}` : `Tu pase para ${v.eventName}`,
  );

  const cal = v.startsAt
    ? {
        google: googleCalendarUrl(
          { slug: v.eventSlug, name: v.eventName, venue: v.venue, startsAt: v.startsAt },
          { id: v.orderId, passToken: v.passToken, passUrl: orderUrl },
        ),
        ics: `${base}/api/orders/${encodeURIComponent(v.orderId)}/calendar`,
      }
    : null;

  const fallback = "Si el QR no se ve, abre tu pase con el botón o dicta el código manual en la entrada.";
  const greeting = `¡Listo, ${v.buyerName}! Ya tienes tu lugar.`;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#6B6F8A;">${label}</td><td align="right" style="padding:6px 0;font-size:13px;color:${INK};">${value}</td></tr>`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F2EE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F2EE;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONT};color:${INK};">
<tr><td style="padding:0 4px 16px;font-size:13px;font-weight:bold;letter-spacing:1px;color:${MANGO};">PASELISTO &middot; PAGO CONFIRMADO</td></tr>
<tr><td style="padding:0 4px 4px;font-size:26px;line-height:32px;font-weight:bold;color:${INK};">Pago confirmado</td></tr>
<tr><td style="padding:0 4px 20px;font-size:16px;line-height:24px;color:${INK};">${e(greeting)}</td></tr>
<tr><td style="background:${INK};border-radius:16px;padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT};">
<tr><td style="font-size:12px;font-weight:bold;letter-spacing:1.5px;color:${MANGO};padding-bottom:8px;">PASE DE ENTRADA · 1 PERSONA</td></tr>
<tr><td style="font-size:22px;line-height:28px;font-weight:bold;color:#FFFFFF;padding-bottom:6px;">${e(v.eventName)}</td></tr>
${when ? `<tr><td style="font-size:14px;line-height:20px;color:#D9DAE6;">${e(when)}</td></tr>` : ""}
${v.venue ? `<tr><td style="font-size:14px;line-height:20px;color:#D9DAE6;">${e(v.venue)}</td></tr>` : ""}
<tr><td align="center" style="padding:20px 0;"><img src="${e(qrUrl)}" width="200" height="200" alt="Código QR de tu pase" style="display:block;width:200px;height:200px;background:#FFFFFF;border-radius:8px;border:0;"></td></tr>
<tr><td style="font-size:12px;color:#9EA1BD;">Titular</td></tr>
<tr><td style="font-size:16px;font-weight:bold;color:#FFFFFF;padding-bottom:10px;">${e(v.buyerName)}</td></tr>
<tr><td style="font-size:12px;color:#9EA1BD;">Código manual</td></tr>
<tr><td style="font-size:16px;font-weight:bold;font-family:'Courier New',Courier,monospace;color:#FFFFFF;word-break:break-all;">${e(v.passToken)}</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:24px 0 12px;"><a href="${e(orderUrl)}" style="display:inline-block;background:${MANGO};color:${INK};font-size:16px;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:12px;">Abrir mi pase</a></td></tr>
<tr><td style="padding:0 4px 20px;font-size:13px;line-height:20px;color:#6B6F8A;text-align:center;">${e(fallback)}</td></tr>
<tr><td style="background:#FFFFFF;border-radius:12px;padding:16px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT};">
${row("Pagaste", `<strong>${e(amount)} MXN</strong> con CoDi`)}
${row("Pagado a", e(payee))}
${paid ? row("Fecha de pago", e(paid)) : ""}
${row("Pedido", `#${e(ref)}`)}
</table></td></tr>
${
  cal
    ? `<tr><td align="center" style="padding:20px 4px 0;font-size:14px;line-height:22px;color:${INK};">Agrégalo a tu calendario: <a href="${e(cal.google)}" style="color:${INK};font-weight:bold;">Google Calendar</a> &middot; <a href="${e(cal.ics)}" style="color:${INK};font-weight:bold;">Archivo .ics</a></td></tr>`
    : ""
}
${
  v.contactEmail
    ? `<tr><td style="padding:20px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#FFF1E0;border-radius:12px;padding:16px 20px;font-size:14px;line-height:21px;color:${INK};"><strong>¿Dudas sobre el taller?</strong><br>Responde a este correo y el organizador te contestará directamente.</td></tr></table></td></tr>`
    : ""
}
<tr><td align="center" style="padding:24px 4px 0;font-size:12px;line-height:18px;color:#8A8DA6;">Recibes este correo porque compraste un pase en PaseListo.<br>Guarda este mensaje: tu pase es personal, no lo compartas.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    "PAGO CONFIRMADO",
    greeting,
    "",
    "PASE DE ENTRADA · 1 PERSONA",
    v.eventName,
    ...(when ? [when] : []),
    ...(v.venue ? [v.venue] : []),
    `Titular: ${v.buyerName}`,
    `Código manual: ${v.passToken}`,
    "",
    `Abrir mi pase: ${orderUrl}`,
    fallback,
    "",
    `Pagaste ${amount} MXN con CoDi`,
    `Pagado a ${payee}`,
    ...(paid ? [`Fecha de pago: ${paid}`] : []),
    `Pedido #${ref}`,
    ...(cal ? ["", `Google Calendar: ${cal.google}`, `Archivo .ics: ${cal.ics}`] : []),
    ...(v.contactEmail ? ["", "¿Dudas sobre el taller? Responde a este correo y el organizador te contestará directamente."] : []),
  ].join("\n");

  return { subject, html, text };
}
