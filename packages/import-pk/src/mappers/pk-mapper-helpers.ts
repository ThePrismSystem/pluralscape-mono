/**
 * Normalise a PK color string by ensuring it starts with `#`.
 * PK exports colours as bare hex (e.g. `"ff6b6b"`).
 */
export function normalisePkColor(raw: string): string {
  return raw.startsWith("#") ? raw : `#${raw}`;
}
