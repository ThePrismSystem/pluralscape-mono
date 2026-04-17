/**
 * OPFS driver harness controller.
 *
 * Bundled by esbuild into `dist/controller.js` and loaded by `index.html`.
 * Exposes `window.__harness` so Playwright tests can drive the OPFS-backed
 * SQLite driver + sync storage adapter end-to-end inside a real Chromium.
 */
import {
  AEAD_NONCE_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  assertAeadNonce,
  assertSignPublicKey,
  assertSignature,
} from "@pluralscape/crypto";
import { createIndexedDbStorageAdapter } from "@pluralscape/mobile/src/platform/drivers/indexeddb-storage-adapter.js";
import { createOpfsSqliteDriver } from "@pluralscape/mobile/src/platform/drivers/opfs-sqlite-driver.js";
import { SqliteStorageAdapter } from "@pluralscape/sync/adapters";
import { brandId } from "@pluralscape/types";

import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { SqliteDriver, SyncStorageAdapter } from "@pluralscape/sync/adapters";
import type { SyncDocumentId } from "@pluralscape/types";

/** Plain transferable shape used to ship envelopes across `evaluate()`. */
interface SnapshotInput {
  readonly snapshotVersion: number;
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly signature: Uint8Array;
  readonly authorPublicKey: Uint8Array;
}

interface SnapshotOutput {
  readonly documentId: string;
  readonly snapshotVersion: number;
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly signature: Uint8Array;
  readonly authorPublicKey: Uint8Array;
}

interface HarnessApi {
  init(): Promise<void>;
  reset(): Promise<void>;
  exec(sql: string): Promise<void>;
  run(sql: string, params: readonly (number | string | Uint8Array | null)[]): Promise<void>;
  all(sql: string, params: readonly (number | string | Uint8Array | null)[]): Promise<unknown[]>;
  saveSnapshot(documentId: string, snapshot: SnapshotInput): Promise<void>;
  loadSnapshot(documentId: string): Promise<SnapshotOutput | null>;
  listDocuments(): Promise<readonly string[]>;
  deleteDocument(documentId: string): Promise<void>;
}

/**
 * Harness can run in one of two modes:
 *
 * - `sqlite`: OPFS worker driver + full SqliteStorageAdapter (primary path).
 * - `indexeddb`: IndexedDB-backed SyncStorageAdapter only. Used when OPFS init
 *   fails — e.g. Playwright blocks worker construction to exercise the web
 *   fallback. In this mode the `exec`/`run`/`all` SQL surface is not available.
 */
interface SqliteHarnessState {
  readonly kind: "sqlite";
  readonly driver: SqliteDriver;
  readonly adapter: SqliteStorageAdapter;
}

interface IndexedDbHarnessState {
  readonly kind: "indexeddb";
  readonly storageAdapter: SyncStorageAdapter;
}

type HarnessState = SqliteHarnessState | IndexedDbHarnessState;

let state: HarnessState | null = null;

/** Test-only: lift a plain string to the branded `SyncDocumentId`. */
function toDocumentId(id: string): SyncDocumentId {
  return brandId<SyncDocumentId>(id);
}

/** Validate raw byte fields and re-brand them with crypto's nominal types. */
function brandSnapshot(snapshot: SnapshotInput): {
  nonce: AeadNonce;
  signature: Signature;
  authorPublicKey: SignPublicKey;
} {
  const nonce = new Uint8Array(snapshot.nonce);
  const signature = new Uint8Array(snapshot.signature);
  const authorPublicKey = new Uint8Array(snapshot.authorPublicKey);
  assertAeadNonce(nonce);
  assertSignature(signature);
  assertSignPublicKey(authorPublicKey);
  return { nonce, signature, authorPublicKey };
}

async function init(): Promise<void> {
  if (state !== null) return;
  try {
    const driver = await createOpfsSqliteDriver();
    const adapter = await SqliteStorageAdapter.create(driver);
    state = { kind: "sqlite", driver, adapter };
  } catch {
    // OPFS unavailable (e.g. blocked Worker constructor in Playwright fallback
    // test) — switch to the IndexedDB-backed web fallback. SQL exec/run/all
    // are not available in this mode; snapshot/change storage is.
    const storageAdapter = createIndexedDbStorageAdapter();
    state = { kind: "indexeddb", storageAdapter };
  }
}

function requireState(): HarnessState {
  if (state === null) {
    throw new Error("harness: init() must be called first");
  }
  return state;
}

function requireSqlite(): SqliteHarnessState {
  const s = requireState();
  if (s.kind !== "sqlite") {
    throw new Error("harness: not supported in indexeddb mode");
  }
  return s;
}

function storageAdapterOf(s: HarnessState): SyncStorageAdapter {
  return s.kind === "sqlite" ? s.adapter : s.storageAdapter;
}

async function reset(): Promise<void> {
  if (state === null) return;
  if (state.kind === "sqlite") {
    // Drop all sync tables and reinitialize. Cheaper than wiping OPFS storage.
    await state.driver.exec("DROP TABLE IF EXISTS sync_local_changes");
    await state.driver.exec("DROP TABLE IF EXISTS sync_local_snapshots");
    await state.driver.close();
  }
  state = null;
  await init();
}

const api: HarnessApi = {
  init,
  reset,
  async exec(sql) {
    await requireSqlite().driver.exec(sql);
  },
  async run(sql, params) {
    const stmt = requireSqlite().driver.prepare(sql);
    await stmt.run(...params);
  },
  async all(sql, params) {
    const stmt = requireSqlite().driver.prepare(sql);
    return stmt.all(...params);
  },
  async saveSnapshot(documentId, snapshot) {
    const branded = brandSnapshot(snapshot);
    const docId = toDocumentId(documentId);
    await storageAdapterOf(requireState()).saveSnapshot(docId, {
      documentId: docId,
      snapshotVersion: snapshot.snapshotVersion,
      ciphertext: new Uint8Array(snapshot.ciphertext),
      ...branded,
    });
  },
  async loadSnapshot(documentId) {
    const result = await storageAdapterOf(requireState()).loadSnapshot(toDocumentId(documentId));
    if (result === null) return null;
    return {
      documentId: result.documentId,
      snapshotVersion: result.snapshotVersion,
      ciphertext: new Uint8Array(result.ciphertext),
      nonce: new Uint8Array(result.nonce),
      signature: new Uint8Array(result.signature),
      authorPublicKey: new Uint8Array(result.authorPublicKey),
    };
  },
  async listDocuments() {
    const docs = await storageAdapterOf(requireState()).listDocuments();
    return docs.map((d) => String(d));
  },
  async deleteDocument(documentId) {
    await storageAdapterOf(requireState()).deleteDocument(toDocumentId(documentId));
  },
};

declare global {
  interface Window {
    __harness?: HarnessApi;
    __harnessByteSizes?: {
      readonly aeadNonce: number;
      readonly signature: number;
      readonly signPublicKey: number;
    };
  }
}

window.__harness = api;
window.__harnessByteSizes = {
  aeadNonce: AEAD_NONCE_BYTES,
  signature: SIGN_BYTES,
  signPublicKey: SIGN_PUBLIC_KEY_BYTES,
};
