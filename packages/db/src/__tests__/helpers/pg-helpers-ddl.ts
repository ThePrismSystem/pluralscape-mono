/**
 * DDL definitions for PGlite integration tests, generated from Drizzle schema objects.
 *
 * Table DDL and indexes are produced by `pgTableToCreateDDL` / `pgTableToIndexDDL`
 * from `schema-to-ddl.ts`.  Only the search index (tsvector + trigger) stays
 * hand-written because PGlite doesn't support GENERATED ALWAYS AS.
 *
 * Companion files: pg-helpers-schema.ts, pg-helpers.ts
 */

import { frontingReports } from "../../schema/pg/analytics.js";
import { apiKeys } from "../../schema/pg/api-keys.js";
import { auditLog } from "../../schema/pg/audit-log.js";
import {
  accounts,
  authKeys,
  deviceTransferRequests,
  recoveryKeys,
  sessions,
} from "../../schema/pg/auth.js";
import { biometricTokens } from "../../schema/pg/biometric-tokens.js";
import { blobMetadata } from "../../schema/pg/blob-metadata.js";
import {
  acknowledgements,
  boardMessages,
  channels,
  messages,
  notes,
  polls,
  pollVotes,
} from "../../schema/pg/communication.js";
import {
  fieldBucketVisibility,
  fieldDefinitions,
  fieldDefinitionScopes,
  fieldValues,
} from "../../schema/pg/custom-fields.js";
import { customFronts, frontingComments, frontingSessions } from "../../schema/pg/fronting.js";
import { groupMemberships, groups } from "../../schema/pg/groups.js";
import {
  accountPurgeRequests,
  exportRequests,
  importEntityRefs,
  importJobs,
} from "../../schema/pg/import-export.js";
import {
  innerworldCanvas,
  innerworldEntities,
  innerworldRegions,
} from "../../schema/pg/innerworld.js";
import { journalEntries, wikiPages } from "../../schema/pg/journal.js";
import { bucketKeyRotations, bucketRotationItems } from "../../schema/pg/key-rotation.js";
import { lifecycleEvents } from "../../schema/pg/lifecycle-events.js";
import { memberPhotos, members } from "../../schema/pg/members.js";
import { nomenclatureSettings } from "../../schema/pg/nomenclature-settings.js";
import {
  deviceTokens,
  friendNotificationPreferences,
  notificationConfigs,
} from "../../schema/pg/notifications.js";
import { pkBridgeConfigs } from "../../schema/pg/pk-bridge.js";
import {
  bucketContentTags,
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  keyGrants,
} from "../../schema/pg/privacy.js";
import { safeModeContent } from "../../schema/pg/safe-mode-content.js";
import { systemSnapshots } from "../../schema/pg/snapshots.js";
import {
  relationships,
  systemStructureEntityAssociations,
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "../../schema/pg/structure.js";
import { syncChanges, syncConflicts, syncDocuments, syncSnapshots } from "../../schema/pg/sync.js";
import { systemSettings } from "../../schema/pg/system-settings.js";
import { systems } from "../../schema/pg/systems.js";
import { checkInRecords, timerConfigs } from "../../schema/pg/timers.js";
import { webhookConfigs, webhookDeliveries } from "../../schema/pg/webhooks.js";

import { pgTableToCreateDDL, pgTableToIndexDDL } from "./schema-to-ddl.js";

import type { PgTable } from "drizzle-orm/pg-core";

/** Generate only CREATE INDEX statements as a single semicolon-separated string. */
function indexDDL(table: PgTable): string {
  return pgTableToIndexDDL(table).join(";\n");
}

export const PG_DDL = {
  // --- Auth ---
  accounts: pgTableToCreateDDL(accounts),
  accountsIndexes: indexDDL(accounts),
  authKeys: pgTableToCreateDDL(authKeys),
  authKeysIndexes: indexDDL(authKeys),
  sessions: pgTableToCreateDDL(sessions),
  sessionsIndexes: indexDDL(sessions),
  recoveryKeys: pgTableToCreateDDL(recoveryKeys),
  recoveryKeysIndexes: indexDDL(recoveryKeys),
  deviceTransferRequests: pgTableToCreateDDL(deviceTransferRequests),
  deviceTransferRequestsIndexes: indexDDL(deviceTransferRequests),
  biometricTokens: pgTableToCreateDDL(biometricTokens),
  biometricTokensIndexes: indexDDL(biometricTokens),
  // --- Systems & Members ---
  systems: pgTableToCreateDDL(systems),
  systemsIndexes: indexDDL(systems),
  members: pgTableToCreateDDL(members),
  membersIndexes: indexDDL(members),
  memberPhotos: pgTableToCreateDDL(memberPhotos),
  memberPhotosIndexes: indexDDL(memberPhotos),
  // --- Privacy ---
  buckets: pgTableToCreateDDL(buckets),
  bucketsIndexes: indexDDL(buckets),
  bucketContentTags: pgTableToCreateDDL(bucketContentTags),
  bucketContentTagsIndexes: indexDDL(bucketContentTags),
  keyGrants: pgTableToCreateDDL(keyGrants),
  keyGrantsIndexes: indexDDL(keyGrants),
  friendConnections: pgTableToCreateDDL(friendConnections),
  friendConnectionsIndexes: indexDDL(friendConnections),
  friendCodes: pgTableToCreateDDL(friendCodes),
  friendCodesIndexes: indexDDL(friendCodes),
  friendBucketAssignments: pgTableToCreateDDL(friendBucketAssignments),
  friendBucketAssignmentsIndexes: indexDDL(friendBucketAssignments),
  // --- Fronting ---
  frontingSessions: pgTableToCreateDDL(frontingSessions),
  frontingSessionsIndexes: indexDDL(frontingSessions),
  customFronts: pgTableToCreateDDL(customFronts),
  customFrontsIndexes: indexDDL(customFronts),
  frontingComments: pgTableToCreateDDL(frontingComments),
  frontingCommentsIndexes: indexDDL(frontingComments),
  // --- Structure ---
  relationships: pgTableToCreateDDL(relationships),
  relationshipsIndexes: indexDDL(relationships),
  systemStructureEntityTypes: pgTableToCreateDDL(systemStructureEntityTypes),
  systemStructureEntityTypesIndexes: indexDDL(systemStructureEntityTypes),
  systemStructureEntities: pgTableToCreateDDL(systemStructureEntities),
  systemStructureEntitiesIndexes: indexDDL(systemStructureEntities),
  systemStructureEntityLinks: pgTableToCreateDDL(systemStructureEntityLinks),
  systemStructureEntityLinksIndexes: indexDDL(systemStructureEntityLinks),
  systemStructureEntityMemberLinks: pgTableToCreateDDL(systemStructureEntityMemberLinks),
  systemStructureEntityMemberLinksIndexes: indexDDL(systemStructureEntityMemberLinks),
  systemStructureEntityAssociations: pgTableToCreateDDL(systemStructureEntityAssociations),
  systemStructureEntityAssociationsIndexes: indexDDL(systemStructureEntityAssociations),
  // --- Custom Fields ---
  fieldDefinitions: pgTableToCreateDDL(fieldDefinitions),
  fieldDefinitionsIndexes: indexDDL(fieldDefinitions),
  fieldValues: pgTableToCreateDDL(fieldValues),
  fieldValuesIndexes: indexDDL(fieldValues),
  fieldBucketVisibility: pgTableToCreateDDL(fieldBucketVisibility),
  fieldBucketVisibilityIndexes: indexDDL(fieldBucketVisibility),
  fieldDefinitionScopes: pgTableToCreateDDL(fieldDefinitionScopes),
  fieldDefinitionScopesIndexes: indexDDL(fieldDefinitionScopes),
  // --- Settings ---
  nomenclatureSettings: pgTableToCreateDDL(nomenclatureSettings),
  nomenclatureSettingsIndexes: indexDDL(nomenclatureSettings),
  systemSettings: pgTableToCreateDDL(systemSettings),
  systemSettingsIndexes: indexDDL(systemSettings),
  // --- API Keys & Audit ---
  apiKeys: pgTableToCreateDDL(apiKeys),
  apiKeysIndexes: indexDDL(apiKeys),
  auditLog: pgTableToCreateDDL(auditLog),
  auditLogIndexes: indexDDL(auditLog),
  // --- Lifecycle & Safe Mode ---
  lifecycleEvents: pgTableToCreateDDL(lifecycleEvents),
  lifecycleEventsIndexes: indexDDL(lifecycleEvents),
  safeModeContent: pgTableToCreateDDL(safeModeContent),
  safeModeContentIndexes: indexDDL(safeModeContent),
  // --- Communication ---
  channels: pgTableToCreateDDL(channels),
  channelsIndexes: indexDDL(channels),
  messages: pgTableToCreateDDL(messages),
  messagesIndexes: indexDDL(messages),
  boardMessages: pgTableToCreateDDL(boardMessages),
  boardMessagesIndexes: indexDDL(boardMessages),
  notes: pgTableToCreateDDL(notes),
  notesIndexes: indexDDL(notes),
  polls: pgTableToCreateDDL(polls),
  pollsIndexes: indexDDL(polls),
  pollVotes: pgTableToCreateDDL(pollVotes),
  pollVotesIndexes: indexDDL(pollVotes),
  acknowledgements: pgTableToCreateDDL(acknowledgements),
  acknowledgementsIndexes: indexDDL(acknowledgements),
  // --- Journal & Wiki ---
  journalEntries: pgTableToCreateDDL(journalEntries),
  journalEntriesIndexes: indexDDL(journalEntries),
  wikiPages: pgTableToCreateDDL(wikiPages),
  // wikiPages indexes include the unique slug index — no separate key needed
  wikiPagesIndexes: indexDDL(wikiPages),
  // --- Groups ---
  groups: pgTableToCreateDDL(groups),
  groupsIndexes: indexDDL(groups),
  groupMemberships: pgTableToCreateDDL(groupMemberships),
  groupMembershipsIndexes: indexDDL(groupMemberships),
  // --- Innerworld ---
  innerworldRegions: pgTableToCreateDDL(innerworldRegions),
  innerworldRegionsIndexes: indexDDL(innerworldRegions),
  innerworldEntities: pgTableToCreateDDL(innerworldEntities),
  innerworldEntitiesIndexes: indexDDL(innerworldEntities),
  innerworldCanvas: pgTableToCreateDDL(innerworldCanvas),
  innerworldCanvasIndexes: indexDDL(innerworldCanvas),
  // --- PK Bridge ---
  pkBridgeConfigs: pgTableToCreateDDL(pkBridgeConfigs),
  pkBridgeConfigsIndexes: indexDDL(pkBridgeConfigs),
  // --- Notifications ---
  deviceTokens: pgTableToCreateDDL(deviceTokens),
  deviceTokensIndexes: indexDDL(deviceTokens),
  notificationConfigs: pgTableToCreateDDL(notificationConfigs),
  notificationConfigsIndexes: indexDDL(notificationConfigs),
  friendNotificationPreferences: pgTableToCreateDDL(friendNotificationPreferences),
  friendNotificationPreferencesIndexes: indexDDL(friendNotificationPreferences),
  // --- Snapshots ---
  systemSnapshots: pgTableToCreateDDL(systemSnapshots),
  systemSnapshotsIndexes: indexDDL(systemSnapshots),
  // --- Webhooks ---
  webhookConfigs: pgTableToCreateDDL(webhookConfigs),
  webhookConfigsIndexes: indexDDL(webhookConfigs),
  webhookDeliveries: pgTableToCreateDDL(webhookDeliveries),
  webhookDeliveriesIndexes: indexDDL(webhookDeliveries),
  // --- Blobs ---
  blobMetadata: pgTableToCreateDDL(blobMetadata),
  blobMetadataIndexes: indexDDL(blobMetadata),
  // --- Timers ---
  timerConfigs: pgTableToCreateDDL(timerConfigs),
  timerConfigsIndexes: indexDDL(timerConfigs),
  checkInRecords: pgTableToCreateDDL(checkInRecords),
  checkInRecordsIndexes: indexDDL(checkInRecords),
  // --- Import/Export ---
  importJobs: pgTableToCreateDDL(importJobs),
  importJobsIndexes: indexDDL(importJobs),
  importEntityRefs: pgTableToCreateDDL(importEntityRefs),
  importEntityRefsIndexes: indexDDL(importEntityRefs),
  exportRequests: pgTableToCreateDDL(exportRequests),
  exportRequestsIndexes: indexDDL(exportRequests),
  accountPurgeRequests: pgTableToCreateDDL(accountPurgeRequests),
  accountPurgeRequestsIndexes: indexDDL(accountPurgeRequests),
  // --- Sync ---
  syncDocuments: pgTableToCreateDDL(syncDocuments),
  syncDocumentsIndexes: indexDDL(syncDocuments),
  syncChanges: pgTableToCreateDDL(syncChanges),
  syncChangesIndexes: indexDDL(syncChanges),
  syncSnapshots: pgTableToCreateDDL(syncSnapshots),
  syncSnapshotsIndexes: indexDDL(syncSnapshots),
  syncConflicts: pgTableToCreateDDL(syncConflicts),
  syncConflictsIndexes: indexDDL(syncConflicts),
  // --- Key Rotation ---
  bucketKeyRotations: pgTableToCreateDDL(bucketKeyRotations),
  bucketKeyRotationsIndexes: indexDDL(bucketKeyRotations),
  bucketRotationItems: pgTableToCreateDDL(bucketRotationItems),
  bucketRotationItemsIndexes: indexDDL(bucketRotationItems),
  // --- Analytics ---
  frontingReports: pgTableToCreateDDL(frontingReports),
  frontingReportsIndexes: indexDDL(frontingReports),
  // --- Search Index (manual DDL — uses tsvector trigger, not GENERATED) ---
  searchIndex: `
    CREATE TABLE IF NOT EXISTS search_index (
      system_id VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(50) NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      search_vector tsvector,
      PRIMARY KEY (system_id, entity_type, entity_id)
    )
  `,
  searchIndexTrigger: `
    CREATE OR REPLACE FUNCTION search_index_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `,
  searchIndexTriggerAttach: `
    CREATE TRIGGER search_index_vector_trigger
      BEFORE INSERT OR UPDATE ON search_index
      FOR EACH ROW EXECUTE FUNCTION search_index_vector_update()
  `,
  searchIndexIndexes: `
    CREATE INDEX IF NOT EXISTS search_index_vector_idx ON search_index USING GIN (search_vector);
    CREATE INDEX IF NOT EXISTS search_index_system_entity_type_idx ON search_index (system_id, entity_type)
  `,
} as const;
