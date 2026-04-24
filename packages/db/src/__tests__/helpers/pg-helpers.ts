/**
 * DDL for PGlite integration tests, generated from Drizzle schema objects.
 *
 * Table DDL and indexes are produced by `pgTableToCreateDDL` / `pgTableToIndexDDL`
 * from `schema-to-ddl.ts`.  Only the search index (tsvector + trigger) stays
 * hand-written because PGlite doesn't support GENERATED ALWAYS AS.
 */

import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";
import { brandId } from "@pluralscape/types";

import { applyAllRls, type RlsExecutor } from "../../rls/apply.js";
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

import type { PGlite } from "@electric-sql/pglite";
import type {
  AccountId,
  BucketId,
  ChannelId,
  EncryptedBlob,
  PollId,
  SystemId,
} from "@pluralscape/types";
import type { PgDatabase, PgQueryResultHKT, PgTable } from "drizzle-orm/pg-core";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/** Creates a minimal valid EncryptedBlob for test fixtures. */
export function testBlob(ciphertext: Uint8Array = new Uint8Array([1, 2, 3])): EncryptedBlob {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(0xaa);
  return {
    ciphertext,
    nonce,
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
  };
}

/** Creates a T2 EncryptedBlob with bucketId for test fixtures. */
export function testBlobT2(
  ciphertext: Uint8Array = new Uint8Array([4, 5, 6]),
  bucketId = brandId<BucketId>("test-bucket"),
): EncryptedBlob {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(0xbb);
  return {
    ciphertext,
    nonce,
    tier: 2,
    algorithm: "xchacha20-poly1305",
    keyVersion: 1,
    bucketId,
  };
}

export const MS_PER_DAY = 86_400_000;
export const TTL_RETENTION_DAYS = 30;

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

export async function pgInsertAccount(
  db: PgDatabase<PgQueryResultHKT, Record<string, unknown>>,
  id?: string,
): Promise<AccountId> {
  const resolvedId = brandId<AccountId>(id ?? crypto.randomUUID());
  const now = Date.now();
  await db.insert(accounts).values({
    id: resolvedId,
    emailHash: `hash_${crypto.randomUUID()}`,
    emailSalt: `salt_${crypto.randomUUID()}`,
    authKeyHash: new Uint8Array(32),
    kdfSalt: `kdf_${crypto.randomUUID()}`,
    encryptedMasterKey: new Uint8Array(72),
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function pgInsertSystem(
  db: PgDatabase<PgQueryResultHKT, Record<string, unknown>>,
  accountId: string,
  id?: string,
): Promise<SystemId> {
  const resolvedId = brandId<SystemId>(id ?? crypto.randomUUID());
  const now = Date.now();
  await db.insert(systems).values({
    id: resolvedId,
    accountId: brandId<AccountId>(accountId),
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
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

export async function pgInsertMember(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  id?: string,
): Promise<string> {
  const resolvedId = id ?? crypto.randomUUID();
  const now = Date.now();
  await db.insert(members).values({
    id: resolvedId,
    systemId,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function pgInsertChannel(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  opts: {
    id?: string;
    type?: "category" | "channel";
    parentId?: string | null;
    sortOrder?: number;
  } = {},
): Promise<ChannelId> {
  const id = brandId<ChannelId>(opts.id ?? crypto.randomUUID());
  const now = Date.now();
  await db.insert(channels).values({
    id,
    systemId: brandId<SystemId>(systemId),
    type: opts.type ?? "channel",
    parentId:
      opts.parentId === null || opts.parentId === undefined
        ? null
        : brandId<ChannelId>(opts.parentId),
    sortOrder: opts.sortOrder ?? 0,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function pgInsertPoll(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  opts: { id?: string } = {},
): Promise<PollId> {
  const id = brandId<PollId>(opts.id ?? crypto.randomUUID());
  const now = Date.now();
  await db.insert(polls).values({
    id,
    systemId: brandId<SystemId>(systemId),
    kind: "standard",
    encryptedData: testBlob(),
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    createdAt: now,
    updatedAt: now,
  });
  return id;
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
