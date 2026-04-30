/**
 * Catch-all PG schema helper used by RLS migration / cross-table integration tests.
 *
 * Builds every PG table in dependency order so RLS policies and migrations
 * can be exercised against the full database surface in a single PGlite
 * instance.
 *
 * Companion files: pg-helpers.ts, pg-helpers-schema.ts, pg-helpers-ddl.ts
 */

import { applyAllRls, type RlsExecutor } from "../../rls/apply.js";

import { PG_DDL } from "./pg-helpers-ddl.js";
import { pgExec } from "./pg-helpers-schema.js";

import type { PGlite } from "@electric-sql/pglite";

/**
 * Creates all PG tables in dependency order for comprehensive tests.
 * Needed for RLS migration testing that applies policies to every table.
 */
export async function createPgAllTables(client: PGlite): Promise<void> {
  // Base tables
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
  await pgExec(client, PG_DDL.biometricTokens);
  await pgExec(client, PG_DDL.biometricTokensIndexes);
  await pgExec(client, PG_DDL.systems);
  await pgExec(client, PG_DDL.systemsIndexes);
  // Members
  await pgExec(client, PG_DDL.members);
  await pgExec(client, PG_DDL.membersIndexes);
  await pgExec(client, PG_DDL.memberPhotos);
  await pgExec(client, PG_DDL.memberPhotosIndexes);
  // Privacy
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
  // Structure (must precede fronting — fronting_sessions FK → system_structure_entities)
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
  // Fronting
  await pgExec(client, PG_DDL.customFronts);
  await pgExec(client, PG_DDL.customFrontsIndexes);
  await pgExec(client, PG_DDL.frontingSessions);
  await pgExec(client, PG_DDL.frontingSessionsIndexes);
  await pgExec(client, PG_DDL.frontingComments);
  await pgExec(client, PG_DDL.frontingCommentsIndexes);
  await pgExec(client, PG_DDL.frontingReports);
  await pgExec(client, PG_DDL.frontingReportsIndexes);
  // Groups (must precede custom fields — field_values FK → groups)
  await pgExec(client, PG_DDL.groups);
  await pgExec(client, PG_DDL.groupsIndexes);
  await pgExec(client, PG_DDL.groupMemberships);
  await pgExec(client, PG_DDL.groupMembershipsIndexes);
  // Custom fields
  await pgExec(client, PG_DDL.fieldDefinitions);
  await pgExec(client, PG_DDL.fieldDefinitionsIndexes);
  await pgExec(client, PG_DDL.fieldDefinitionScopes);
  await pgExec(client, PG_DDL.fieldDefinitionScopesIndexes);
  await pgExec(client, PG_DDL.fieldValues);
  await pgExec(client, PG_DDL.fieldValuesIndexes);
  await pgExec(client, PG_DDL.fieldBucketVisibility);
  await pgExec(client, PG_DDL.fieldBucketVisibilityIndexes);
  // Settings
  await pgExec(client, PG_DDL.nomenclatureSettings);
  await pgExec(client, PG_DDL.nomenclatureSettingsIndexes);
  await pgExec(client, PG_DDL.systemSettings);
  await pgExec(client, PG_DDL.systemSettingsIndexes);
  // API keys, audit log
  await pgExec(client, PG_DDL.apiKeys);
  await pgExec(client, PG_DDL.apiKeysIndexes);
  await pgExec(client, PG_DDL.auditLog);
  await pgExec(client, PG_DDL.auditLogIndexes);
  // Lifecycle + Safe mode
  await pgExec(client, PG_DDL.lifecycleEvents);
  await pgExec(client, PG_DDL.lifecycleEventsIndexes);
  await pgExec(client, PG_DDL.safeModeContent);
  await pgExec(client, PG_DDL.safeModeContentIndexes);
  // Communication
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
  // Journal + Wiki
  await pgExec(client, PG_DDL.journalEntries);
  await pgExec(client, PG_DDL.journalEntriesIndexes);
  await pgExec(client, PG_DDL.wikiPages);
  await pgExec(client, PG_DDL.wikiPagesIndexes);
  // Innerworld
  await pgExec(client, PG_DDL.innerworldRegions);
  await pgExec(client, PG_DDL.innerworldRegionsIndexes);
  await pgExec(client, PG_DDL.innerworldEntities);
  await pgExec(client, PG_DDL.innerworldEntitiesIndexes);
  await pgExec(client, PG_DDL.innerworldCanvas);
  await pgExec(client, PG_DDL.innerworldCanvasIndexes);
  // PK bridge
  await pgExec(client, PG_DDL.pkBridgeConfigs);
  await pgExec(client, PG_DDL.pkBridgeConfigsIndexes);
  // Notifications
  await pgExec(client, PG_DDL.deviceTokens);
  await pgExec(client, PG_DDL.deviceTokensIndexes);
  await pgExec(client, PG_DDL.notificationConfigs);
  await pgExec(client, PG_DDL.notificationConfigsIndexes);
  await pgExec(client, PG_DDL.friendNotificationPreferences);
  await pgExec(client, PG_DDL.friendNotificationPreferencesIndexes);
  // Webhooks
  await pgExec(client, PG_DDL.webhookConfigs);
  await pgExec(client, PG_DDL.webhookConfigsIndexes);
  await pgExec(client, PG_DDL.webhookDeliveries);
  await pgExec(client, PG_DDL.webhookDeliveriesIndexes);
  // Blob + Timers
  await pgExec(client, PG_DDL.blobMetadata);
  await pgExec(client, PG_DDL.blobMetadataIndexes);
  await pgExec(client, PG_DDL.timerConfigs);
  await pgExec(client, PG_DDL.timerConfigsIndexes);
  await pgExec(client, PG_DDL.checkInRecords);
  await pgExec(client, PG_DDL.checkInRecordsIndexes);
  // Import/Export
  await pgExec(client, PG_DDL.importJobs);
  await pgExec(client, PG_DDL.importJobsIndexes);
  await pgExec(client, PG_DDL.importEntityRefs);
  await pgExec(client, PG_DDL.importEntityRefsIndexes);
  await pgExec(client, PG_DDL.exportRequests);
  await pgExec(client, PG_DDL.exportRequestsIndexes);
  await pgExec(client, PG_DDL.accountPurgeRequests);
  await pgExec(client, PG_DDL.accountPurgeRequestsIndexes);
  // Sync
  await pgExec(client, PG_DDL.syncDocuments);
  await pgExec(client, PG_DDL.syncDocumentsIndexes);
  await pgExec(client, PG_DDL.syncChanges);
  await pgExec(client, PG_DDL.syncChangesIndexes);
  await pgExec(client, PG_DDL.syncSnapshots);
  await pgExec(client, PG_DDL.syncSnapshotsIndexes);
  await pgExec(client, PG_DDL.syncConflicts);
  await pgExec(client, PG_DDL.syncConflictsIndexes);
  // Snapshots
  await pgExec(client, PG_DDL.systemSnapshots);
  await pgExec(client, PG_DDL.systemSnapshotsIndexes);
  // Key rotation
  await pgExec(client, PG_DDL.bucketKeyRotations);
  await pgExec(client, PG_DDL.bucketKeyRotationsIndexes);
  await pgExec(client, PG_DDL.bucketRotationItems);
  await pgExec(client, PG_DDL.bucketRotationItemsIndexes);
  // Search index (raw DDL, not via Drizzle)
  await pgExec(client, PG_DDL.searchIndex);
  await pgExec(client, PG_DDL.searchIndexIndexes);
}

/**
 * Opt-in helper: apply all RLS policies to a PGlite client.
 * Call after creating the tables you need for your test.
 */
export async function applyAllRlsToClient(client: PGlite): Promise<void> {
  const executor: RlsExecutor = {
    async execute(statement: string): Promise<void> {
      await client.query(statement);
    },
  };
  await applyAllRls(executor);
}
