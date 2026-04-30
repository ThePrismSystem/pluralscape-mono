import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";

import { EncryptedSyncSession } from "../../sync-session.js";

import type { DocumentKeys } from "../../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId } from "@pluralscape/types";

/**
 * Shared fixtures for document-lifecycle test files.
 *
 * Tests share a process-wide sodium adapter (initialized lazily on first
 * `getSodium()` call). Each test produces fresh `DocumentKeys` and pairs of
 * sessions for isolation.
 */

let sodium: SodiumAdapter | null = null;

/**
 * Lazily initializes and returns the shared SodiumAdapter. Tests should call
 * this from a `beforeAll` block.
 */
export async function getSodium(): Promise<SodiumAdapter> {
  if (sodium === null) {
    const adapter = new WasmSodiumAdapter();
    await adapter.init();
    sodium = adapter;
  }
  return sodium;
}

/** Wraps a string as an Automerge ImmutableString. */
export const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

/** Generates a fresh pair of encryption + signing keys for a sync session. */
export function makeKeys(currentSodium: SodiumAdapter): DocumentKeys {
  return {
    encryptionKey: currentSodium.aeadKeygen(),
    signingKeys: currentSodium.signKeypair(),
  };
}

/** Returns two independent sessions sharing the same base document and keys. */
export function makeSessions<T>(
  base: Automerge.Doc<T>,
  keys: DocumentKeys,
  docId: SyncDocumentId,
  currentSodium: SodiumAdapter,
): [EncryptedSyncSession<T>, EncryptedSyncSession<T>] {
  return [
    new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium: currentSodium,
    }),
    new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium: currentSodium,
    }),
  ];
}
