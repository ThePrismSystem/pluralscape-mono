import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SqliteDriver } from "./sqlite-driver.js";
import type { SyncStorageAdapter } from "./storage-adapter.js";
import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";

interface SnapshotRow {
  document_id: string;
  snapshot_version: number;
  last_seq: number;
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
  last_seq INTEGER NOT NULL,
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

function toUint8Array(buf: Uint8Array): Uint8Array {
  if (buf instanceof Uint8Array && buf.constructor === Uint8Array) return buf;
  return new Uint8Array(buf);
}

function mapCryptoFields(row: {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  signature: Uint8Array;
  author_public_key: Uint8Array;
}) {
  return {
    ciphertext: toUint8Array(row.ciphertext),
    nonce: toUint8Array(row.nonce) as AeadNonce,
    signature: toUint8Array(row.signature) as Signature,
    authorPublicKey: toUint8Array(row.author_public_key) as SignPublicKey,
  };
}

function rowToEnvelope(row: ChangeRow): EncryptedChangeEnvelope {
  return {
    documentId: row.document_id,
    seq: row.seq,
    ...mapCryptoFields(row),
  };
}

function rowToSnapshot(row: SnapshotRow): EncryptedSnapshotEnvelope {
  return {
    documentId: row.document_id,
    snapshotVersion: row.snapshot_version,
    lastSeq: row.last_seq,
    ...mapCryptoFields(row),
  };
}

/** SQLite-backed SyncStorageAdapter for client-side local sync storage. */
export class SqliteStorageAdapter implements SyncStorageAdapter {
  private readonly driver: SqliteDriver;

  constructor(driver: SqliteDriver) {
    this.driver = driver;
    driver.exec(CREATE_SNAPSHOTS);
    driver.exec(CREATE_CHANGES);
  }

  loadSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const row = this.driver
      .prepare<SnapshotRow>("SELECT * FROM sync_local_snapshots WHERE document_id = ?")
      .get(documentId);
    return Promise.resolve(row ? rowToSnapshot(row) : null);
  }

  saveSnapshot(documentId: string, snapshot: EncryptedSnapshotEnvelope): Promise<void> {
    this.driver
      .prepare(
        `INSERT OR REPLACE INTO sync_local_snapshots
         (document_id, snapshot_version, last_seq, ciphertext, nonce, signature, author_public_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        documentId,
        snapshot.snapshotVersion,
        snapshot.lastSeq,
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
    const rows = this.driver
      .prepare<ChangeRow>(
        `SELECT * FROM sync_local_changes
         WHERE document_id = ? AND seq > ?
         ORDER BY seq ASC`,
      )
      .all(documentId, sinceSeq);
    return Promise.resolve(rows.map(rowToEnvelope));
  }

  appendChange(documentId: string, change: EncryptedChangeEnvelope): Promise<void> {
    this.driver
      .prepare(
        `INSERT OR REPLACE INTO sync_local_changes
         (document_id, seq, ciphertext, nonce, signature, author_public_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        documentId,
        change.seq,
        change.ciphertext,
        change.nonce,
        change.signature,
        change.authorPublicKey,
      );
    return Promise.resolve();
  }

  pruneChangesBeforeSnapshot(documentId: string, lastSeqCoveredBySnapshot: number): Promise<void> {
    this.driver
      .prepare("DELETE FROM sync_local_changes WHERE document_id = ? AND seq <= ?")
      .run(documentId, lastSeqCoveredBySnapshot);
    return Promise.resolve();
  }

  listDocuments(): Promise<readonly string[]> {
    const rows = this.driver
      .prepare<DocIdRow>(
        `SELECT document_id FROM sync_local_snapshots
         UNION
         SELECT DISTINCT document_id FROM sync_local_changes`,
      )
      .all();
    return Promise.resolve(rows.map((r) => r.document_id));
  }

  deleteDocument(documentId: string): Promise<void> {
    this.driver.transaction(() => {
      this.driver.prepare("DELETE FROM sync_local_changes WHERE document_id = ?").run(documentId);
      this.driver.prepare("DELETE FROM sync_local_snapshots WHERE document_id = ?").run(documentId);
    });
    return Promise.resolve();
  }
}
