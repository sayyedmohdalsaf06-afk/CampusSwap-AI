/**
 * Small, pure formatting helpers shared across screens. Keeping these
 * side-effect free makes them trivial to unit-test and reuse.
 */

/**
 * Format a carbon-savings value stored in grams (gCO2e) as a human-readable
 * kilogram string, e.g. `12500` -> "12.5 kg" (design §4.2 Profile; Req 6.4,
 * 6.6 — values are directional estimates, labelled by the caller).
 *
 * - Converts grams -> kilograms (`grams / 1000`) with a single decimal place.
 * - Returns "0 kg" for null / undefined / zero so the profile never renders a
 *   blank or NaN value before any completed transactions exist.
 */
export function formatCarbonKg(grams: number | null | undefined): string {
  if (grams == null || grams === 0 || Number.isNaN(grams)) return "0 kg";
  const kg = grams / 1000;
  return `${kg.toFixed(1)} kg`;
}
