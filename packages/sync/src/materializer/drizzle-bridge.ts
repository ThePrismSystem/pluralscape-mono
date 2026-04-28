import * as cache from "@pluralscape/db/sqlite-client-cache";
import { getTableConfig } from "drizzle-orm/sqlite-core";


import type { SyncedEntityType } from "../strategies/crdt-strategies.js";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/**
 * Mapping from `SyncedEntityType` to its Drizzle SQLite cache table.
 * Replaces the schema portion of the legacy `ENTITY_TABLE_REGISTRY`.
 *
 * Every `SyncedEntityType` MUST have a cache table registered here.
 */
const ENTITY_TO_TABLE = {
  // ── system-core document ──────────────────────────────────────────
  system: cache.systems,
  "system-settings": cache.systemSettings,
  member: cache.members,
  "member-photo": cache.memberPhotos,
  group: cache.groups,
  "group-membership": cache.groupMemberships,
  "structure-entity-type": cache.systemStructureEntityTypes,
  "structure-entity": cache.systemStructureEntities,
  "structure-entity-link": cache.systemStructureEntityLinks,
  "structure-entity-member-link": cache.systemStructureEntityMemberLinks,
  "structure-entity-association": cache.systemStructureEntityAssociations,
  relationship: cache.relationships,
  "custom-front": cache.customFronts,
  "fronting-report": cache.frontingReports,
  "field-definition": cache.fieldDefinitions,
  "field-value": cache.fieldValues,
  "innerworld-entity": cache.innerworldEntities,
  "innerworld-region": cache.innerworldRegions,
  "innerworld-canvas": cache.innerworldCanvas,
  timer: cache.timerConfigs,
  "lifecycle-event": cache.lifecycleEvents,
  "webhook-config": cache.webhookConfigs,

  // ── fronting document ─────────────────────────────────────────────
  "fronting-session": cache.frontingSessions,
  "fronting-comment": cache.frontingComments,
  "check-in-record": cache.checkInRecords,

  // ── chat document ─────────────────────────────────────────────────
  channel: cache.channels,
  message: cache.messages,
  "board-message": cache.boardMessages,
  poll: cache.polls,
  "poll-option": cache.pollOptions,
  "poll-vote": cache.pollVotes,
  acknowledgement: cache.acknowledgements,

  // ── journal document ──────────────────────────────────────────────
  "journal-entry": cache.journalEntries,
  "wiki-page": cache.wikiPages,
  note: cache.notes,

  // ── privacy-config document ───────────────────────────────────────
  bucket: cache.buckets,
  "bucket-content-tag": cache.bucketContentTags,
  "friend-connection": cache.friendConnections,
  "friend-code": cache.friendCodes,
  "key-grant": cache.keyGrants,
  "field-bucket-visibility": cache.fieldBucketVisibility,
} as const satisfies Record<SyncedEntityType, SQLiteTable>;

export interface MaterializerTableMetadata {
  readonly tableName: string;
  readonly columnNames: readonly string[];
  readonly drizzleTable: SQLiteTable;
}

/**
 * Returns the materializer table metadata for an entity type, derived
 * from the Drizzle cache schema via `getTableConfig`.
 *
 * Throws if `entityType` has no registered cache table — every
 * `SyncedEntityType` should be present in `ENTITY_TO_TABLE`.
 */
export function getTableMetadataForEntityType(
  entityType: SyncedEntityType,
): MaterializerTableMetadata {
  const t = ENTITY_TO_TABLE[entityType];
  const config = getTableConfig(t);
  return {
    tableName: config.name,
    columnNames: config.columns.map((c) => c.name),
    drizzleTable: t,
  };
}

/**
 * Returns the Drizzle cache table for an entity type, or undefined when
 * the entity type is not registered (used by the DDL emitter to skip
 * non-cache-backed strategy entries).
 */
export function getTableForEntityType(entityType: SyncedEntityType): SQLiteTable | undefined {
  return ENTITY_TO_TABLE[entityType];
}

/** All cache tables in the registry, in `SyncedEntityType` enumeration order. */
export const ALL_CACHE_TABLES: readonly SQLiteTable[] = Object.values(ENTITY_TO_TABLE);
