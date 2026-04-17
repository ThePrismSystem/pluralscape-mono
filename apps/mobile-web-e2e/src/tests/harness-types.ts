/**
 * Shared type augmentations for `window.__harness` so individual test files
 * don't need to redeclare `declare global { interface Window {...} }` blocks.
 *
 * Mirrors the surface defined in `src/harness/controller.ts`; if that file
 * changes, this one needs to change too.
 */

export interface HarnessSnapshotInput {
  readonly snapshotVersion: number;
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly signature: Uint8Array;
  readonly authorPublicKey: Uint8Array;
}

export interface HarnessSnapshotOutput {
  readonly documentId: string;
  readonly snapshotVersion: number;
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly signature: Uint8Array;
  readonly authorPublicKey: Uint8Array;
}

export interface HarnessApi {
  init(): Promise<void>;
  reset(): Promise<void>;
  exec(sql: string): Promise<void>;
  run(sql: string, params: readonly (number | string | Uint8Array | null)[]): Promise<void>;
  all(sql: string, params: readonly (number | string | Uint8Array | null)[]): Promise<unknown[]>;
  saveSnapshot(documentId: string, snapshot: HarnessSnapshotInput): Promise<void>;
  loadSnapshot(documentId: string): Promise<HarnessSnapshotOutput | null>;
  listDocuments(): Promise<readonly string[]>;
  deleteDocument(documentId: string): Promise<void>;
  /** Diagnostic: last OPFS init error captured during fallback, if any. */
  getLastOpfsInitError(): string | undefined;
}

export interface HarnessByteSizes {
  readonly aeadNonce: number;
  readonly signature: number;
  readonly signPublicKey: number;
}

declare global {
  interface Window {
    __harness?: HarnessApi;
    __harnessByteSizes?: HarnessByteSizes;
  }
}
