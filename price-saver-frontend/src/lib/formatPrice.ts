/**
 * Format a price as a whole number with commas and ₦ symbol.
 * e.g. 15000 → "₦15,000"
 */
export function formatPrice(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
