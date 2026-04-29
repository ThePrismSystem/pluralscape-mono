/**
 * Compile-time PG table registry — a single source of truth for every
 * Drizzle table value-export in `@pluralscape/db/pg`. Used by the
 * manifest-completeness type test (`__manifest-completeness__.type.test.ts`)
 * to bidirectionally verify that every table has a corresponding
 * `SotEntityManifest` entry (or is allow-listed as infrastructure).
 *
 * Adding a new PG table without a corresponding manifest entry — or, for
 * junction / infrastructure tables, without explicit allow-listing — fails
 * the parity check. This closes the "silent table drift" loophole where a
 * schema migration could land without a domain-type counterpart.
 *
 * Keep alphabetical by JS export name within each section.
 */

import { frontingReports } from "./analytics.js";
import { apiKeys } from "./api-keys.js";
import { auditLog } from "./audit-log.js";
import { accounts, authKeys, deviceTransferRequests, recoveryKeys, sessions } from "./auth.js";
import { biometricTokens } from "./biometric-tokens.js";
import { blobMetadata } from "./blob-metadata.js";
import {
  acknowledgements,
  boardMessages,
  channels,
  messages,
  notes,
  polls,
  pollVotes,
} from "./communication.js";
import {
  fieldBucketVisibility,
  fieldDefinitions,
  fieldDefinitionScopes,
  fieldValues,
} from "./custom-fields.js";
import { customFronts, frontingComments, frontingSessions } from "./fronting.js";
import { groupMemberships, groups } from "./groups.js";
import {
  accountPurgeRequests,
  exportRequests,
  importEntityRefs,
  importJobs,
} from "./import-export.js";
import { innerworldCanvas, innerworldEntities, innerworldRegions } from "./innerworld.js";
import { journalEntries, wikiPages } from "./journal.js";
import { bucketKeyRotations, bucketRotationItems } from "./key-rotation.js";
import { lifecycleEvents } from "./lifecycle-events.js";
import { memberPhotos, members } from "./members.js";
import { nomenclatureSettings } from "./nomenclature-settings.js";
import {
  deviceTokens,
  friendNotificationPreferences,
  notificationConfigs,
} from "./notifications.js";
import { pkBridgeConfigs } from "./pk-bridge.js";
import {
  bucketContentTags,
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  keyGrants,
} from "./privacy.js";
import { safeModeContent } from "./safe-mode-content.js";
import { searchEntries } from "./search.js";
import { systemSnapshots } from "./snapshots.js";
import {
  relationships,
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "./structure.js";
import { syncChanges, syncConflicts, syncDocuments, syncSnapshots } from "./sync.js";
import { systemSettings } from "./system-settings.js";
import { systems } from "./systems.js";
import { checkInRecords, timerConfigs } from "./timers.js";
import { webhookConfigs, webhookDeliveries } from "./webhooks.js";

/**
 * Registry of every PG table exported from `@pluralscape/db/pg`. The
 * `as const` form keeps the keyset literal so `keyof typeof
 * PG_TABLE_REGISTRY` is a precise string-literal union.
 */
export const PG_TABLE_REGISTRY = {
  accountPurgeRequests,
  accounts,
  acknowledgements,
  apiKeys,
  auditLog,
  authKeys,
  biometricTokens,
  blobMetadata,
  boardMessages,
  bucketContentTags,
  bucketKeyRotations,
  bucketRotationItems,
  buckets,
  channels,
  checkInRecords,
  customFronts,
  deviceTokens,
  deviceTransferRequests,
  exportRequests,
  fieldBucketVisibility,
  fieldDefinitionScopes,
  fieldDefinitions,
  fieldValues,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  friendNotificationPreferences,
  frontingComments,
  frontingReports,
  frontingSessions,
  groupMemberships,
  groups,
  importEntityRefs,
  importJobs,
  innerworldCanvas,
  innerworldEntities,
  innerworldRegions,
  journalEntries,
  keyGrants,
  lifecycleEvents,
  memberPhotos,
  members,
  messages,
  nomenclatureSettings,
  notes,
  notificationConfigs,
  pkBridgeConfigs,
  pollVotes,
  polls,
  recoveryKeys,
  relationships,
  safeModeContent,
  searchEntries,
  sessions,
  syncChanges,
  syncConflicts,
  syncDocuments,
  syncSnapshots,
  systemSettings,
  systemSnapshots,
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
  systems,
  timerConfigs,
  webhookConfigs,
  webhookDeliveries,
  wikiPages,
} as const;

/** Literal union of every PG table's JS variable name. */
export type PgTableName = keyof typeof PG_TABLE_REGISTRY;

/**
 * Allow-list of tables that intentionally have no `SotEntityManifest`
 * entry. Each entry must document why — typically junction tables,
 * server-internal infrastructure, or per-row visibility scopes that ride
 * on a parent entity's manifest entry rather than carrying their own
 * canonical chain.
 *
 * Adding a new table that fits one of these shapes goes here; everything
 * else needs a manifest entry.
 */
export type InfrastructureTableName =
  // Per-row visibility scopes for FieldValue (rides on FieldValue manifest).
  | "fieldBucketVisibility"
  // Membership junction (rides on Group manifest).
  | "groupMemberships"
  // Plural Kit bridge infrastructure — no domain type, server-only.
  | "pkBridgeConfigs"
  // Per-content-tag projection of bucket assignments (rides on PrivacyBucket).
  | "bucketContentTags"
  // Friend → bucket association junction (rides on PrivacyBucket / FriendConnection).
  | "friendBucketAssignments"
  // Server-side safe-mode override storage (no domain entity; UI flag).
  | "safeModeContent"
  // Biometric login token — server-only material, no domain projection.
  | "biometricTokens"
  // Sync-engine internals: Yjs change log, snapshots, conflict log.
  | "syncChanges"
  | "syncSnapshots"
  | "syncConflicts"
  // Full-text search index — server-only secondary index, no domain type.
  | "searchEntries";
