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
