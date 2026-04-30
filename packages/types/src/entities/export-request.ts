import type { AccountId, BlobId, BucketId, ExportRequestId, MemberId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

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

/**
 * `ExportRequestServerMetadata` is the server-side row shape for an
 * export request. Identity case — the domain already exposes everything
 * the server tracks; no `ServerInternal<T>` fields needed.
 */
export type ExportRequestServerMetadata = ExportRequest;

/**
 * `ExportRequestWire` is the JSON-serialized HTTP shape returned by
 * export-request endpoints. Derived from `ExportRequestServerMetadata`
 * via `Serialize<>` for canonical-chain consistency.
 */
export type ExportRequestWire = Serialize<ExportRequestServerMetadata>;

/** Format for member reports. */
export type ReportFormat = "html" | "pdf";

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
