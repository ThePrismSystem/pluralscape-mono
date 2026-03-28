/**
 * Entity table registry for bucket data export.
 *
 * Unlike friend-export (which post-filters across multiple buckets), bucket
 * export queries a single bucket — entities are either tagged or not. The
 * query functions use INNER JOIN on bucket_content_tags for the specific
 * bucketId, eliminating post-query filtering.
 */
import {
  acknowledgements,
  boardMessages,
  bucketContentTags,
  channels,
  customFronts,
  fieldDefinitions,
  fieldValues,
  frontingComments,
  frontingSessions,
  groups,
  innerworldEntities,
  innerworldRegions,
  journalEntries,
  memberPhotos,
  members,
  messages,
  notes,
  polls,
  relationships,
  systemStructureEntities,
  systemStructureEntityTypes,
  wikiPages,
} from "@pluralscape/db/pg";
import { and, asc, countDistinct, eq, max } from "drizzle-orm";

import { exportRef, keysetAfter } from "../lib/export-table-ref.js";

import type { ExportTableRef } from "../lib/export-table-ref.js";
import type { DecodedCompositeCursor } from "../lib/pagination.js";
import type {
  BucketContentEntityType,
  BucketId,
  EncryptedBlob,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Row shapes ──────────────────────────────────────────────────────

/** Result of a manifest count query (single row per entity type). */
export interface BucketManifestCountResult {
  readonly count: number;
  readonly maxUpdatedAt: UnixMillis | null;
}

/** Row shape returned by bucket export page queries. */
export interface BucketExportRow {
  readonly id: string;
  readonly encryptedData: EncryptedBlob;
  readonly updatedAt: UnixMillis;
}

// ── Query function interface ────────────────────────────────────────

/** Query functions for a single exportable entity type (bucket-scoped). */
export interface BucketExportQueryFns {
  /** Count entities tagged with the specific bucket via JOIN. */
  readonly queryManifestCount: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    bucketId: BucketId,
  ) => Promise<BucketManifestCountResult>;

  /** Fetch a page of entities tagged with the bucket, ordered by updatedAt ASC, id ASC. */
  readonly queryBucketExportRows: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    bucketId: BucketId,
    limit: number,
    cursor?: DecodedCompositeCursor,
  ) => Promise<BucketExportRow[]>;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Build bucket export query functions for a single entity table.
 *
 * Key difference from friend-export: INNER JOIN on bucket_content_tags
 * with eq(bucketId, :bucketId) instead of inArray(bucketId, friendBucketIds).
 * This targets a single bucket — no post-query filtering needed.
 */
function makeBucketExportQueryFns(
  ref: ExportTableRef,
  entityType: BucketContentEntityType,
): BucketExportQueryFns {
  const {
    table,
    id: idCol,
    systemId: systemIdCol,
    encryptedData: encryptedDataCol,
    updatedAt: updatedAtCol,
    archived: archivedCol,
  } = ref;

  return {
    async queryManifestCount(tx, systemId, bucketId) {
      const conds: SQL[] = [eq(systemIdCol, systemId), eq(bucketContentTags.bucketId, bucketId)];
      if (archivedCol) conds.push(eq(archivedCol, false));

      const [result] = await tx
        .select({
          count: countDistinct(idCol),
          maxUpdatedAt: max(updatedAtCol),
        })
        .from(table)
        .innerJoin(
          bucketContentTags,
          and(
            eq(bucketContentTags.entityId, idCol),
            eq(bucketContentTags.systemId, systemIdCol),
            eq(bucketContentTags.entityType, entityType),
          ),
        )
        .where(and(...conds));

      return {
        count: result?.count ?? 0,
        maxUpdatedAt: (result?.maxUpdatedAt ?? null) as UnixMillis | null,
      };
    },

    async queryBucketExportRows(tx, systemId, bucketId, limit, cursor) {
      const conds: SQL[] = [eq(systemIdCol, systemId), eq(bucketContentTags.bucketId, bucketId)];
      if (archivedCol) conds.push(eq(archivedCol, false));
      if (cursor) conds.push(keysetAfter(updatedAtCol, idCol, cursor));

      const rows = await tx
        .select({ id: idCol, encryptedData: encryptedDataCol, updatedAt: updatedAtCol })
        .from(table)
        .innerJoin(
          bucketContentTags,
          and(
            eq(bucketContentTags.entityId, idCol),
            eq(bucketContentTags.systemId, systemIdCol),
            eq(bucketContentTags.entityType, entityType),
          ),
        )
        .where(and(...conds))
        .orderBy(asc(updatedAtCol), asc(idCol))
        .limit(limit + 1);

      return rows as BucketExportRow[];
    },
  };
}

// ── Registry ────────────────────────────────────────────────────────

/** Exhaustive registry mapping every BucketContentEntityType to its query functions. */
export const BUCKET_EXPORT_TABLE_REGISTRY: Record<BucketContentEntityType, BucketExportQueryFns> = {
  member: makeBucketExportQueryFns(exportRef(members), "member"),
  group: makeBucketExportQueryFns(exportRef(groups), "group"),
  channel: makeBucketExportQueryFns(exportRef(channels), "channel"),
  message: makeBucketExportQueryFns(exportRef(messages), "message"),
  note: makeBucketExportQueryFns(exportRef(notes), "note"),
  poll: makeBucketExportQueryFns(exportRef(polls), "poll"),
  relationship: makeBucketExportQueryFns(exportRef(relationships), "relationship"),
  "structure-entity-type": makeBucketExportQueryFns(
    exportRef(systemStructureEntityTypes),
    "structure-entity-type",
  ),
  "structure-entity": makeBucketExportQueryFns(
    exportRef(systemStructureEntities),
    "structure-entity",
  ),
  "journal-entry": makeBucketExportQueryFns(exportRef(journalEntries), "journal-entry"),
  "wiki-page": makeBucketExportQueryFns(exportRef(wikiPages), "wiki-page"),
  "custom-front": makeBucketExportQueryFns(exportRef(customFronts), "custom-front"),
  "fronting-session": makeBucketExportQueryFns(exportRef(frontingSessions), "fronting-session"),
  "board-message": makeBucketExportQueryFns(exportRef(boardMessages), "board-message"),
  acknowledgement: makeBucketExportQueryFns(exportRef(acknowledgements), "acknowledgement"),
  "innerworld-entity": makeBucketExportQueryFns(exportRef(innerworldEntities), "innerworld-entity"),
  "innerworld-region": makeBucketExportQueryFns(exportRef(innerworldRegions), "innerworld-region"),
  "field-definition": makeBucketExportQueryFns(exportRef(fieldDefinitions), "field-definition"),
  "field-value": makeBucketExportQueryFns(exportRef(fieldValues), "field-value"),
  "member-photo": makeBucketExportQueryFns(exportRef(memberPhotos), "member-photo"),
  "fronting-comment": makeBucketExportQueryFns(exportRef(frontingComments), "fronting-comment"),
};
