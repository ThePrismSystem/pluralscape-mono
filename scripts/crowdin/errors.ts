/**
 * Normalizes an unknown thrown value into a string message. Callers use this
 * to surface diagnostic text from catch blocks without the repetitive
 * `err instanceof Error ? err.message : String(err)` inline check.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
