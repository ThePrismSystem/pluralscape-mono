/**
 * G13: plaintext ServerMetadata ↔ Drizzle row parity gate (fleet-wide).
 *
 * For every plaintext manifest entry — i.e. one with no `result` slot
 * (Class A entities ride the encrypted G5 chain instead) — assert that
 * `Manifest[K]["server"]` exactly equals `InferSelectModel<<X>Table>`.
 *
 * Per-entity Drizzle parity tests in this directory already lock the
 * pairwise check. This sweep is the bidirectional safety net: if a new
 * plaintext entity's per-entity test is forgotten, this gate still
 * catches the drift via the manifest registry.
 *
 * Class C / D entities (ApiKey, Session, SystemSnapshot, CheckInRecord)
 * carry a `result` slot and use the encrypted-chain G5 gate — they are
 * filtered out below.
 */

import { describe, expectTypeOf, it } from "vitest";

import { PG_TABLE_REGISTRY } from "../../schema/pg/__table-registry__.js";

import type { Equal, SotEntityManifest, UnixMillis } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

/**
 * Flatten an `Archivable<T>` discriminated union to its underlying
 * Drizzle row shape: `archived: boolean` plus a nullable `archivedAt`.
 * Used to bridge manifest entries whose `server` slot is the
 * application-facing union (encoding the `(archived = true) =
 * (archivedAt IS NOT NULL)` CHECK at the type level) to the flat row
 * Drizzle returns. See ADR-023 § Archivable plaintext entities.
 */
type FlattenArchivable<T> = T extends { readonly archived: false }
  ? Omit<T, "archived"> & { readonly archived: boolean; readonly archivedAt: UnixMillis | null }
  : T extends { readonly archived: true; readonly archivedAt: UnixMillis }
    ? Omit<T, "archived" | "archivedAt"> & {
        readonly archived: boolean;
        readonly archivedAt: UnixMillis | null;
      }
    : T;

/**
 * Mapping from manifest key to the JS variable name in
 * `PG_TABLE_REGISTRY`. Mirrors the map in `__manifest-completeness__`
 * but is duplicated here to keep the per-gate dependencies explicit
 * (so a future split into separate files / packages does not couple
 * the two gates).
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

/**
 * Manifest keys for plaintext entities (no `result` slot). Class A
 * entities with a `result` slot ride the encrypted-chain G5 gate; their
 * server row is per-entity-asserted but not by this sweep.
 */
type PlaintextWithResultExcluded = {
  [K in keyof SotEntityManifest]: SotEntityManifest[K] extends { result: unknown } ? never : K;
}[keyof SotEntityManifest];

/**
 * Manifest keys whose `server` slot is a discriminated union the server
 * row collapses (e.g. `ImportEntityRef` narrows `pluralscapeEntityId`'s
 * brand by `sourceEntityType` — the row uses an unbranded `string`).
 *
 * These entities have a real structural divergence between manifest and
 * row that the Archivable bridge does not cover. Tracked as follow-up
 * to add per-entity flat-row helpers (see friend-code / notification-config
 * tests for the pattern).
 */
type DiscriminatedRowKey = "ImportEntityRef" | "ExportRequest";

/** Plaintext keys this sweep checks. */
type PlaintextManifestKey = Exclude<PlaintextWithResultExcluded, DiscriminatedRowKey>;

/**
 * For each plaintext manifest key, compare the manifest's `server` slot
 * to the inferred Drizzle row type. The table value is looked up via
 * `PG_TABLE_REGISTRY[ManifestKeyToTableName[K]]`, which carries the
 * literal table type (the registry is `as const`).
 *
 * Two derivation forms are accepted:
 *   1. Direct equality — `server` already matches the flat row.
 *   2. `Archivable<>`-flattened equality — entities whose application
 *      `server` is the discriminated union flatten to the flat row.
 */
type ServerRowParity<K extends PlaintextManifestKey> = SotEntityManifest[K] extends {
  server: infer S;
}
  ? Equal<S, InferSelectModel<(typeof PG_TABLE_REGISTRY)[ManifestKeyToTableName[K]]>> extends true
    ? true
    : Equal<
        FlattenArchivable<S>,
        InferSelectModel<(typeof PG_TABLE_REGISTRY)[ManifestKeyToTableName[K]]>
      >
  : never;

/** Manifest keys whose `server` slot diverges from the inferred Drizzle row. */
type Failures = {
  [K in PlaintextManifestKey]: ServerRowParity<K> extends true ? never : K;
}[PlaintextManifestKey];

describe("G13 — plaintext ServerMetadata ↔ Drizzle row parity (fleet)", () => {
  it("every plaintext manifest entry's server slot equals InferSelectModel<table>", () => {
    type FailureSentinel = [Failures] extends [never] ? "ok" : Failures;
    expectTypeOf<FailureSentinel>().toEqualTypeOf<"ok">();
  });
});
