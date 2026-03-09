import type { SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

// ── Import/Export types ─────────────────────────────────────────────
// Types for data import, export, and account management.
// Import payloads use plain string IDs and number timestamps
// (external format shapes, not internal branded types).

// ── Import payloads (external shapes) ───────────────────────────────

/** A member as represented in a Pluralscape export file. */
export interface SPImportMember {
  readonly id: string;
  readonly name: string;
  readonly pronouns: string | null;
  readonly description: string | null;
  readonly colors: readonly string[];
  readonly createdAt: number;
}

/** A group as represented in a Pluralscape export file. */
export interface SPImportGroup {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly memberIds: readonly string[];
}

/** A fronting session as represented in a Pluralscape export file. */
export interface SPImportFrontingSession {
  readonly memberId: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** Full Pluralscape import payload (external format). */
export interface SPImportPayload {
  readonly version: number;
  readonly exportedAt: number;
  readonly members: readonly SPImportMember[];
  readonly groups: readonly SPImportGroup[];
  readonly frontingHistory: readonly SPImportFrontingSession[];
}

/** A member as represented in a PluralKit export file. */
export interface PKImportMember {
  readonly id: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly pronouns: string | null;
  readonly description: string | null;
  readonly color: string | null;
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
export type ImportSource = "pluralscape" | "pluralkit";

/** Status of an import job. */
export type ImportJobStatus = "pending" | "validating" | "importing" | "completed" | "failed";

/** Progress of an import job. */
export interface ImportProgress {
  readonly totalItems: number;
  readonly processedItems: number;
  readonly skippedItems: number;
  readonly errors: readonly ImportError[];
}

/** An error that occurred during import. */
export interface ImportError {
  readonly entityType: string;
  readonly entityId: string | null;
  readonly message: string;
  readonly fatal: boolean;
}

/** An import job. */
export interface ImportJob {
  readonly id: string;
  readonly systemId: SystemId;
  readonly source: ImportSource;
  readonly status: ImportJobStatus;
  readonly progress: ImportProgress;
  readonly startedAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
}

// ── Export types ─────────────────────────────────────────────────────

/** Format for an export manifest. */
export type ExportFormat = "json" | "csv";

/** Manifest describing an export package. */
export interface ExportManifest {
  readonly systemId: SystemId;
  readonly format: ExportFormat;
  readonly includeMembers: boolean;
  readonly includeGroups: boolean;
  readonly includeFrontingHistory: boolean;
  readonly includeJournal: boolean;
  readonly generatedAt: UnixMillis;
  readonly sizeBytes: number;
  readonly downloadUrl: string;
  readonly expiresAt: UnixMillis;
}

// ── Account management ──────────────────────────────────────────────

/** Request to purge an entire account and all associated data. */
export interface AccountPurgeRequest {
  readonly systemId: SystemId;
  readonly confirmationPhrase: string;
  readonly requestedAt: UnixMillis;
  readonly scheduledPurgeAt: UnixMillis;
  readonly cancelled: boolean;
}

/** A downloadable report of a single member's data. */
export interface MemberReport {
  readonly systemId: SystemId;
  readonly memberId: string;
  readonly generatedAt: UnixMillis;
  readonly sizeBytes: number;
  readonly downloadUrl: string;
  readonly expiresAt: UnixMillis;
}
