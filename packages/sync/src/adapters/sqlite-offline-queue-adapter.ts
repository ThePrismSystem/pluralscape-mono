/**
 * SQLite-backed offline queue adapter.
 *
 * Follows the same pattern as SqliteStorageAdapter: prepared statements,
 * SqliteDriver abstraction, DDL in constructor.
 */
import { brandId } from "@pluralscape/types";

import { DRAIN_BATCH_SIZE } from "../sync.constants.js";

import { assertEnvelopeBlobs, toUint8Array } from "./sqlite-utils.js";

import type { EncryptedChangeEnvelope } from "../types.js";
import type { OfflineQueueAdapter, OfflineQueueEntry } from "./offline-queue-adapter.js";
import type { SqliteDriver, SqliteStatement } from "./sqlite-driver.js";
import type { SyncDocumentId } from "@pluralscape/types";

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

function rowToEntry(row: QueueRow): OfflineQueueEntry {
  const blobs = assertEnvelopeBlobs(row);
  return {
    id: row.id,
    documentId: brandId<SyncDocumentId>(row.document_id),
    envelope: {
      documentId: brandId<SyncDocumentId>(row.document_id),
      ciphertext: toUint8Array(row.ciphertext),
      ...blobs,
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

  /**
   * Private constructor — use the static async `create` factory instead.
   * The factory runs DDL which requires awaiting the async `driver.exec`.
   */
  private constructor(driver: SqliteDriver, stmts: CachedStatements) {
    this.driver = driver;
    this.stmts = stmts;
  }

  static async create(driver: SqliteDriver): Promise<SqliteOfflineQueueAdapter> {
    await driver.exec(CREATE_QUEUE);
    await driver.exec(CREATE_QUEUE_INDEX);
    const stmts: CachedStatements = {
      enqueue: driver.prepare(
        `INSERT INTO sync_offline_queue
         (id, document_id, ciphertext, nonce, signature, author_public_key, enqueued_at, synced_at, server_seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      ),
      drainUnsynced: driver.prepare<QueueRow>(
        `SELECT * FROM sync_offline_queue
         WHERE synced_at IS NULL
         ORDER BY enqueued_at ASC
         LIMIT ?`,
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
    return new SqliteOfflineQueueAdapter(driver, stmts);
  }

  async enqueue(
    documentId: string,
    envelope: Omit<EncryptedChangeEnvelope, "seq">,
  ): Promise<string> {
    const id = generateId();
    const now = Date.now();
    await this.stmts.enqueue.run(
      id,
      documentId,
      envelope.ciphertext,
      envelope.nonce,
      envelope.signature,
      envelope.authorPublicKey,
      now,
    );
    return id;
  }

  async drainUnsynced(): Promise<readonly OfflineQueueEntry[]> {
    const rows = await this.stmts.drainUnsynced.all(DRAIN_BATCH_SIZE);
    return rows.map(rowToEntry);
  }

  async markSynced(id: string, serverSeq: number): Promise<void> {
    const now = Date.now();
    await this.stmts.markSynced.run(now, serverSeq, id);
  }

  async deleteConfirmed(cutoffMs: number): Promise<number> {
    return this.driver.transaction(async () => {
      await this.stmts.deleteConfirmed.run(cutoffMs);
      const result = await this.stmts.countDeleted.get();
      return result?.cnt ?? 0;
    });
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
