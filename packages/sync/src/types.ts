import type { SyncDocumentType } from "./document-types.js";
import type { AeadKey, SignKeypair, SignPublicKey } from "@pluralscape/crypto";
import type { AeadNonce, Signature } from "@pluralscape/crypto";

export interface DocumentKeys {
  readonly encryptionKey: AeadKey;
  readonly signingKeys: SignKeypair;
}

export interface EncryptedChangeEnvelope {
  readonly ciphertext: Uint8Array;
  readonly nonce: AeadNonce;
  readonly signature: Signature;
  readonly authorPublicKey: SignPublicKey;
  readonly documentId: string;
  readonly seq: number;
}

export interface EncryptedSnapshotEnvelope {
  readonly ciphertext: Uint8Array;
  readonly nonce: AeadNonce;
  readonly signature: Signature;
  readonly authorPublicKey: SignPublicKey;
  readonly documentId: string;
  readonly snapshotVersion: number;
}

// ── Document lifecycle types ─────────────────────────────────────────

/** Configuration for Automerge document compaction. */
export interface CompactionConfig {
  /** Number of changes since last snapshot before compaction is eligible. */
  readonly changeThreshold: number;
  /** Size increase in bytes since last snapshot before compaction is eligible. */
  readonly sizeThresholdBytes: number;
}

/** Default compaction configuration: 200 changes or 1 MB size increase. */
export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  changeThreshold: 200,
  sizeThresholdBytes: 1_048_576,
} as const;

/** Time-based split unit for growing documents. */
export type TimeSplitUnit = "quarter" | "month" | "year";

/** Configuration for time-based document splitting. */
export interface TimeSplitConfig {
  readonly documentType: SyncDocumentType;
  readonly splitUnit: TimeSplitUnit;
  readonly splitThresholdBytes: number;
}

/** Default time-split configurations per document type. */
export const TIME_SPLIT_CONFIGS: readonly TimeSplitConfig[] = [
  { documentType: "fronting", splitUnit: "quarter", splitThresholdBytes: 5_242_880 },
  { documentType: "chat", splitUnit: "month", splitThresholdBytes: 5_242_880 },
  { documentType: "journal", splitUnit: "year", splitThresholdBytes: 10_485_760 },
] as const;

/** Maximum document size limits per document type (bytes). */
export const DOCUMENT_SIZE_LIMITS: Record<SyncDocumentType, number> = {
  "system-core": 10_485_760,
  fronting: 20_971_520,
  chat: 20_971_520,
  journal: 52_428_800,
  "privacy-config": 5_242_880,
  bucket: 5_242_880,
} as const;

/** Per-system storage budget configuration. */
export interface StorageBudget {
  readonly maxTotalBytes: number;
}

/** Default hosted storage budget: 500 MB. */
export const DEFAULT_STORAGE_BUDGET: StorageBudget = {
  maxTotalBytes: 524_288_000,
} as const;

/** Categories used in sync priority ordering: base document types plus historical variants. */
export type SyncPriorityCategory =
  | SyncDocumentType
  | "fronting-historical"
  | "chat-historical"
  | "journal-historical";

/**
 * Sync priority order for constrained-storage scenarios.
 * Documents are synced and evicted in this order (lower index = higher priority).
 */
export const SYNC_PRIORITY_ORDER: readonly SyncPriorityCategory[] = [
  "system-core",
  "privacy-config",
  "fronting",
  "chat",
  "journal",
  "bucket",
  "fronting-historical",
  "chat-historical",
  "journal-historical",
] as const;

/** Result of checking whether a document is eligible for compaction. */
export type CompactionCheck =
  | {
      readonly eligible: true;
      readonly reason: "change-threshold" | "size-threshold" | "explicit";
      readonly changesSinceSnapshot: number;
      readonly currentSizeBytes: number;
    }
  | {
      readonly eligible: false;
      readonly reason: "not-eligible";
      readonly changesSinceSnapshot: number;
      readonly currentSizeBytes: number;
    };

/** Thrown when a write would exceed the system's storage budget. */
export class StorageBudgetExceededError extends Error {
  constructor(
    readonly documentId: string,
    readonly currentBytes: number,
    readonly maxBytes: number,
  ) {
    super(
      `Storage budget exceeded for document "${documentId}": ${currentBytes.toString()} bytes used, ${maxBytes.toString()} bytes maximum`,
    );
    this.name = "StorageBudgetExceededError";
  }
}

// ── Conflict resolution types ────────────────────────────────────────

/** Strategy applied to resolve a concurrent edit conflict. */
export type ConflictResolutionStrategy =
  | "lww-field"
  | "append-both"
  | "add-wins"
  | "post-merge-cycle"
  | "post-merge-sort-normalize"
  | "post-merge-checkin-normalize"
  | "post-merge-friend-status";

/** Informational notification generated when a conflict is auto-resolved. Ephemeral — not persisted. */
export interface ConflictNotification {
  readonly entityType: string;
  readonly entityId: string;
  readonly fieldName: string | null;
  readonly resolution: ConflictResolutionStrategy;
  readonly detectedAt: number;
  readonly summary: string;
}

/** A cycle break applied by post-merge hierarchy validation. */
export interface CycleBreak {
  readonly entityId: string;
  readonly formerParentId: string;
}

/** A sort order correction applied by post-merge normalization. */
export interface SortOrderPatch {
  readonly entityId: string;
  readonly newSortOrder: number;
}

/** Aggregate result of all post-merge validations for a single merge operation. */
export interface PostMergeValidationResult {
  readonly cycleBreaks: readonly CycleBreak[];
  readonly sortOrderPatches: readonly SortOrderPatch[];
  readonly checkInNormalizations: number;
  readonly friendConnectionNormalizations: number;
}
