/**
 * Fleet-wide manifest completeness check (bidirectional).
 *
 * Asserts at the type level that:
 *  1. Every `SotEntityManifest` key has a corresponding Drizzle table
 *     mapping (or is allow-listed as `never` for computed/aggregated
 *     entities).
 *  2. Every mapped table name is a real PG table (catches table renames
 *     that forgot to update the map).
 *  3. Every PG table is either mapped from a manifest key or appears in
 *     the `InfrastructureTableName` allow-list (catches new tables added
 *     without manifest registration).
 *
 * Closes the loop on manifest drift: adding a new Drizzle table now
 * fails CI unless either registered in the manifest or explicitly
 * allow-listed as infrastructure with a documented rationale.
 */

import { describe, expectTypeOf, it } from "vitest";

import {
  type InfrastructureTableName,
  type PgTableName,
} from "../../schema/pg/__table-registry__.js";

import type { Extends, SotEntityManifest } from "@pluralscape/types";

/**
 * Explicit mapping from manifest key to Drizzle table JS export name.
 *
 * Keys that intentionally have no Drizzle table use `never` (e.g. a
 * computed/aggregated report that exists only as a wire shape). Today,
 * every manifest entry has a backing table — but the `never` slot is
 * preserved for future computed entities so the bidirectional check can
 * encode "no table by design" without weakening the gate.
 */
type ManifestKeyToTableName = {
  readonly Member: "members";
  readonly AuditLogEntry: "auditLog";
  readonly Account: "accounts";
  readonly BlobMetadata: "blobMetadata";
  readonly System: "systems";
  readonly MemberPhoto: "memberPhotos";
  readonly Group: "groups";
  readonly CustomFront: "customFronts";
  readonly FieldDefinition: "fieldDefinitions";
  readonly FieldDefinitionScope: "fieldDefinitionScopes";
  readonly FieldValue: "fieldValues";
  readonly Relationship: "relationships";
  readonly StructureEntityType: "systemStructureEntityTypes";
  readonly StructureEntity: "systemStructureEntities";
  readonly FrontingSession: "frontingSessions";
  readonly FrontingComment: "frontingComments";
  readonly LifecycleEvent: "lifecycleEvents";
  readonly InnerworldRegion: "innerworldRegions";
  readonly InnerworldEntity: "innerworldEntities";
  readonly InnerworldCanvas: "innerworldCanvas";
  readonly SystemSettings: "systemSettings";
  readonly SystemSnapshot: "systemSnapshots";
  readonly StructureEntityMemberLink: "systemStructureEntityMemberLinks";
  readonly StructureEntityAssociation: "systemStructureEntityAssociations";
  readonly ApiKey: "apiKeys";
  readonly AuthKey: "authKeys";
  readonly DeviceToken: "deviceTokens";
  readonly RecoveryKey: "recoveryKeys";
  readonly AccountPurgeRequest: "accountPurgeRequests";
  readonly DeviceTransferRequest: "deviceTransferRequests";
  readonly Session: "sessions";
  readonly StructureEntityLink: "systemStructureEntityLinks";
  readonly Nomenclature: "nomenclatureSettings";
  readonly CheckInRecord: "checkInRecords";
  readonly Channel: "channels";
  readonly ChatMessage: "messages";
  readonly Note: "notes";
  readonly BoardMessage: "boardMessages";
  readonly Poll: "polls";
  readonly PollVote: "pollVotes";
  readonly AcknowledgementRequest: "acknowledgements";
  readonly TimerConfig: "timerConfigs";
  readonly JournalEntry: "journalEntries";
  readonly WikiPage: "wikiPages";
  readonly WebhookConfig: "webhookConfigs";
  readonly WebhookDelivery: "webhookDeliveries";
  readonly SyncDocument: "syncDocuments";
  readonly ImportJob: "importJobs";
  readonly ImportEntityRef: "importEntityRefs";
  readonly ExportRequest: "exportRequests";
  readonly PrivacyBucket: "buckets";
  readonly BucketKeyRotation: "bucketKeyRotations";
  readonly BucketRotationItem: "bucketRotationItems";
  readonly KeyGrant: "keyGrants";
  readonly NotificationConfig: "notificationConfigs";
  readonly FriendConnection: "friendConnections";
  readonly FriendCode: "friendCodes";
  readonly FriendNotificationPreference: "friendNotificationPreferences";
  readonly FrontingReport: "frontingReports";
};

/** All non-`never` table names referenced by the manifest map. */
type MappedTableNames = Extract<ManifestKeyToTableName[keyof SotEntityManifest], string>;

describe("SoT manifest completeness (fleet-wide bidirectional)", () => {
  it("every SotEntityManifest key has a ManifestKeyToTableName mapping", () => {
    expectTypeOf<keyof ManifestKeyToTableName>().toEqualTypeOf<keyof SotEntityManifest>();
  });

  it("every mapped table name is a real PG table (PgTableName)", () => {
    expectTypeOf<Extends<MappedTableNames, PgTableName>>().toEqualTypeOf<true>();
  });

  it("every PG table is either mapped from a manifest key or allow-listed as infrastructure", () => {
    expectTypeOf<
      Extends<PgTableName, MappedTableNames | InfrastructureTableName>
    >().toEqualTypeOf<true>();
  });

  it("MappedTableNames and InfrastructureTableName are disjoint", () => {
    // Any table that's allow-listed as infrastructure must not also be a
    // manifest mapping target — keeps the rationales canonical.
    type Overlap = MappedTableNames & InfrastructureTableName;
    expectTypeOf<Overlap>().toEqualTypeOf<never>();
  });
});
