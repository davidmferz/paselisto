export function toMxn(cents: number): number {
  if (!Number.isInteger(cents)) throw new Error(`cents must be an integer, got ${cents}`);
  return cents / 100;
}

export function toCents(mxn: number): number {
  return Math.round(mxn * 100);
}
