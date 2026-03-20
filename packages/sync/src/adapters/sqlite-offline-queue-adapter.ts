/**
 * SQLite-backed offline queue adapter.
 *
 * Follows the same pattern as SqliteStorageAdapter: prepared statements,
 * SqliteDriver abstraction, DDL in constructor.
 */
import type { OfflineQueueAdapter, OfflineQueueEntry } from "./offline-queue-adapter.js";
import type { SqliteDriver, SqliteStatement } from "./sqlite-driver.js";
import type { EncryptedChangeEnvelope } from "../types.js";
import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";

interface QueueRow {
  id: string;
  document_id: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  signature: Uint8Array;
  author_public_key: Uint8Array;
  enqueued_at: number;
  synced_at: number | null;
  server_seq: number | null;
}

interface CountRow {
  cnt: number;
}

const CREATE_QUEUE = `
CREATE TABLE IF NOT EXISTS sync_offline_queue (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  signature BLOB NOT NULL,
  author_public_key BLOB NOT NULL,
  enqueued_at INTEGER NOT NULL,
  synced_at INTEGER,
  server_seq INTEGER
)`;

const CREATE_QUEUE_INDEX = `
CREATE INDEX IF NOT EXISTS sync_offline_queue_unsynced_idx
  ON sync_offline_queue (synced_at) WHERE synced_at IS NULL`;

function toUint8Array(buf: Uint8Array): Uint8Array {
  return buf.constructor === Uint8Array ? buf : new Uint8Array(buf);
}

function rowToEntry(row: QueueRow): OfflineQueueEntry {
  return {
    id: row.id,
    documentId: row.document_id,
    envelope: {
      documentId: row.document_id,
      ciphertext: toUint8Array(row.ciphertext),
      nonce: toUint8Array(row.nonce) as AeadNonce,
      signature: toUint8Array(row.signature) as Signature,
      authorPublicKey: toUint8Array(row.author_public_key) as SignPublicKey,
    },
    enqueuedAt: row.enqueued_at,
    syncedAt: row.synced_at,
    serverSeq: row.server_seq,
  };
}

/** Generates a unique ID for queue entries using crypto.randomUUID(). */
function generateId(): string {
  return `oq_${crypto.randomUUID()}`;
}

/** Cached prepared statements for all SQLite operations. */
interface CachedStatements {
  readonly enqueue: SqliteStatement;
  readonly drainUnsynced: SqliteStatement<QueueRow>;
  readonly markSynced: SqliteStatement;
  readonly deleteConfirmed: SqliteStatement;
  readonly countDeleted: SqliteStatement<CountRow>;
}

/** SQLite-backed OfflineQueueAdapter for client-side offline queue storage. */
export class SqliteOfflineQueueAdapter implements OfflineQueueAdapter {
  private readonly driver: SqliteDriver;
  private readonly stmts: CachedStatements;

  constructor(driver: SqliteDriver) {
    this.driver = driver;
    driver.exec(CREATE_QUEUE);
    driver.exec(CREATE_QUEUE_INDEX);
    this.stmts = {
      enqueue: driver.prepare(
        `INSERT INTO sync_offline_queue
         (id, document_id, ciphertext, nonce, signature, author_public_key, enqueued_at, synced_at, server_seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      ),
      drainUnsynced: driver.prepare<QueueRow>(
        `SELECT * FROM sync_offline_queue
         WHERE synced_at IS NULL
         ORDER BY enqueued_at ASC`,
      ),
      markSynced: driver.prepare(
        `UPDATE sync_offline_queue
         SET synced_at = ?, server_seq = ?
         WHERE id = ?`,
      ),
      deleteConfirmed: driver.prepare(
        `DELETE FROM sync_offline_queue
         WHERE synced_at IS NOT NULL AND synced_at < ?`,
      ),
      countDeleted: driver.prepare<CountRow>(`SELECT changes() as cnt`),
    };
  }

  enqueue(documentId: string, envelope: Omit<EncryptedChangeEnvelope, "seq">): Promise<string> {
    const id = generateId();
    const now = Date.now();
    this.stmts.enqueue.run(
      id,
      documentId,
      envelope.ciphertext,
      envelope.nonce,
      envelope.signature,
      envelope.authorPublicKey,
      now,
    );
    return Promise.resolve(id);
  }

  drainUnsynced(): Promise<readonly OfflineQueueEntry[]> {
    const rows = this.stmts.drainUnsynced.all();
    return Promise.resolve(rows.map(rowToEntry));
  }

  markSynced(id: string, serverSeq: number): Promise<void> {
    const now = Date.now();
    this.stmts.markSynced.run(now, serverSeq, id);
    return Promise.resolve();
  }

  deleteConfirmed(cutoffMs: number): Promise<number> {
    const count = this.driver.transaction(() => {
      this.stmts.deleteConfirmed.run(cutoffMs);
      const result = this.stmts.countDeleted.get();
      return result?.cnt ?? 0;
    });
    return Promise.resolve(count);
  }

  close(): void {
    this.driver.close();
  }
}
