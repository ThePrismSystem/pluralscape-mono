/**
 * Bridge between the PersisterApi interface and a vanilla tRPC client.
 *
 * Each PersisterApi method maps to one or more tRPC procedure calls,
 * reshaping arguments where the tRPC input schema differs from the
 * PersisterApi signature (entity ID field names, nested routers,
 * batch grouping, multi-step blob uploads).
 *
 * Per-domain section builders live under `trpc-persister-builders/` to keep
 * this orchestrator file under the area LOC ceiling.
 */
import { buildBlobAndRefsSection } from "./trpc-persister-builders/blob-and-refs.js";
import { buildFrontingAndContentSection } from "./trpc-persister-builders/fronting-and-content.js";
import { buildMessagingAndGroupsSection } from "./trpc-persister-builders/messaging-and-groups.js";
import { buildSystemAndBucketsSection } from "./trpc-persister-builders/system-and-buckets.js";

import type { PersisterApi } from "./persister/persister.types.js";
import type { FetchFn, TRPCClientSubset } from "./trpc-persister-api.types.js";

/**
 * Wrap globalThis.fetch to match the narrow `FetchFn` signature. Copies the
 * body into a fresh `ArrayBuffer` because the TS lib types `Uint8Array.buffer`
 * as `ArrayBufferLike` (includes `SharedArrayBuffer`), which is incompatible
 * with `BodyInit` in some environments.
 */
function defaultFetch(
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

/**
 * Create a PersisterApi backed by vanilla tRPC client calls.
 *
 * @param client - Vanilla tRPC client (structural subset)
 * @param fetchImpl - Optional fetch override for blob S3 uploads (defaults to globalThis.fetch)
 */
export function createTRPCPersisterApi(
  client: TRPCClientSubset,
  fetchImpl?: FetchFn,
): PersisterApi {
  const doFetch: FetchFn = fetchImpl ?? defaultFetch;

  return {
    ...buildSystemAndBucketsSection(client),
    ...buildFrontingAndContentSection(client),
    ...buildMessagingAndGroupsSection(client),
    ...buildBlobAndRefsSection(client, doFetch),
  };
}
