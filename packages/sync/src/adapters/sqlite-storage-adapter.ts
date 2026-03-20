import { assertAeadNonce, assertSignPublicKey, assertSignature } from "@pluralscape/crypto";

import { toUint8Array } from "./sqlite-utils.js";

import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SqliteDriver, SqliteStatement } from "./sqlite-driver.js";
import type { SyncStorageAdapter } from "./storage-adapter.js";

interface SnapshotRow {
  document_id: string;
  snapshot_version: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  signature: Uint8Array;
  author_public_key: Uint8Array;
}

interface ChangeRow {
  document_id: string;
  seq: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  signature: Uint8Array;
  author_public_key: Uint8Array;
}

interface DocIdRow {
  document_id: string;
}

const CREATE_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS sync_local_snapshots (
  document_id TEXT PRIMARY KEY,
  snapshot_version INTEGER NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  signature BLOB NOT NULL,
  author_public_key BLOB NOT NULL
)`;

const CREATE_CHANGES = `
CREATE TABLE IF NOT EXISTS sync_local_changes (
  document_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  signature BLOB NOT NULL,
  author_public_key BLOB NOT NULL,
  PRIMARY KEY (document_id, seq)
)`;

function rowToEnvelope(row: ChangeRow): EncryptedChangeEnvelope {
  const nonce = toUint8Array(row.nonce);
  assertAeadNonce(nonce);
  const signature = toUint8Array(row.signature);
  assertSignature(signature);
  const authorPublicKey = toUint8Array(row.author_public_key);
  assertSignPublicKey(authorPublicKey);
  return {
    documentId: row.document_id,
    seq: row.seq,
    ciphertext: toUint8Array(row.ciphertext),
    nonce,
    signature,
    authorPublicKey,
  };
}

function rowToSnapshot(row: SnapshotRow): EncryptedSnapshotEnvelope {
  const nonce = toUint8Array(row.nonce);
  assertAeadNonce(nonce);
  const signature = toUint8Array(row.signature);
  assertSignature(signature);
  const authorPublicKey = toUint8Array(row.author_public_key);
  assertSignPublicKey(authorPublicKey);
  return {
    documentId: row.document_id,
    snapshotVersion: row.snapshot_version,
    ciphertext: toUint8Array(row.ciphertext),
    nonce,
    signature,
    authorPublicKey,
  };
}

/** Cached prepared statements for all SQLite operations. */
interface CachedStatements {
  readonly loadSnapshot: SqliteStatement<SnapshotRow>;
  readonly saveSnapshot: SqliteStatement;
  readonly loadChanges: SqliteStatement<ChangeRow>;
  readonly appendChange: SqliteStatement;
  readonly pruneChanges: SqliteStatement;
  readonly listDocs: SqliteStatement<DocIdRow>;
  readonly deleteChanges: SqliteStatement;
  readonly deleteSnapshots: SqliteStatement;
}

/** SQLite-backed SyncStorageAdapter for client-side local sync storage. */
export class SqliteStorageAdapter implements SyncStorageAdapter {
  private readonly driver: SqliteDriver;
  private readonly stmts: CachedStatements;

  constructor(driver: SqliteDriver) {
    this.driver = driver;
    driver.exec(CREATE_SNAPSHOTS);
    driver.exec(CREATE_CHANGES);
    this.stmts = {
      loadSnapshot: driver.prepare<SnapshotRow>(
        "SELECT * FROM sync_local_snapshots WHERE document_id = ?",
      ),
      saveSnapshot: driver.prepare(
        `INSERT OR REPLACE INTO sync_local_snapshots
         (document_id, snapshot_version, ciphertext, nonce, signature, author_public_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ),
      loadChanges: driver.prepare<ChangeRow>(
        `SELECT * FROM sync_local_changes
         WHERE document_id = ? AND seq > ?
         ORDER BY seq ASC`,
      ),
      appendChange: driver.prepare(
        `INSERT OR IGNORE INTO sync_local_changes
         (document_id, seq, ciphertext, nonce, signature, author_public_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ),
      pruneChanges: driver.prepare(
        "DELETE FROM sync_local_changes WHERE document_id = ? AND seq <= ?",
      ),
      listDocs: driver.prepare<DocIdRow>(
        `SELECT document_id FROM sync_local_snapshots
         UNION
         SELECT DISTINCT document_id FROM sync_local_changes`,
      ),
      deleteChanges: driver.prepare("DELETE FROM sync_local_changes WHERE document_id = ?"),
      deleteSnapshots: driver.prepare("DELETE FROM sync_local_snapshots WHERE document_id = ?"),
    };
  }

  loadSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const row = this.stmts.loadSnapshot.get(documentId);
    return Promise.resolve(row ? rowToSnapshot(row) : null);
  }

  saveSnapshot(documentId: string, snapshot: EncryptedSnapshotEnvelope): Promise<void> {
    this.stmts.saveSnapshot.run(
      documentId,
      snapshot.snapshotVersion,
      snapshot.ciphertext,
      snapshot.nonce,
      snapshot.signature,
      snapshot.authorPublicKey,
    );
    return Promise.resolve();
  }

  loadChangesSince(
    documentId: string,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]> {
    const rows = this.stmts.loadChanges.all(documentId, sinceSeq);
    return Promise.resolve(rows.map(rowToEnvelope));
  }

  appendChange(documentId: string, change: EncryptedChangeEnvelope): Promise<void> {
    this.stmts.appendChange.run(
      documentId,
      change.seq,
      change.ciphertext,
      change.nonce,
      change.signature,
      change.authorPublicKey,
    );
    return Promise.resolve();
  }

  pruneChangesBeforeSnapshot(documentId: string, snapshotVersion: number): Promise<void> {
    this.stmts.pruneChanges.run(documentId, snapshotVersion);
    return Promise.resolve();
  }

  listDocuments(): Promise<readonly string[]> {
    const rows = this.stmts.listDocs.all();
    return Promise.resolve(rows.map((r) => r.document_id));
  }

  deleteDocument(documentId: string): Promise<void> {
    this.driver.transaction(() => {
      this.stmts.deleteChanges.run(documentId);
      this.stmts.deleteSnapshots.run(documentId);
    });
    return Promise.resolve();
  }
}
