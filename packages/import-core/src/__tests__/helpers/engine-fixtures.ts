/**
 * Shared fixtures and helpers for import-engine split tests.
 *
 * Contains only things used by ≥2 split test files:
 *   - Shared constants (SIMPLE_DEPENDENCY_ORDER, SIMPLE_COLLECTION_TO_ENTITY_TYPE)
 *   - makeSimpleData() factory
 *   - simpleMapperDispatch
 *   - noopProgress
 *   - makeBatchSource() / makeBatchDispatch() — used in persister + checkpoint files
 */

import { mapped, failed, skipped } from "../../mapper-result.js";
import { createFakeImportSource } from "../../testing/fake-source.js";
import { createInMemoryPersister } from "../../testing/in-memory-persister.js";

import type { MappingContext } from "../../context.js";
import type {
  MapperDispatchEntry,
  BatchMapperEntry,
  SourceDocument,
  BatchMapperOutput,
} from "../../mapper-dispatch.js";
import type { SourceEvent, ImportDataSource } from "../../source.types.js";
import type { FakeSourceData } from "../../testing/fake-source.js";
import type { ImportCollectionType } from "@pluralscape/types";

// ---------------------------------------------------------------------------
// Re-export construction helpers so callers don't need to import testing/ directly
// ---------------------------------------------------------------------------

export { createFakeImportSource, createInMemoryPersister, mapped, failed, skipped };

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const SIMPLE_DEPENDENCY_ORDER = ["members", "groups"] as const;

export const SIMPLE_COLLECTION_TO_ENTITY_TYPE = (
  collection: string,
): ImportCollectionType => {
  const map: Record<string, ImportCollectionType> = {
    members: "member",
    groups: "group",
  };
  const entityType = map[collection];
  if (!entityType) throw new Error(`Unknown collection: ${collection}`);
  return entityType;
};

// ---------------------------------------------------------------------------
// Default data factories
// ---------------------------------------------------------------------------

export function makeSimpleData(): FakeSourceData {
  return {
    members: [
      { _id: "m1", name: "Aria" },
      { _id: "m2", name: "Blake" },
    ],
    groups: [
      { _id: "g1", label: "Front", memberRef: "m1" },
      { _id: "g2", label: "Core", memberRef: "m2" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Shared mapper dispatch
// ---------------------------------------------------------------------------

export const simpleMapperDispatch: Readonly<Record<string, MapperDispatchEntry>> = {
  members: {
    entityType: "member",
    map: (doc: unknown) => mapped(doc),
  },
  groups: {
    entityType: "group",
    map: (doc: unknown, ctx: MappingContext) => {
      const record = doc as Record<string, unknown>;
      const memberRef = record["memberRef"] as string | undefined;
      if (memberRef) {
        const resolved = ctx.translate("member", memberRef);
        if (!resolved)
          return failed({ kind: "fk-miss", message: `missing member ${memberRef}` });
      }
      return mapped(doc);
    },
  },
};

// ---------------------------------------------------------------------------
// Progress no-op
// ---------------------------------------------------------------------------

export const noopProgress = (): Promise<void> => Promise.resolve();

// ---------------------------------------------------------------------------
// Batch-path helpers (used by persister + checkpoint split files)
// ---------------------------------------------------------------------------

export const BATCH_DEPENDENCY_ORDER = ["items"] as const;
export const batchCollectionToEntityType = (): ImportCollectionType => "member";

export function makeBatchSource(docs: Record<string, unknown>[]): ImportDataSource {
  return {
    mode: "fake",
    async *iterate(): AsyncGenerator<SourceEvent> {
      await Promise.resolve();
      for (const doc of docs) {
        yield {
          kind: "doc",
          collection: "items",
          sourceId: doc["_id"] as string,
          document: doc,
        };
      }
    },
    listCollections: () => Promise.resolve(["items"]),
    close: () => Promise.resolve(),
  };
}

export function makeBatchDispatch(
  mapBatch: (
    docs: readonly SourceDocument[],
    ctx: MappingContext,
  ) => readonly BatchMapperOutput[],
): Readonly<Record<string, MapperDispatchEntry>> {
  return {
    items: { entityType: "member", batch: true, mapBatch } as BatchMapperEntry,
  };
}

/** Identity batch mapper — maps every doc through unchanged. */
export function makePassthroughBatchDispatch(): Readonly<Record<string, MapperDispatchEntry>> {
  return makeBatchDispatch((docs) =>
    docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
  );
}

/** Batch entry that maps all docs without modification, typed for direct use. */
export const passthroughBatchEntry: BatchMapperEntry = {
  entityType: "member",
  batch: true,
  mapBatch: (documents: readonly SourceDocument[]): readonly BatchMapperOutput[] =>
    documents.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
};
