const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMxn(cents: number): string {
  return mxn.format(cents / 100);
}
