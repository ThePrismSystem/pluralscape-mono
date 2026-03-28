import type { BucketId, SystemId } from "./ids.js";
import type { PaginatedResult } from "./pagination.js";
import type { BucketContentEntityType } from "./privacy.js";
import type { UnixMillis } from "./timestamps.js";

// ── Report type discriminant ──────────────────────────────────────

/** Supported report types for client-side report generation. */
export type ReportType = "member-by-bucket" | "meet-our-system";

/** Runtime array of all ReportType values. */
export const REPORT_TYPES = [
  "member-by-bucket",
  "meet-our-system",
] as const satisfies readonly ReportType[];

/** Type guard for ReportType — validates unknown strings at trust boundaries. */
export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

// ── Report config types (client → server) ─────────────────────────

/** Config for generating a member-by-bucket report. */
export interface MemberByBucketReportConfig {
  readonly reportType: "member-by-bucket";
  readonly bucketId: BucketId;
  readonly title?: string;
  readonly locale?: string;
}

/** Config for generating a meet-our-system report. */
export interface MeetOurSystemReportConfig {
  readonly reportType: "meet-our-system";
  readonly title?: string;
  readonly locale?: string;
}

/** Discriminated union of all report configurations. */
export type ReportConfig = MemberByBucketReportConfig | MeetOurSystemReportConfig;

// ── Report data types (client-side plaintext after decryption) ────

/** Per-entity-type arrays of decrypted entity records. */
export type ReportEntitySet = {
  readonly [K in BucketContentEntityType]: readonly Record<string, unknown>[];
};

/** Client-side report data for a member-by-bucket report. */
export interface MemberByBucketReportData {
  readonly reportType: "member-by-bucket";
  readonly systemId: SystemId;
  readonly bucketId: BucketId;
  readonly generatedAt: UnixMillis;
  readonly title: string | null;
  readonly entities: ReportEntitySet;
}

/** Client-side report data for a meet-our-system report. */
export interface MeetOurSystemReportData {
  readonly reportType: "meet-our-system";
  readonly systemId: SystemId;
  readonly generatedAt: UnixMillis;
  readonly title: string | null;
  readonly entities: ReportEntitySet;
}

/** Discriminated union of all report data types. */
export type ReportData = MemberByBucketReportData | MeetOurSystemReportData;

// ── Bucket export API response types ──────────────────────────────

/** Per-entity-type entry in the bucket export manifest. */
export interface BucketExportManifestEntry {
  readonly entityType: BucketContentEntityType;
  readonly count: number;
  readonly lastUpdatedAt: UnixMillis | null;
}

/** Response for the bucket export manifest endpoint. */
export interface BucketExportManifestResponse {
  readonly systemId: SystemId;
  readonly bucketId: BucketId;
  readonly entries: readonly BucketExportManifestEntry[];
  readonly etag: string;
}

/** A single entity in a bucket export page. */
export interface BucketExportEntity {
  readonly id: string;
  readonly entityType: BucketContentEntityType;
  readonly encryptedData: string;
  readonly updatedAt: UnixMillis;
}

/** Paginated response for a bucket export page, with ETag for conditional requests. */
export interface BucketExportPageResponse extends PaginatedResult<BucketExportEntity> {
  readonly etag: string;
}
