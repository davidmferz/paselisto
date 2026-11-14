/** Eyebrow above the price: prices of $1 or less are flagged as demo. */
export function priceEyebrow(priceCents: number): string {
  return priceCents <= 100 ? "PRECIO DE DEMOSTRACIÓN" : "PRECIO";
}
