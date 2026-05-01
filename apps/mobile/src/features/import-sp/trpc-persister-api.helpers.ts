/**
 * Network and crypto helpers for the trpc PersisterApi bridge. Extracted to
 * keep the orchestrator file under the LOC ceiling.
 */

/**
 * Compute a SHA-256 hex digest of the given bytes.
 *
 * Copies `bytes` into a fresh `ArrayBuffer` because the TS lib types
 * `Uint8Array.buffer` as `ArrayBufferLike` (includes `SharedArrayBuffer`),
 * which is incompatible with `SubtleCrypto`'s `BufferSource` parameter.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  const arr = new Uint8Array(digest);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Wrap globalThis.fetch to match the narrow `FetchFn` signature from
 * `./trpc-persister-api.types.js`. Copies the body into a fresh ArrayBuffer
 * for the same reason as {@link sha256Hex}.
 */
export function defaultFetch(
  url: string,
  init: { method: string; body: Uint8Array; headers: Record<string, string> },
): Promise<{ ok: boolean; status: number }> {
  const copy = new ArrayBuffer(init.body.byteLength);
  new Uint8Array(copy).set(init.body);
  return globalThis
    .fetch(url, {
      method: init.method,
      body: copy,
      headers: init.headers,
    })
    .then((r) => ({ ok: r.ok, status: r.status }));
}
