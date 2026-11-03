/**
 * Display text for enum values.
 *
 * Purely presentational, so it lives on the client. The authoritative list of
 * which types exist and which category each belongs to comes from
 * `/api/taxonomy`, so this file cannot cause the picker to offer an invalid
 * value — an unmapped value simply falls back to a title-cased form.
 */
const OVERRIDES: Record<string, string> = {
  TSHIRT: 'T-Shirt',
  TANK_TOP: 'Tank Top',
  SPORTS_TOP: 'Sports Top',
  SPORTS_BOTTOM: 'Sports Bottom',
  PAJAMAS: 'Pyjamas',
  SUNGLASSES: 'Sunglasses',
  JEWELRY: 'Jewellery',
};

/** `SPORTS_TOP` -> `Sports Top`, `JEANS` -> `Jeans`. */
export function labelFor(value: string): string {
  const override = OVERRIDES[value];
  if (override) return override;

  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
