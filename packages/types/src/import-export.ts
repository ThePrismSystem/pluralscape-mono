import type {
  AccountId,
  AccountPurgeRequestId,
  BlobId,
  BucketId,
  ExportRequestId,
  ImportEntityRefId,
  ImportJobId,
  MemberId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

// ── Import/Export types ─────────────────────────────────────────────
// Types for data import, export, and account management.
// Import payloads use plain string IDs and number timestamps
// (external format shapes, not internal branded types).

// ── Simply Plural import payloads ───────────────────────────────────

/** A member as represented in a Simply Plural export file. */
export interface SPImportMember {
  readonly id: string;
  readonly name: string;
  readonly pronouns: string | null;
  readonly description: string | null;
  readonly colors: readonly string[];
  readonly avatarUrl: string | null;
  readonly createdAt: number;
}

/** A group as represented in a Simply Plural export file. */
export interface SPImportGroup {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly memberIds: readonly string[];
}

/** A fronting session as represented in a Simply Plural export file. */
export interface SPImportFrontingSession {
  readonly memberId: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** A custom field definition from a Simply Plural export. */
export interface SPImportCustomField {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly type: string;
}

/** A custom field value from a Simply Plural export. */
export interface SPImportCustomFieldValue {
  readonly fieldId: string;
  readonly memberId: string;
  readonly value: string;
}

/** A note from a Simply Plural export. */
export interface SPImportNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly memberId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A chat message from a Simply Plural export. */
export interface SPImportChatMessage {
  readonly id: string;
  readonly senderId: string;
  readonly content: string;
  readonly createdAt: number;
}

/** A board message from a Simply Plural export. */
export interface SPImportBoardMessage {
  readonly id: string;
  readonly authorId: string;
  readonly content: string;
  readonly createdAt: number;
}

/** A poll from a Simply Plural export. */
export interface SPImportPoll {
  readonly id: string;
  readonly title: string;
  readonly options: readonly string[];
  readonly createdAt: number;
}

/** A timer from a Simply Plural export. */
export interface SPImportTimer {
  readonly id: string;
  readonly name: string;
  readonly duration: number;
  readonly createdAt: number;
}

/** A privacy bucket from a Simply Plural export. */
export interface SPImportPrivacyBucket {
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];
}

/** A friend connection from a Simply Plural export. */
export interface SPImportFriend {
  readonly id: string;
  /** The system ID on the Simply Plural side, not a Pluralscape account ID. */
  readonly externalFriendId: string;
  readonly addedAt: number;
}

/** Full Simply Plural import payload (raw MongoDB dump format). */
export interface SPImportPayload {
  readonly exportedAt: number;
  readonly members: readonly SPImportMember[];
  readonly groups: readonly SPImportGroup[];
  readonly frontingHistory: readonly SPImportFrontingSession[];
  readonly customFields: readonly SPImportCustomField[];
  readonly customFieldValues: readonly SPImportCustomFieldValue[];
  readonly notes: readonly SPImportNote[];
  readonly chatMessages: readonly SPImportChatMessage[];
  readonly boardMessages: readonly SPImportBoardMessage[];
  readonly polls: readonly SPImportPoll[];
  readonly timers: readonly SPImportTimer[];
  readonly privacyBuckets: readonly SPImportPrivacyBucket[];
  readonly friends: readonly SPImportFriend[];
}

// ── PluralKit import payloads ───────────────────────────────────────

/** A proxy tag from a PluralKit export. */
export interface PKProxyTag {
  readonly prefix: string | null;
  readonly suffix: string | null;
}

/** A member as represented in a PluralKit export file. */
export interface PKImportMember {
  readonly id: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly pronouns: string | null;
  readonly description: string | null;
  readonly color: string | null;
  readonly avatar_url: string | null;
  readonly proxy_tags: readonly PKProxyTag[];
  readonly created: string;
}

/** A group as represented in a PluralKit export file. */
export interface PKImportGroup {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly members: readonly string[];
}

/** A switch as represented in a PluralKit export file. */
export interface PKImportSwitch {
  readonly timestamp: string;
  readonly members: readonly string[];
}

/** Full PluralKit import payload (external format). */
export interface PKImportPayload {
  readonly version: number;
  readonly id: string;
  readonly name: string;
  readonly members: readonly PKImportMember[];
  readonly groups: readonly PKImportGroup[];
  readonly switches: readonly PKImportSwitch[];
}

// ── Import job tracking ─────────────────────────────────────────────

/** Source format for an import job. */
export type ImportSource = "simply-plural" | "pluralkit" | "pluralscape";

/** Status of an import job. */
export type ImportJobStatus = "pending" | "validating" | "importing" | "completed" | "failed";

/** Entity type for import error tracking. */
export type ImportEntityType =
  | "member"
  | "group"
  | "fronting-session"
  | "switch"
  | "custom-field"
  | "note"
  | "chat-message"
  | "board-message"
  | "poll"
  | "timer"
  | "privacy-bucket"
  | "friend"
  | "unknown";

/** Progress of an import job. */
export interface ImportProgress {
  readonly totalItems: number;
  readonly processedItems: number;
  readonly skippedItems: number;
  readonly errors: readonly ImportError[];
}

/** An error that occurred during import. */
export interface ImportError {
  readonly entityType: ImportEntityType;
  readonly entityId: string | null;
  readonly message: string;
  readonly fatal: boolean;
  /**
   * For fatal errors, whether resumption is possible from the last checkpoint.
   * Non-fatal errors should set this to false.
   *
   * true examples: SP token rejected (401), network unreachable after retries,
   * rate-limit exhaustion. User can retry from the last checkpoint.
   *
   * false examples: JSON parse error, persister write failure, disk full.
   * User must restart from scratch or fix an out-of-band issue.
   */
  readonly recoverable: boolean;
}

/** An import job. */
export interface ImportJob {
  readonly id: ImportJobId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSource;
  readonly status: ImportJobStatus;
  readonly progressPercent: number;
  readonly errorLog: readonly ImportError[] | null;
  readonly warningCount: number;
  readonly chunksTotal: number | null;
  readonly chunksCompleted: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
}

/** Schema version for `ImportCheckpointState`. Bumped when the shape changes. */
export type ImportCheckpointSchemaVersion = 1;

/** Avatar handling mode during an import. */
export type ImportAvatarMode = "api" | "zip" | "skip";

/** Per-collection running counts during an import. */
export interface ImportCollectionTotals {
  readonly total: number;
  readonly imported: number;
  readonly updated: number;
  readonly skipped: number;
  readonly failed: number;
}

/** Resumption state stored in `import_jobs.checkpoint_state`. */
export interface ImportCheckpointState {
  readonly schemaVersion: ImportCheckpointSchemaVersion;
  readonly checkpoint: {
    readonly completedCollections: readonly ImportEntityType[];
    readonly currentCollection: ImportEntityType;
    readonly currentCollectionLastSourceId: string | null;
  };
  readonly options: {
    readonly selectedCategories: Record<string, boolean>;
    readonly avatarMode: ImportAvatarMode;
  };
  readonly totals: {
    readonly perCollection: Partial<Record<ImportEntityType, ImportCollectionTotals>>;
  };
}

/** A source-entity to target-entity mapping recorded during an import.
 * Enables idempotent re-imports and cross-device dedup. */
export interface ImportEntityRef {
  readonly id: ImportEntityRefId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSource;
  readonly sourceEntityType: ImportEntityType;
  /** Opaque identifier from the source system (e.g., Mongo ObjectId for SP). */
  readonly sourceEntityId: string;
  /** The Pluralscape entity ID this source ID maps to. Not type-scoped — the
   * consumer must use `sourceEntityType` to cast to the correct branded ID. */
  readonly pluralscapeEntityId: string;
  readonly importedAt: UnixMillis;
}

// ── Export types ─────────────────────────────────────────────────────

/** Status of an export request. */
export type ExportRequestStatus = "pending" | "processing" | "completed" | "failed";

/** Format for an export manifest. */
export type ExportFormat = "json" | "csv";

/** Sections that can be included in an export. */
export type ExportSection =
  | "members"
  | "groups"
  | "fronting-history"
  | "journal"
  | "custom-fields"
  | "notes"
  | "chat"
  | "board-messages"
  | "privacy-buckets"
  | "system-structure"
  | "settings"
  | "polls"
  | "lifecycle-events";

/** Base type for downloadable report artifacts. */
export interface DownloadableReport {
  readonly generatedAt: UnixMillis;
  readonly sizeBytes: number;
  readonly downloadUrl: string;
  readonly expiresAt: UnixMillis;
}

/** Manifest describing an export package. */
export interface ExportManifest extends DownloadableReport {
  readonly systemId: SystemId;
  readonly format: ExportFormat;
  readonly sections: readonly ExportSection[];
}

/** An export request tracking record. */
export interface ExportRequest {
  readonly id: ExportRequestId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly format: ExportFormat;
  readonly status: ExportRequestStatus;
  readonly blobId: BlobId | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
}

// ── Account management ──────────────────────────────────────────────

/** Status of an account purge request. */
export type AccountPurgeStatus = "pending" | "confirmed" | "processing" | "completed" | "cancelled";

/** Format for member reports. */
export type ReportFormat = "html" | "pdf";

/** Request to purge an entire account and all associated data. */
export interface AccountPurgeRequest {
  readonly id: AccountPurgeRequestId;
  readonly accountId: AccountId;
  readonly status: AccountPurgeStatus;
  readonly confirmationPhrase: string;
  readonly requestedAt: UnixMillis;
  readonly confirmedAt: UnixMillis | null;
  readonly scheduledPurgeAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
  readonly cancelledAt: UnixMillis | null;
}

/** A downloadable report of a single member's data. */
export interface MemberReport extends DownloadableReport {
  readonly systemId: SystemId;
  readonly memberId: MemberId;
  readonly bucketId: BucketId;
  readonly format: ReportFormat;
}

/** A "Meet our system" overview report for sharing with friends/family. */
export interface SystemOverviewReport extends DownloadableReport {
  readonly systemId: SystemId;
  readonly bucketId: BucketId;
  readonly format: ReportFormat;
}
