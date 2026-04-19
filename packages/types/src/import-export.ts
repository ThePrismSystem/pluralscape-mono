import type {
  AccountId,
  AccountPurgeRequestId,
  BlobId,
  BoardMessageId,
  BucketId,
  ChannelId,
  CustomFrontId,
  ExportRequestId,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  ImportEntityRefId,
  ImportJobId,
  JournalEntryId,
  MemberId,
  MessageId,
  NoteId,
  PollId,
  SystemId,
  TimerId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

// ── Import/Export types ─────────────────────────────────────────────
// Types for data import, export, and account management.
// Import payloads use plain string IDs and number timestamps
// (external format shapes, not internal branded types).

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
export type ImportSourceFormat = "simply-plural" | "pluralkit" | "pluralscape";

/** Status of an import job. */
export type ImportJobStatus = "pending" | "validating" | "importing" | "completed" | "failed";

/** Entity type for import error tracking. */
export type ImportEntityType =
  | "member"
  | "group"
  | "custom-front"
  | "fronting-session"
  | "fronting-comment"
  | "switch"
  | "custom-field"
  | "field-definition"
  | "field-value"
  | "note"
  | "journal-entry"
  | "chat-message"
  | "board-message"
  | "channel-category"
  | "channel"
  | "poll"
  | "timer"
  | "privacy-bucket"
  | "system-profile"
  | "system-settings"
  | "unknown";

/**
 * ImportEntityType minus "unknown". Used for collections the importer
 * actually traverses; "unknown" is reserved for error-log categorization
 * only.
 */
export type ImportCollectionType = Exclude<ImportEntityType, "unknown">;

/** Progress of an import job. */
export interface ImportProgress {
  readonly totalItems: number;
  readonly processedItems: number;
  readonly skippedItems: number;
  readonly errors: readonly ImportError[];
}

/**
 * Structured classification for import failures and warnings.
 *
 * Consumers (the engine, the final report, the mobile wizard UI) use this to
 * group issues by kind instead of parsing free-form message strings.
 */
export type ImportFailureKind =
  | "fk-miss"
  | "unknown-field"
  | "empty-name"
  | "dropped-collection"
  | "warnings-truncated"
  | "schema-mismatch"
  | "validation-failed"
  | "invalid-source-document";

interface ImportErrorBase {
  readonly entityType: ImportEntityType;
  readonly entityId: string | null;
  readonly message: string;
  readonly kind?: ImportFailureKind;
}

/**
 * An error that occurred during import. Discriminated on `fatal`:
 *
 * - Non-fatal errors are per-entity: log, skip, continue. Always resumable.
 * - Fatal errors halt the import. `recoverable: true` means the engine
 *   can resume from the last checkpoint. `recoverable: false` means the
 *   user must restart from scratch.
 */
export type ImportError =
  | (ImportErrorBase & { readonly fatal: false })
  | (ImportErrorBase & { readonly fatal: true; readonly recoverable: boolean });

/** An import job. */
export interface ImportJob {
  readonly id: ImportJobId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSourceFormat;
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
export type ImportCheckpointSchemaVersion = 2;

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

/**
 * Resumption state stored in `import_jobs.checkpoint_state`.
 *
 * The `schemaVersion` discriminator allows forward-compatible migration:
 * add `ImportCheckpointStateV3` as a union member when the shape changes.
 */
export interface ImportCheckpointStateV2 {
  readonly schemaVersion: 2;
  readonly checkpoint: {
    readonly completedCollections: readonly ImportCollectionType[];
    readonly currentCollection: ImportCollectionType;
    readonly currentCollectionLastSourceId: string | null;
    /**
     * True once at least one real privacy bucket has been persisted in
     * this import job (across any run — the flag is checkpointed). On
     * resume the engine reads this flag instead of inferring from
     * `completedCollections`, so mid-member-collection resumes do not
     * re-synthesize legacy buckets when the source had real ones.
     */
    readonly realPrivacyBucketsMapped: boolean;
  };
  readonly options: {
    readonly selectedCategories: Partial<Record<ImportCollectionType, boolean>>;
    readonly avatarMode: ImportAvatarMode;
  };
  readonly totals: {
    readonly perCollection: Partial<Record<ImportCollectionType, ImportCollectionTotals>>;
  };
}

export type ImportCheckpointState = ImportCheckpointStateV2;

interface ImportEntityRefBase {
  readonly id: ImportEntityRefId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSourceFormat;
  /** Opaque identifier from the source system (e.g., Mongo ObjectId for SP). */
  readonly sourceEntityId: string;
  readonly importedAt: UnixMillis;
}

/**
 * Maps each ImportEntityType to the branded Pluralscape ID it resolves to.
 * Used to type-scope `ImportEntityRef.pluralscapeEntityId` via a
 * discriminated union. "switch" and "unknown" resolve to raw string because
 * no dedicated branded IDs exist for those categories.
 */
export interface ImportEntityTargetIdMap {
  readonly member: MemberId;
  readonly group: GroupId;
  readonly "custom-front": CustomFrontId;
  readonly "fronting-session": FrontingSessionId;
  readonly "fronting-comment": FrontingCommentId;
  readonly switch: string;
  readonly "custom-field": FieldDefinitionId;
  readonly "field-definition": FieldDefinitionId;
  readonly "field-value": FieldValueId;
  readonly note: NoteId;
  readonly "journal-entry": JournalEntryId;
  readonly "chat-message": MessageId;
  readonly "board-message": BoardMessageId;
  readonly "channel-category": ChannelId;
  readonly channel: ChannelId;
  readonly poll: PollId;
  readonly timer: TimerId;
  readonly "privacy-bucket": BucketId;
  readonly "system-profile": SystemId;
  readonly "system-settings": SystemId;
  readonly unknown: string;
}

/**
 * A source-entity to target-entity mapping recorded during an import.
 * Enables idempotent re-imports and cross-device dedup.
 *
 * Discriminated on `sourceEntityType` so consumers get the correct branded
 * target ID via narrowing (no manual cast).
 */
export type ImportEntityRef = {
  [K in ImportEntityType]: ImportEntityRefBase & {
    readonly sourceEntityType: K;
    readonly pluralscapeEntityId: ImportEntityTargetIdMap[K];
  };
}[ImportEntityType];

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

// ── Canonical SSOT enum tuples ──────────────────────────────────────
// Imported by @pluralscape/db, @pluralscape/validation, and API router
// files. Never redefine these values anywhere else.

export const IMPORT_SOURCES = [
  "simply-plural",
  "pluralkit",
  "pluralscape",
] as const satisfies readonly ImportSourceFormat[];

export const IMPORT_JOB_STATUSES = [
  "pending",
  "validating",
  "importing",
  "completed",
  "failed",
] as const satisfies readonly ImportJobStatus[];

export const IMPORT_ENTITY_TYPES = [
  "member",
  "group",
  "custom-front",
  "fronting-session",
  "fronting-comment",
  "switch",
  "custom-field",
  "field-definition",
  "field-value",
  "note",
  "journal-entry",
  "chat-message",
  "board-message",
  "channel-category",
  "channel",
  "poll",
  "timer",
  "privacy-bucket",
  "system-profile",
  "system-settings",
  "unknown",
] as const satisfies readonly ImportEntityType[];

export const IMPORT_COLLECTION_TYPES = [
  "member",
  "group",
  "custom-front",
  "fronting-session",
  "fronting-comment",
  "switch",
  "custom-field",
  "field-definition",
  "field-value",
  "note",
  "journal-entry",
  "chat-message",
  "board-message",
  "channel-category",
  "channel",
  "poll",
  "timer",
  "privacy-bucket",
  "system-profile",
  "system-settings",
] as const satisfies readonly ImportCollectionType[];

export const IMPORT_AVATAR_MODES = [
  "api",
  "zip",
  "skip",
] as const satisfies readonly ImportAvatarMode[];

export const IMPORT_CHECKPOINT_SCHEMA_VERSION = 2 as const;
