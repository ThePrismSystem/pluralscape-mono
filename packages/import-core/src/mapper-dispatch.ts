import type { MappingContext } from "./context.js";
import type { MapperResult } from "./mapper-result.js";
import type { ImportCollectionType } from "@pluralscape/types";

export interface SourceDocument {
  readonly sourceId: string;
  readonly document: unknown;
}

export interface BatchMapperOutput {
  readonly sourceEntityId: string;
  readonly result: MapperResult<unknown>;
}

export interface SingleMapperEntry {
  readonly entityType: ImportCollectionType;
  readonly map: (document: unknown, ctx: MappingContext) => MapperResult<unknown>;
}

export interface BatchMapperEntry {
  readonly entityType: ImportCollectionType;
  readonly batch: true;
  readonly mapBatch: (
    documents: readonly SourceDocument[],
    ctx: MappingContext,
  ) => readonly BatchMapperOutput[];
}

export type MapperDispatchEntry = SingleMapperEntry | BatchMapperEntry;

export function isBatchMapper(entry: MapperDispatchEntry): entry is BatchMapperEntry {
  return "batch" in entry && entry.batch;
}
