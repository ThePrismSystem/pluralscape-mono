/**
 * Import entity ref lookup helpers for E2E entity assertions.
 *
 * Uses a structural interface for the tRPC client to avoid depending
 * on @trpc/client or @pluralscape/api directly.
 */
import { expect } from "vitest";

import type { ImportCollectionType, ImportSourceFormat, SystemId } from "@pluralscape/types";

/**
 * Minimal tRPC client shape required by ref lookup helpers.
 * Consumers pass the real TRPCClient; this interface captures only
 * the importEntityRef.lookupBatch procedure used here.
 */
export interface RefLookupTRPCClient {
  readonly importEntityRef: {
    readonly lookupBatch: {
      readonly mutate: (input: {
        systemId: SystemId;
        source: ImportSourceFormat;
        sourceEntityType: ImportCollectionType;
        sourceEntityIds: string[];
      }) => Promise<Record<string, string>>;
    };
  };
}

/**
 * Look up a batch of source IDs and return the mapping from source ID
 * to Pluralscape entity ID. Asserts that every source ID was resolved.
 */
export async function lookupRefs(
  trpc: RefLookupTRPCClient,
  systemId: SystemId,
  source: ImportSourceFormat,
  sourceEntityType: ImportCollectionType,
  sourceIds: readonly string[],
): Promise<Record<string, string>> {
  if (sourceIds.length === 0) return {};

  const result = await trpc.importEntityRef.lookupBatch.mutate({
    systemId,
    source,
    sourceEntityType,
    sourceEntityIds: [...sourceIds],
  });

  expect(
    Object.keys(result).length,
    `expected all ${String(sourceIds.length)} ${sourceEntityType} refs to be stored`,
  ).toBe(sourceIds.length);

  return result;
}

/**
 * Resolve a single source ID to a Pluralscape ID via lookupBatch.
 */
export async function lookupSingleRef(
  trpc: RefLookupTRPCClient,
  systemId: SystemId,
  source: ImportSourceFormat,
  sourceEntityType: ImportCollectionType,
  sourceId: string,
): Promise<string> {
  const result = await trpc.importEntityRef.lookupBatch.mutate({
    systemId,
    source,
    sourceEntityType,
    sourceEntityIds: [sourceId],
  });
  const psId = result[sourceId];
  expect(psId, `expected ref for ${sourceEntityType} ${sourceId} to exist`).toBeDefined();
  // The expect above guarantees psId is defined; narrow with a guard.
  if (psId === undefined) throw new Error("unreachable: ref lookup failed after assertion");
  return psId;
}

/**
 * Safely retrieve a Pluralscape ID from a ref lookup result.
 * Throws a descriptive error if the ref is missing.
 */
export function requireRef(refs: Record<string, string>, sourceId: string, label: string): string {
  const id = refs[sourceId];
  if (id === undefined) {
    throw new Error(`missing ref for ${label} sourceId=${sourceId}`);
  }
  return id;
}
