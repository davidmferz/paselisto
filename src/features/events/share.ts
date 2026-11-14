export function eventUrl(appUrl: string, slug: string): string {
  return `${appUrl.replace(/\/+$/, "")}/e/${slug}`;
}

export function whatsappMessage(i: { name: string; dateLabel: string; url: string }): string {
  return `¡Hola! Ya puedes apartar tu lugar en "${i.name}" (${i.dateLabel}). Paga en segundos con CoDi desde tu celular: ${i.url}`;
}

export function whatsappLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
