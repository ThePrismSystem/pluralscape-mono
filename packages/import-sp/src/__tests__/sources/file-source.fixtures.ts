/** Build a synthetic SP export JSON for streaming-parser tests. */
export function buildExportJson(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

/** Encode a UTF-8 string to bytes. */
export function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
