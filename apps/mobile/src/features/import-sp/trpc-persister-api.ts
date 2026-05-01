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
import { defaultFetch } from "./trpc-persister-api.helpers.js";
import { buildBlobAndRefsSection } from "./trpc-persister-builders/blob-and-refs.js";
import { buildFrontingAndContentSection } from "./trpc-persister-builders/fronting-and-content.js";
import { buildMessagingAndGroupsSection } from "./trpc-persister-builders/messaging-and-groups.js";
import { buildSystemAndBucketsSection } from "./trpc-persister-builders/system-and-buckets.js";

import type { PersisterApi } from "./persister/persister.types.js";
import type { FetchFn, TRPCClientSubset } from "./trpc-persister-api.types.js";

export type { TRPCClientSubset, FetchFn } from "./trpc-persister-api.types.js";

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
