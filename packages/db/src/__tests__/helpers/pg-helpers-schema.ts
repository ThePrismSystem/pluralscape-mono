/**
 * PG schema-builder helpers for integration tests.
 *
 * Covers: createPg*Tables functions that stand up PGlite databases scoped to
 *   a single table family for each test suite, plus pgExec.
 *
 * Companion files: pg-helpers-ddl.ts, pg-helpers-all-tables.ts, pg-helpers.ts
 */

import { PG_DDL } from "./pg-helpers-ddl.js";

import type { PGlite } from "@electric-sql/pglite";

export async function pgExec(client: PGlite, sql: string): Promise<void> {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

async function createPgBaseTables(client: PGlite): Promise<void> {
  await pgExec(client, PG_DDL.accounts);
  await pgExec(client, PG_DDL.accountsIndexes);
  await pgExec(client, PG_DDL.systems);
  await pgExec(client, PG_DDL.systemsIndexes);
}

export async function createPgAuthTables(client: PGlite): Promise<void> {
  await pgExec(client, PG_DDL.accounts);
  await pgExec(client, PG_DDL.accountsIndexes);
  await pgExec(client, PG_DDL.authKeys);
  await pgExec(client, PG_DDL.authKeysIndexes);
  await pgExec(client, PG_DDL.sessions);
  await pgExec(client, PG_DDL.sessionsIndexes);
  await pgExec(client, PG_DDL.recoveryKeys);
  await pgExec(client, PG_DDL.recoveryKeysIndexes);
  await pgExec(client, PG_DDL.deviceTransferRequests);
  await pgExec(client, PG_DDL.deviceTransferRequestsIndexes);
}

export async function createPgSystemTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
}

export async function createPgMemberTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.memberPhotos);
  await pgExec(client, PG_DDL.memberPhotosIndexes);
}

export async function createPgPrivacyTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.bucketsIndexes);
  await pgExec(client, PG_DDL.bucketContentTags);
  await pgExec(client, PG_DDL.bucketContentTagsIndexes);
  await pgExec(client, PG_DDL.keyGrants);
  await pgExec(client, PG_DDL.keyGrantsIndexes);
  await pgExec(client, PG_DDL.friendConnections);
  await pgExec(client, PG_DDL.friendConnectionsIndexes);
  await pgExec(client, PG_DDL.friendCodes);
  await pgExec(client, PG_DDL.friendCodesIndexes);
  await pgExec(client, PG_DDL.friendBucketAssignments);
  await pgExec(client, PG_DDL.friendBucketAssignmentsIndexes);
}

export async function createPgFrontingTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.systemStructureEntityTypes);
  await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
  await pgExec(client, PG_DDL.systemStructureEntities);
  await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
  await pgExec(client, PG_DDL.customFronts);
  await pgExec(client, PG_DDL.customFrontsIndexes);
  await pgExec(client, PG_DDL.frontingSessions);
  await pgExec(client, PG_DDL.frontingSessionsIndexes);
  await pgExec(client, PG_DDL.frontingComments);
  await pgExec(client, PG_DDL.frontingCommentsIndexes);
}

export async function createPgStructureTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.relationships);
  await pgExec(client, PG_DDL.relationshipsIndexes);
  await pgExec(client, PG_DDL.systemStructureEntityTypes);
  await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
  await pgExec(client, PG_DDL.systemStructureEntities);
  await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
  await pgExec(client, PG_DDL.systemStructureEntityLinks);
  await pgExec(client, PG_DDL.systemStructureEntityLinksIndexes);
  await pgExec(client, PG_DDL.systemStructureEntityMemberLinks);
  await pgExec(client, PG_DDL.systemStructureEntityMemberLinksIndexes);
  await pgExec(client, PG_DDL.systemStructureEntityAssociations);
  await pgExec(client, PG_DDL.systemStructureEntityAssociationsIndexes);
  await pgExec(client, PG_DDL.notes);
  await pgExec(client, PG_DDL.notesIndexes);
}

export async function createPgCustomFieldsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.systemStructureEntityTypes);
  await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
  await pgExec(client, PG_DDL.systemStructureEntities);
  await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
  await pgExec(client, PG_DDL.groups);
  await pgExec(client, PG_DDL.groupsIndexes);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.bucketsIndexes);
  await pgExec(client, PG_DDL.fieldDefinitions);
  await pgExec(client, PG_DDL.fieldDefinitionsIndexes);
  await pgExec(client, PG_DDL.fieldDefinitionScopes);
  await pgExec(client, PG_DDL.fieldDefinitionScopesIndexes);
  await pgExec(client, PG_DDL.fieldValues);
  await pgExec(client, PG_DDL.fieldValuesIndexes);
  await pgExec(client, PG_DDL.fieldBucketVisibility);
  await pgExec(client, PG_DDL.fieldBucketVisibilityIndexes);
}

export async function createPgNomenclatureSettingsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.nomenclatureSettings);
  await pgExec(client, PG_DDL.nomenclatureSettingsIndexes);
}

export async function createPgSystemSettingsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.systemSettings);
  await pgExec(client, PG_DDL.systemSettingsIndexes);
}

export async function createPgApiKeysTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.apiKeys);
  await pgExec(client, PG_DDL.apiKeysIndexes);
}

export async function createPgAuditLogTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.auditLog);
  await pgExec(client, PG_DDL.auditLogIndexes);
}

export async function createPgLifecycleEventsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.lifecycleEvents);
  await pgExec(client, PG_DDL.lifecycleEventsIndexes);
}

export async function createPgSafeModeContentTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.safeModeContent);
  await pgExec(client, PG_DDL.safeModeContentIndexes);
}

export async function createPgCommunicationTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.channels);
  await pgExec(client, PG_DDL.channelsIndexes);
  await pgExec(client, PG_DDL.messages);
  await pgExec(client, PG_DDL.messagesIndexes);
  await pgExec(client, PG_DDL.boardMessages);
  await pgExec(client, PG_DDL.boardMessagesIndexes);
  await pgExec(client, PG_DDL.notes);
  await pgExec(client, PG_DDL.notesIndexes);
  await pgExec(client, PG_DDL.polls);
  await pgExec(client, PG_DDL.pollsIndexes);
  await pgExec(client, PG_DDL.pollVotes);
  await pgExec(client, PG_DDL.pollVotesIndexes);
  await pgExec(client, PG_DDL.acknowledgements);
  await pgExec(client, PG_DDL.acknowledgementsIndexes);
  // Webhook tables needed for dispatchWebhookEvent calls in communication services
  await pgExec(client, PG_DDL.apiKeys);
  await pgExec(client, PG_DDL.apiKeysIndexes);
  await pgExec(client, PG_DDL.webhookConfigs);
  await pgExec(client, PG_DDL.webhookConfigsIndexes);
  await pgExec(client, PG_DDL.webhookDeliveries);
  await pgExec(client, PG_DDL.webhookDeliveriesIndexes);
}

export async function createPgJournalTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.systemStructureEntityTypes);
  await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
  await pgExec(client, PG_DDL.systemStructureEntities);
  await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
  await pgExec(client, PG_DDL.customFronts);
  await pgExec(client, PG_DDL.customFrontsIndexes);
  await pgExec(client, PG_DDL.frontingSessions);
  await pgExec(client, PG_DDL.frontingSessionsIndexes);
  await pgExec(client, PG_DDL.journalEntries);
  await pgExec(client, PG_DDL.journalEntriesIndexes);
  await pgExec(client, PG_DDL.wikiPages);
  await pgExec(client, PG_DDL.wikiPagesIndexes);
}

export async function createPgGroupsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.groups);
  await pgExec(client, PG_DDL.groupsIndexes);
  await pgExec(client, PG_DDL.groupMemberships);
  await pgExec(client, PG_DDL.groupMembershipsIndexes);
}

export async function createPgInnerworldTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.innerworldRegions);
  await pgExec(client, PG_DDL.innerworldRegionsIndexes);
  await pgExec(client, PG_DDL.innerworldEntities);
  await pgExec(client, PG_DDL.innerworldEntitiesIndexes);
  await pgExec(client, PG_DDL.innerworldCanvas);
  await pgExec(client, PG_DDL.innerworldCanvasIndexes);
}

export async function createPgPkBridgeTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.pkBridgeConfigs);
  await pgExec(client, PG_DDL.pkBridgeConfigsIndexes);
}

export async function createPgSnapshotTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.systemSnapshots);
  await pgExec(client, PG_DDL.systemSnapshotsIndexes);
}

export async function createPgNotificationTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.friendConnections);
  await pgExec(client, PG_DDL.friendConnectionsIndexes);
  await pgExec(client, PG_DDL.deviceTokens);
  await pgExec(client, PG_DDL.deviceTokensIndexes);
  await pgExec(client, PG_DDL.notificationConfigs);
  await pgExec(client, PG_DDL.notificationConfigsIndexes);
  await pgExec(client, PG_DDL.friendNotificationPreferences);
  await pgExec(client, PG_DDL.friendNotificationPreferencesIndexes);
}

export async function createPgWebhookTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.apiKeys);
  await pgExec(client, PG_DDL.apiKeysIndexes);
  await pgExec(client, PG_DDL.webhookConfigs);
  await pgExec(client, PG_DDL.webhookConfigsIndexes);
  await pgExec(client, PG_DDL.webhookDeliveries);
  await pgExec(client, PG_DDL.webhookDeliveriesIndexes);
}

export async function createPgBlobMetadataTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.blobMetadata);
  await pgExec(client, PG_DDL.blobMetadataIndexes);
}

export async function createPgTimerTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.timerConfigs);
  await pgExec(client, PG_DDL.timerConfigsIndexes);
  await pgExec(client, PG_DDL.checkInRecords);
  await pgExec(client, PG_DDL.checkInRecordsIndexes);
}

export async function createPgImportExportTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.blobMetadata);
  await pgExec(client, PG_DDL.blobMetadataIndexes);
  await pgExec(client, PG_DDL.importJobs);
  await pgExec(client, PG_DDL.importJobsIndexes);
  await pgExec(client, PG_DDL.importEntityRefs);
  await pgExec(client, PG_DDL.importEntityRefsIndexes);
  await pgExec(client, PG_DDL.exportRequests);
  await pgExec(client, PG_DDL.exportRequestsIndexes);
  await pgExec(client, PG_DDL.accountPurgeRequests);
  await pgExec(client, PG_DDL.accountPurgeRequestsIndexes);
}

export async function createPgSyncTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.syncDocuments);
  await pgExec(client, PG_DDL.syncDocumentsIndexes);
  await pgExec(client, PG_DDL.syncChanges);
  await pgExec(client, PG_DDL.syncChangesIndexes);
  await pgExec(client, PG_DDL.syncSnapshots);
  await pgExec(client, PG_DDL.syncSnapshotsIndexes);
  await pgExec(client, PG_DDL.syncConflicts);
  await pgExec(client, PG_DDL.syncConflictsIndexes);
}

export async function createPgAnalyticsTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.frontingReports);
  await pgExec(client, PG_DDL.frontingReportsIndexes);
}

export async function createPgSearchIndexTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.searchIndex);
  // Trigger DDL contains $$ blocks with semicolons — execute directly to avoid pgExec splitting.
  await client.query(PG_DDL.searchIndexTrigger);
  await client.query(PG_DDL.searchIndexTriggerAttach);
  await pgExec(client, PG_DDL.searchIndexIndexes);
}

export async function createPgKeyRotationTables(client: PGlite): Promise<void> {
  await createPgBaseTables(client);
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.bucketsIndexes);
  await pgExec(client, PG_DDL.bucketKeyRotations);
  await pgExec(client, PG_DDL.bucketKeyRotationsIndexes);
  await pgExec(client, PG_DDL.bucketRotationItems);
  await pgExec(client, PG_DDL.bucketRotationItemsIndexes);
}
