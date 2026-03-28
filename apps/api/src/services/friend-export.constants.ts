/**
 * Entity table registry for friend data export.
 *
 * Uses a factory function to generate typed query functions for each exportable
 * entity type, preserving drizzle custom type conversions (pgTimestamp → number,
 * pgEncryptedBlob → EncryptedBlob) via concrete column references in closures.
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
import { and, asc, countDistinct, eq, gt, inArray, max, or } from "drizzle-orm";

import type { DecodedCompositeCursor } from "../lib/pagination.js";
import type {
  BucketId,
  EncryptedBlob,
  FriendExportEntityType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Row shapes ──────────────────────────────────────────────────────

/** Result of a manifest count query (single row per entity type). */
export interface ManifestCountResult {
  readonly count: number;
  readonly maxUpdatedAt: UnixMillis | null;
}

/** Row shape returned by export page queries. */
export interface ExportRow {
  readonly id: string;
  readonly encryptedData: EncryptedBlob;
  readonly updatedAt: UnixMillis;
}

// ── Query function interface ────────────────────────────────────────

/** Query functions for a single exportable entity type. */
export interface ExportQueryFns {
  /** Count bucket-visible entities via JOIN (single efficient query). */
  readonly queryManifestCount: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    friendBucketIds: readonly BucketId[],
  ) => Promise<ManifestCountResult>;

  /** Fetch a page of entities ordered by updatedAt ASC, id ASC. */
  readonly queryExportRows: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    limit: number,
    cursor?: DecodedCompositeCursor,
  ) => Promise<ExportRow[]>;
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Keyset "after" condition for cursor pagination.
 *
 * Produces: (sortCol > cursor.sortValue) OR (sortCol = cursor.sortValue AND idCol > cursor.id)
 * The `or()` call with two defined arguments always returns SQL, never undefined.
 */
function keysetAfter(sortCol: PgColumn, idCol: PgColumn, cursor: DecodedCompositeCursor): SQL {
  return or(
    gt(sortCol, cursor.sortValue),
    and(eq(sortCol, cursor.sortValue), gt(idCol, cursor.id)),
  ) as SQL;
}

// ── Table reference ─────────────────────────────────────────────────

/**
 * Decomposed table reference separating PgTable (for `.from()`) from
 * individual column references (for `.select()`, `.where()`, etc.).
 *
 * This separation is needed because drizzle's `.from()` requires a
 * concrete PgTable type, while column references need PgColumn types
 * for query builder methods.
 */
interface ExportTableRef {
  readonly table: PgTable;
  readonly id: PgColumn;
  readonly systemId: PgColumn;
  readonly encryptedData: PgColumn;
  readonly updatedAt: PgColumn;
  readonly archived?: PgColumn;
}

/** Extract an ExportTableRef from a drizzle table with the required columns. */
function exportRef(
  t: PgTable & {
    id: PgColumn;
    systemId: PgColumn;
    encryptedData: PgColumn;
    updatedAt: PgColumn;
    archived?: PgColumn;
  },
): ExportTableRef {
  return {
    table: t,
    id: t.id,
    systemId: t.systemId,
    encryptedData: t.encryptedData,
    updatedAt: t.updatedAt,
    archived: t.archived,
  };
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Build export query functions for a single entity table.
 *
 * @param ref — decomposed table reference with PgTable + column refs
 * @param entityType — bucket content entity type string for tag JOIN
 */
function makeExportQueryFns(
  ref: ExportTableRef,
  entityType: FriendExportEntityType,
): ExportQueryFns {
  const {
    table,
    id: idCol,
    systemId: systemIdCol,
    encryptedData: encryptedDataCol,
    updatedAt: updatedAtCol,
    archived: archivedCol,
  } = ref;

  return {
    async queryManifestCount(tx, systemId, friendBucketIds) {
      if (friendBucketIds.length === 0) {
        return { count: 0, maxUpdatedAt: null };
      }

      const conds: SQL[] = [
        eq(systemIdCol, systemId),
        inArray(bucketContentTags.bucketId, friendBucketIds),
      ];
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

    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(systemIdCol, systemId)];
      if (archivedCol) conds.push(eq(archivedCol, false));
      if (cursor) conds.push(keysetAfter(updatedAtCol, idCol, cursor));

      const rows = await tx
        .select({ id: idCol, encryptedData: encryptedDataCol, updatedAt: updatedAtCol })
        .from(table)
        .where(and(...conds))
        .orderBy(asc(updatedAtCol), asc(idCol))
        .limit(limit);

      return rows as ExportRow[];
    },
  };
}

// ── Registry ────────────────────────────────────────────────────────

/** Exhaustive registry mapping every FriendExportEntityType to its query functions. */
export const EXPORT_TABLE_REGISTRY: Record<FriendExportEntityType, ExportQueryFns> = {
  member: makeExportQueryFns(exportRef(members), "member"),
  group: makeExportQueryFns(exportRef(groups), "group"),
  channel: makeExportQueryFns(exportRef(channels), "channel"),
  message: makeExportQueryFns(exportRef(messages), "message"),
  note: makeExportQueryFns(exportRef(notes), "note"),
  poll: makeExportQueryFns(exportRef(polls), "poll"),
  relationship: makeExportQueryFns(exportRef(relationships), "relationship"),
  "structure-entity-type": makeExportQueryFns(
    exportRef(systemStructureEntityTypes),
    "structure-entity-type",
  ),
  "structure-entity": makeExportQueryFns(exportRef(systemStructureEntities), "structure-entity"),
  "journal-entry": makeExportQueryFns(exportRef(journalEntries), "journal-entry"),
  "wiki-page": makeExportQueryFns(exportRef(wikiPages), "wiki-page"),
  "custom-front": makeExportQueryFns(exportRef(customFronts), "custom-front"),
  "fronting-session": makeExportQueryFns(exportRef(frontingSessions), "fronting-session"),
  "board-message": makeExportQueryFns(exportRef(boardMessages), "board-message"),
  acknowledgement: makeExportQueryFns(exportRef(acknowledgements), "acknowledgement"),
  "innerworld-entity": makeExportQueryFns(exportRef(innerworldEntities), "innerworld-entity"),
  "innerworld-region": makeExportQueryFns(exportRef(innerworldRegions), "innerworld-region"),
  "field-definition": makeExportQueryFns(exportRef(fieldDefinitions), "field-definition"),
  "field-value": makeExportQueryFns(exportRef(fieldValues), "field-value"),
  "member-photo": makeExportQueryFns(exportRef(memberPhotos), "member-photo"),
  "fronting-comment": makeExportQueryFns(exportRef(frontingComments), "fronting-comment"),
};
