/**
 * SQLite schema builder helpers for integration tests.
 *
 * Covers: createSqlite*Tables functions that stand up in-memory SQLite
 *   databases scoped to a single table family for each test suite.
 * Companion files: sqlite-helpers-ddl-auth-core.ts,
 *   sqlite-helpers-ddl-privacy-structure.ts,
 *   sqlite-helpers-ddl-comm-journal.ts,
 *   sqlite-helpers-ddl-ops-misc.ts, sqlite-helpers.ts
 */

import { SQLITE_DDL_AUTH_CORE } from "./sqlite-helpers-ddl-auth-core.js";
import { SQLITE_DDL_COMM_JOURNAL } from "./sqlite-helpers-ddl-comm-journal.js";
import { SQLITE_DDL_OPS_MISC } from "./sqlite-helpers-ddl-ops-misc.js";
import { SQLITE_DDL_PRIVACY_STRUCTURE } from "./sqlite-helpers-ddl-privacy-structure.js";

import type Database from "better-sqlite3";

// Merge all DDL partitions into one unified object so callers reference a
// single namespace (same shape as the original SQLITE_DDL).
const DDL = {
  ...SQLITE_DDL_AUTH_CORE,
  ...SQLITE_DDL_PRIVACY_STRUCTURE,
  ...SQLITE_DDL_COMM_JOURNAL,
  ...SQLITE_DDL_OPS_MISC,
};

function createSqliteBaseTables(client: InstanceType<typeof Database>): void {
  client.exec(DDL.accounts);
  client.exec(DDL.systems);
  client.exec(DDL.systemsIndexes);
}

export function createSqliteAuthTables(client: InstanceType<typeof Database>): void {
  client.exec(DDL.accounts);
  client.exec(DDL.authKeys);
  client.exec(DDL.sessions);
  client.exec(DDL.sessionsIndexes);
  client.exec(DDL.recoveryKeys);
  client.exec(DDL.recoveryKeysIndexes);
  client.exec(DDL.deviceTransferRequests);
  client.exec(DDL.deviceTransferRequestsIndexes);
}

export function createSqliteSystemTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
}

export function createSqliteMemberTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.memberPhotos);
  client.exec(DDL.memberPhotosIndexes);
}

export function createSqlitePrivacyTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.buckets);
  client.exec(DDL.bucketsIndexes);
  client.exec(DDL.bucketContentTags);
  client.exec(DDL.bucketContentTagsIndexes);
  client.exec(DDL.keyGrants);
  client.exec(DDL.keyGrantsIndexes);
  client.exec(DDL.friendConnections);
  client.exec(DDL.friendConnectionsIndexes);
  client.exec(DDL.friendCodes);
  client.exec(DDL.friendCodesIndexes);
  client.exec(DDL.friendBucketAssignments);
  client.exec(DDL.friendBucketAssignmentsIndexes);
}

export function createSqliteFrontingTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.systemStructureEntityTypes);
  client.exec(DDL.systemStructureEntityTypesIndexes);
  client.exec(DDL.systemStructureEntities);
  client.exec(DDL.systemStructureEntitiesIndexes);
  client.exec(DDL.customFronts);
  client.exec(DDL.customFrontsIndexes);
  client.exec(DDL.frontingSessions);
  client.exec(DDL.frontingSessionsIndexes);
  client.exec(DDL.frontingComments);
  client.exec(DDL.frontingCommentsIndexes);
}

export function createSqliteStructureTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.relationships);
  client.exec(DDL.relationshipsIndexes);
  client.exec(DDL.systemStructureEntityTypes);
  client.exec(DDL.systemStructureEntityTypesIndexes);
  client.exec(DDL.systemStructureEntities);
  client.exec(DDL.systemStructureEntitiesIndexes);
  client.exec(DDL.systemStructureEntityLinks);
  client.exec(DDL.systemStructureEntityLinksIndexes);
  client.exec(DDL.systemStructureEntityMemberLinks);
  client.exec(DDL.systemStructureEntityMemberLinksIndexes);
  client.exec(DDL.systemStructureEntityAssociations);
  client.exec(DDL.systemStructureEntityAssociationsIndexes);
}

export function createSqliteCustomFieldsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.systemStructureEntityTypes);
  client.exec(DDL.systemStructureEntityTypesIndexes);
  client.exec(DDL.systemStructureEntities);
  client.exec(DDL.systemStructureEntitiesIndexes);
  client.exec(DDL.groups);
  client.exec(DDL.groupsIndexes);
  client.exec(DDL.buckets);
  client.exec(DDL.bucketsIndexes);
  client.exec(DDL.fieldDefinitions);
  client.exec(DDL.fieldDefinitionsIndexes);
  client.exec(DDL.fieldDefinitionScopes);
  client.exec(DDL.fieldDefinitionScopesIndexes);
  client.exec(DDL.fieldValues);
  client.exec(DDL.fieldValuesIndexes);
  client.exec(DDL.fieldBucketVisibility);
  client.exec(DDL.fieldBucketVisibilityIndexes);
}

export function createSqliteNomenclatureSettingsTables(
  client: InstanceType<typeof Database>,
): void {
  createSqliteBaseTables(client);
  client.exec(DDL.nomenclatureSettings);
}

export function createSqliteSystemSettingsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.systemSettings);
}

export function createSqliteApiKeysTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.apiKeys);
  client.exec(DDL.apiKeysIndexes);
}

export function createSqliteAuditLogTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.auditLog);
  client.exec(DDL.auditLogIndexes);
}

export function createSqliteLifecycleEventsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.lifecycleEvents);
  client.exec(DDL.lifecycleEventsIndexes);
}

export function createSqliteSafeModeContentTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.safeModeContent);
  client.exec(DDL.safeModeContentIndexes);
}

export function createSqliteCommunicationTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.channels);
  client.exec(DDL.channelsIndexes);
  client.exec(DDL.messages);
  client.exec(DDL.messagesIndexes);
  client.exec(DDL.boardMessages);
  client.exec(DDL.boardMessagesIndexes);
  client.exec(DDL.notes);
  client.exec(DDL.notesIndexes);
  client.exec(DDL.polls);
  client.exec(DDL.pollsIndexes);
  client.exec(DDL.pollVotes);
  client.exec(DDL.pollVotesIndexes);
  client.exec(DDL.acknowledgements);
  client.exec(DDL.acknowledgementsIndexes);
}

export function createSqliteJournalTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.systemStructureEntityTypes);
  client.exec(DDL.systemStructureEntityTypesIndexes);
  client.exec(DDL.systemStructureEntities);
  client.exec(DDL.systemStructureEntitiesIndexes);
  client.exec(DDL.customFronts);
  client.exec(DDL.customFrontsIndexes);
  client.exec(DDL.frontingSessions);
  client.exec(DDL.frontingSessionsIndexes);
  client.exec(DDL.journalEntries);
  client.exec(DDL.journalEntriesIndexes);
  client.exec(DDL.wikiPages);
  client.exec(DDL.wikiPagesIndexes);
  client.exec(DDL.wikiPagesUniqueSlugIndex);
}

export function createSqliteGroupsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.groups);
  client.exec(DDL.groupsIndexes);
  client.exec(DDL.groupMemberships);
  client.exec(DDL.groupMembershipsIndexes);
}

export function createSqliteInnerworldTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.innerworldRegions);
  client.exec(DDL.innerworldRegionsIndexes);
  client.exec(DDL.innerworldEntities);
  client.exec(DDL.innerworldEntitiesIndexes);
  client.exec(DDL.innerworldCanvas);
}

export function createSqlitePkBridgeTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.pkBridgeConfigs);
  client.exec(DDL.pkBridgeConfigsIndexes);
}

export function createSqliteSnapshotTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.systemSnapshots);
  client.exec(DDL.systemSnapshotsIndexes);
}

export function createSqliteNotificationTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.buckets);
  client.exec(DDL.friendConnections);
  client.exec(DDL.friendConnectionsIndexes);
  client.exec(DDL.deviceTokens);
  client.exec(DDL.deviceTokensIndexes);
  client.exec(DDL.notificationConfigs);
  client.exec(DDL.notificationConfigsIndexes);
  client.exec(DDL.friendNotificationPreferences);
  client.exec(DDL.friendNotificationPreferencesIndexes);
}

export function createSqliteWebhookTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.apiKeys);
  client.exec(DDL.apiKeysIndexes);
  client.exec(DDL.webhookConfigs);
  client.exec(DDL.webhookConfigsIndexes);
  client.exec(DDL.webhookDeliveries);
  client.exec(DDL.webhookDeliveriesIndexes);
}

export function createSqliteBlobMetadataTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.buckets);
  client.exec(DDL.blobMetadata);
  client.exec(DDL.blobMetadataIndexes);
}

export function createSqliteTimerTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.members);
  client.exec(DDL.membersIndexes);
  client.exec(DDL.timerConfigs);
  client.exec(DDL.timerConfigsIndexes);
  client.exec(DDL.checkInRecords);
  client.exec(DDL.checkInRecordsIndexes);
}

export function createSqliteImportExportTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.buckets);
  client.exec(DDL.blobMetadata);
  client.exec(DDL.blobMetadataIndexes);
  client.exec(DDL.importJobs);
  client.exec(DDL.importJobsIndexes);
  client.exec(DDL.importEntityRefs);
  client.exec(DDL.importEntityRefsIndexes);
  client.exec(DDL.exportRequests);
  client.exec(DDL.exportRequestsIndexes);
  client.exec(DDL.accountPurgeRequests);
  client.exec(DDL.accountPurgeRequestsIndexes);
}

export function createSqliteSyncTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.syncDocuments);
  client.exec(DDL.syncDocumentsIndexes);
  client.exec(DDL.syncChanges);
  client.exec(DDL.syncChangesIndexes);
  client.exec(DDL.syncSnapshots);
  client.exec(DDL.syncSnapshotsIndexes);
}

export function createSqliteJobsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.jobs);
  client.exec(DDL.jobsIndexes);
}

export function createSqliteAnalyticsTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.frontingReports);
  client.exec(DDL.frontingReportsIndexes);
}

export function createSqliteKeyRotationTables(client: InstanceType<typeof Database>): void {
  createSqliteBaseTables(client);
  client.exec(DDL.buckets);
  client.exec(DDL.bucketsIndexes);
  client.exec(DDL.bucketKeyRotations);
  client.exec(DDL.bucketKeyRotationsIndexes);
  client.exec(DDL.bucketRotationItems);
  client.exec(DDL.bucketRotationItemsIndexes);
}
