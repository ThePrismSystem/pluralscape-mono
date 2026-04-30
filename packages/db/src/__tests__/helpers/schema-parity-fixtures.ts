/**
 * Shared fixtures for schema-type-parity tests.
 *
 * Centralises TABLE_PAIRS, KNOWN_*_INDEXES, KNOWN_FK_DIVERGENCES, and the
 * StructuralPair builder so that the split parity tests can iterate over
 * the same canonical set without duplicating ~340 lines of table wiring.
 */

import { getTableColumns } from "drizzle-orm";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";

import * as pg from "../../schema/pg/index.js";
import * as sqlite from "../../schema/sqlite/index.js";

// ---------------------------------------------------------------------------
// DB-only columns — present in schema but not in canonical domain types.
// These are internal persistence concerns (encryption, versioning, archival).
// ---------------------------------------------------------------------------
export const DB_ONLY_COLUMNS = new Set(["encryptedData", "version", "archived", "archivedAt"]);

// ---------------------------------------------------------------------------
// PG-only columns — present in PG but intentionally absent from SQLite.
// These support server-side concerns like partitioning (ADR 019).
// ---------------------------------------------------------------------------
export const PG_ONLY_COLUMNS: Record<string, Set<string>> = {
  frontingComments: new Set(["sessionStartTime"]),
};

// ---------------------------------------------------------------------------
// Table pairs shared between PG and SQLite.
// SQLite-only tables (jobs, search index) are intentionally excluded.
// ---------------------------------------------------------------------------
export const TABLE_PAIRS: Array<{
  name: string;
  pgTable: Record<string, { name: string }>;
  sqliteTable: Record<string, { name: string }>;
}> = [
  // Auth
  {
    name: "accounts",
    pgTable: getTableColumns(pg.accounts),
    sqliteTable: getTableColumns(sqlite.accounts),
  },
  {
    name: "authKeys",
    pgTable: getTableColumns(pg.authKeys),
    sqliteTable: getTableColumns(sqlite.authKeys),
  },
  {
    name: "sessions",
    pgTable: getTableColumns(pg.sessions),
    sqliteTable: getTableColumns(sqlite.sessions),
  },
  {
    name: "recoveryKeys",
    pgTable: getTableColumns(pg.recoveryKeys),
    sqliteTable: getTableColumns(sqlite.recoveryKeys),
  },
  {
    name: "deviceTransferRequests",
    pgTable: getTableColumns(pg.deviceTransferRequests),
    sqliteTable: getTableColumns(sqlite.deviceTransferRequests),
  },
  // Systems & Members
  {
    name: "systems",
    pgTable: getTableColumns(pg.systems),
    sqliteTable: getTableColumns(sqlite.systems),
  },
  {
    name: "members",
    pgTable: getTableColumns(pg.members),
    sqliteTable: getTableColumns(sqlite.members),
  },
  {
    name: "memberPhotos",
    pgTable: getTableColumns(pg.memberPhotos),
    sqliteTable: getTableColumns(sqlite.memberPhotos),
  },
  // Fronting
  {
    name: "frontingSessions",
    pgTable: getTableColumns(pg.frontingSessions),
    sqliteTable: getTableColumns(sqlite.frontingSessions),
  },
  {
    name: "customFronts",
    pgTable: getTableColumns(pg.customFronts),
    sqliteTable: getTableColumns(sqlite.customFronts),
  },
  {
    name: "frontingComments",
    pgTable: getTableColumns(pg.frontingComments),
    sqliteTable: getTableColumns(sqlite.frontingComments),
  },
  // Analytics
  {
    name: "frontingReports",
    pgTable: getTableColumns(pg.frontingReports),
    sqliteTable: getTableColumns(sqlite.frontingReports),
  },
  // Privacy
  {
    name: "buckets",
    pgTable: getTableColumns(pg.buckets),
    sqliteTable: getTableColumns(sqlite.buckets),
  },
  {
    name: "bucketContentTags",
    pgTable: getTableColumns(pg.bucketContentTags),
    sqliteTable: getTableColumns(sqlite.bucketContentTags),
  },
  {
    name: "keyGrants",
    pgTable: getTableColumns(pg.keyGrants),
    sqliteTable: getTableColumns(sqlite.keyGrants),
  },
  {
    name: "friendConnections",
    pgTable: getTableColumns(pg.friendConnections),
    sqliteTable: getTableColumns(sqlite.friendConnections),
  },
  {
    name: "friendCodes",
    pgTable: getTableColumns(pg.friendCodes),
    sqliteTable: getTableColumns(sqlite.friendCodes),
  },
  {
    name: "friendBucketAssignments",
    pgTable: getTableColumns(pg.friendBucketAssignments),
    sqliteTable: getTableColumns(sqlite.friendBucketAssignments),
  },
  // Config & Settings
  {
    name: "systemSettings",
    pgTable: getTableColumns(pg.systemSettings),
    sqliteTable: getTableColumns(sqlite.systemSettings),
  },
  {
    name: "nomenclatureSettings",
    pgTable: getTableColumns(pg.nomenclatureSettings),
    sqliteTable: getTableColumns(sqlite.nomenclatureSettings),
  },
  // API Keys
  {
    name: "apiKeys",
    pgTable: getTableColumns(pg.apiKeys),
    sqliteTable: getTableColumns(sqlite.apiKeys),
  },
  // Audit & Lifecycle
  {
    name: "auditLog",
    pgTable: getTableColumns(pg.auditLog),
    sqliteTable: getTableColumns(sqlite.auditLog),
  },
  {
    name: "lifecycleEvents",
    pgTable: getTableColumns(pg.lifecycleEvents),
    sqliteTable: getTableColumns(sqlite.lifecycleEvents),
  },
  // Communication
  {
    name: "channels",
    pgTable: getTableColumns(pg.channels),
    sqliteTable: getTableColumns(sqlite.channels),
  },
  {
    name: "messages",
    pgTable: getTableColumns(pg.messages),
    sqliteTable: getTableColumns(sqlite.messages),
  },
  {
    name: "boardMessages",
    pgTable: getTableColumns(pg.boardMessages),
    sqliteTable: getTableColumns(sqlite.boardMessages),
  },
  { name: "notes", pgTable: getTableColumns(pg.notes), sqliteTable: getTableColumns(sqlite.notes) },
  { name: "polls", pgTable: getTableColumns(pg.polls), sqliteTable: getTableColumns(sqlite.polls) },
  {
    name: "pollVotes",
    pgTable: getTableColumns(pg.pollVotes),
    sqliteTable: getTableColumns(sqlite.pollVotes),
  },
  {
    name: "acknowledgements",
    pgTable: getTableColumns(pg.acknowledgements),
    sqliteTable: getTableColumns(sqlite.acknowledgements),
  },
  // Custom Fields
  {
    name: "fieldDefinitions",
    pgTable: getTableColumns(pg.fieldDefinitions),
    sqliteTable: getTableColumns(sqlite.fieldDefinitions),
  },
  {
    name: "fieldValues",
    pgTable: getTableColumns(pg.fieldValues),
    sqliteTable: getTableColumns(sqlite.fieldValues),
  },
  {
    name: "fieldBucketVisibility",
    pgTable: getTableColumns(pg.fieldBucketVisibility),
    sqliteTable: getTableColumns(sqlite.fieldBucketVisibility),
  },
  {
    name: "fieldDefinitionScopes",
    pgTable: getTableColumns(pg.fieldDefinitionScopes),
    sqliteTable: getTableColumns(sqlite.fieldDefinitionScopes),
  },
  // Groups
  {
    name: "groups",
    pgTable: getTableColumns(pg.groups),
    sqliteTable: getTableColumns(sqlite.groups),
  },
  {
    name: "groupMemberships",
    pgTable: getTableColumns(pg.groupMemberships),
    sqliteTable: getTableColumns(sqlite.groupMemberships),
  },
  // Innerworld
  {
    name: "innerworldCanvas",
    pgTable: getTableColumns(pg.innerworldCanvas),
    sqliteTable: getTableColumns(sqlite.innerworldCanvas),
  },
  {
    name: "innerworldEntities",
    pgTable: getTableColumns(pg.innerworldEntities),
    sqliteTable: getTableColumns(sqlite.innerworldEntities),
  },
  {
    name: "innerworldRegions",
    pgTable: getTableColumns(pg.innerworldRegions),
    sqliteTable: getTableColumns(sqlite.innerworldRegions),
  },
  // Journal
  {
    name: "journalEntries",
    pgTable: getTableColumns(pg.journalEntries),
    sqliteTable: getTableColumns(sqlite.journalEntries),
  },
  {
    name: "wikiPages",
    pgTable: getTableColumns(pg.wikiPages),
    sqliteTable: getTableColumns(sqlite.wikiPages),
  },
  // Notifications
  {
    name: "deviceTokens",
    pgTable: getTableColumns(pg.deviceTokens),
    sqliteTable: getTableColumns(sqlite.deviceTokens),
  },
  {
    name: "friendNotificationPreferences",
    pgTable: getTableColumns(pg.friendNotificationPreferences),
    sqliteTable: getTableColumns(sqlite.friendNotificationPreferences),
  },
  {
    name: "notificationConfigs",
    pgTable: getTableColumns(pg.notificationConfigs),
    sqliteTable: getTableColumns(sqlite.notificationConfigs),
  },
  // PK Bridge
  {
    name: "pkBridgeConfigs",
    pgTable: getTableColumns(pg.pkBridgeConfigs),
    sqliteTable: getTableColumns(sqlite.pkBridgeConfigs),
  },
  // Safe Mode
  {
    name: "safeModeContent",
    pgTable: getTableColumns(pg.safeModeContent),
    sqliteTable: getTableColumns(sqlite.safeModeContent),
  },
  // Structure
  {
    name: "relationships",
    pgTable: getTableColumns(pg.relationships),
    sqliteTable: getTableColumns(sqlite.relationships),
  },
  {
    name: "systemStructureEntityTypes",
    pgTable: getTableColumns(pg.systemStructureEntityTypes),
    sqliteTable: getTableColumns(sqlite.systemStructureEntityTypes),
  },
  {
    name: "systemStructureEntities",
    pgTable: getTableColumns(pg.systemStructureEntities),
    sqliteTable: getTableColumns(sqlite.systemStructureEntities),
  },
  {
    name: "systemStructureEntityLinks",
    pgTable: getTableColumns(pg.systemStructureEntityLinks),
    sqliteTable: getTableColumns(sqlite.systemStructureEntityLinks),
  },
  {
    name: "systemStructureEntityMemberLinks",
    pgTable: getTableColumns(pg.systemStructureEntityMemberLinks),
    sqliteTable: getTableColumns(sqlite.systemStructureEntityMemberLinks),
  },
  {
    name: "systemStructureEntityAssociations",
    pgTable: getTableColumns(pg.systemStructureEntityAssociations),
    sqliteTable: getTableColumns(sqlite.systemStructureEntityAssociations),
  },
  // Blob Metadata
  {
    name: "blobMetadata",
    pgTable: getTableColumns(pg.blobMetadata),
    sqliteTable: getTableColumns(sqlite.blobMetadata),
  },
  // Timers
  {
    name: "timerConfigs",
    pgTable: getTableColumns(pg.timerConfigs),
    sqliteTable: getTableColumns(sqlite.timerConfigs),
  },
  {
    name: "checkInRecords",
    pgTable: getTableColumns(pg.checkInRecords),
    sqliteTable: getTableColumns(sqlite.checkInRecords),
  },
  // Webhooks
  {
    name: "webhookConfigs",
    pgTable: getTableColumns(pg.webhookConfigs),
    sqliteTable: getTableColumns(sqlite.webhookConfigs),
  },
  {
    name: "webhookDeliveries",
    pgTable: getTableColumns(pg.webhookDeliveries),
    sqliteTable: getTableColumns(sqlite.webhookDeliveries),
  },
  // Import/Export
  {
    name: "importJobs",
    pgTable: getTableColumns(pg.importJobs),
    sqliteTable: getTableColumns(sqlite.importJobs),
  },
  {
    name: "exportRequests",
    pgTable: getTableColumns(pg.exportRequests),
    sqliteTable: getTableColumns(sqlite.exportRequests),
  },
  {
    name: "accountPurgeRequests",
    pgTable: getTableColumns(pg.accountPurgeRequests),
    sqliteTable: getTableColumns(sqlite.accountPurgeRequests),
  },
  // Sync
  {
    name: "syncDocuments",
    pgTable: getTableColumns(pg.syncDocuments),
    sqliteTable: getTableColumns(sqlite.syncDocuments),
  },
  {
    name: "syncChanges",
    pgTable: getTableColumns(pg.syncChanges),
    sqliteTable: getTableColumns(sqlite.syncChanges),
  },
  {
    name: "syncSnapshots",
    pgTable: getTableColumns(pg.syncSnapshots),
    sqliteTable: getTableColumns(sqlite.syncSnapshots),
  },
  // Key Rotation
  {
    name: "bucketKeyRotations",
    pgTable: getTableColumns(pg.bucketKeyRotations),
    sqliteTable: getTableColumns(sqlite.bucketKeyRotations),
  },
  {
    name: "bucketRotationItems",
    pgTable: getTableColumns(pg.bucketRotationItems),
    sqliteTable: getTableColumns(sqlite.bucketRotationItems),
  },
];

// ---------------------------------------------------------------------------
// Index / FK / CHECK divergence allowlists.
// ---------------------------------------------------------------------------
export const KNOWN_PG_ONLY_INDEXES = new Set([
  // Denormalized session_start_time index for partitioned FK — not needed in SQLite
  "fronting_comments_session_start_idx",
  // PG serial column uses a simple seq index; SQLite integer uses system_id-prefixed index
  "sync_queue_seq_idx",
  // GIN index for JSONB voter extraction queries — not available in SQLite
  "poll_votes_voter_gin_idx",
]);

export const KNOWN_SQLITE_ONLY_INDEXES = new Set([
  // SQLite uses system_id-prefixed seq index (integer, not serial)
  "sync_queue_system_id_seq_idx",
  // SQLite uses partial unique indexes to emulate PG's nullsNotDistinct on UNIQUE constraints
  "system_structure_entity_links_entity_root_uniq",
  "system_structure_entity_member_links_member_root_uniq",
]);

export const KNOWN_FK_DIVERGENCES: Record<string, [number, number]> = {
  // SQLite adds an FK to fronting_sessions that PG can't enforce (non-partitioned FK ref)
  journalEntries: [1, 2],
};

export interface StructuralPair {
  name: string;
  pgIndexNames: string[];
  sqliteIndexNames: string[];
  pgFkCount: number;
  sqliteFkCount: number;
  pgCheckCount: number;
  sqliteCheckCount: number;
}

function buildStructuralPairs(): StructuralPair[] {
  const results: StructuralPair[] = [];

  for (const { name } of TABLE_PAIRS) {
    const pgTableObj = pg[name as keyof typeof pg];
    const sqlTableObj = sqlite[name as keyof typeof sqlite];
    if (typeof pgTableObj !== "object" || typeof sqlTableObj !== "object") continue;

    const pgConfig = getPgTableConfig(pgTableObj as Parameters<typeof getPgTableConfig>[0]);
    const sqlConfig = getSqliteTableConfig(
      sqlTableObj as Parameters<typeof getSqliteTableConfig>[0],
    );

    const pgIdxNames = pgConfig.indexes.map((i) => i.config.name);
    const sqlIdxNames = sqlConfig.indexes.map((i) => i.config.name);

    results.push({
      name,
      pgIndexNames: pgIdxNames.filter((n): n is string => typeof n === "string"),
      sqliteIndexNames: sqlIdxNames.filter((n): n is string => typeof n === "string"),
      pgFkCount: pgConfig.foreignKeys.length,
      sqliteFkCount: sqlConfig.foreignKeys.length,
      pgCheckCount: pgConfig.checks.length,
      sqliteCheckCount: sqlConfig.checks.length,
    });
  }

  return results;
}

export const STRUCTURAL_PAIRS = buildStructuralPairs();
