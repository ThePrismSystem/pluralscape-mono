import { syncChanges, syncDocuments, syncSnapshots } from "@pluralscape/db/pg";
import { SNAPSHOT_VERSION_CONFLICT_MESSAGE } from "@pluralscape/sync";
import { createId, ID_PREFIXES } from "@pluralscape/types";
import { and, eq, gt, sql } from "drizzle-orm";

import type {
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  SyncManifest,
  SyncManifestEntry,
  SyncRelayService,
} from "@pluralscape/sync";
import type { SyncChangeRow, SyncSnapshotRow } from "@pluralscape/db/pg";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** PostgreSQL-backed implementation of SyncRelayService. */
export class PgSyncRelayService implements SyncRelayService {
  constructor(private readonly db: PostgresJsDatabase) {}

  async submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): Promise<number> {
    return await this.db.transaction(async (tx) => {
      const now = Date.now();

      // Check dedup: if (documentId, authorPublicKey, nonce) already exists, return existing seq
      const [existing] = await tx
        .select({ seq: syncChanges.seq })
        .from(syncChanges)
        .where(
          and(
            eq(syncChanges.documentId, envelope.documentId),
            eq(syncChanges.authorPublicKey, envelope.authorPublicKey),
            eq(syncChanges.nonce, envelope.nonce),
          ),
        );

      if (existing) {
        return existing.seq;
      }

      // Atomically increment last_seq and get the new value
      const [updated] = await tx
        .update(syncDocuments)
        .set({
          lastSeq: sql`${syncDocuments.lastSeq} + 1`,
          updatedAt: now,
        })
        .where(eq(syncDocuments.documentId, envelope.documentId))
        .returning({ lastSeq: syncDocuments.lastSeq });

      if (!updated) {
        throw new Error(`Document not found: ${envelope.documentId}`);
      }

      const seq = updated.lastSeq;

      await tx.insert(syncChanges).values({
        id: createId(ID_PREFIXES.syncChange),
        documentId: envelope.documentId,
        seq,
        encryptedPayload: envelope.ciphertext,
        authorPublicKey: envelope.authorPublicKey,
        nonce: envelope.nonce,
        signature: envelope.signature,
        createdAt: now,
      });

      return seq;
    });
  }

  async getEnvelopesSince(
    documentId: string,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]> {
    const rows = await this.db
      .select()
      .from(syncChanges)
      .where(and(eq(syncChanges.documentId, documentId), gt(syncChanges.seq, sinceSeq)))
      .orderBy(syncChanges.seq);

    return rows.map((row) => this.mapChangeRow(row));
  }

  async submitSnapshot(envelope: EncryptedSnapshotEnvelope): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = Date.now();

      // Atomic conditional UPDATE eliminates TOCTOU race
      const [atomicResult] = await tx
        .update(syncDocuments)
        .set({
          snapshotVersion: envelope.snapshotVersion,
          updatedAt: now,
        })
        .where(
          and(
            eq(syncDocuments.documentId, envelope.documentId),
            sql`${syncDocuments.snapshotVersion} < ${envelope.snapshotVersion}`,
          ),
        )
        .returning({ snapshotVersion: syncDocuments.snapshotVersion });

      if (!atomicResult) {
        // Determine whether "not found" or "version conflict"
        const [doc] = await tx
          .select({ snapshotVersion: syncDocuments.snapshotVersion })
          .from(syncDocuments)
          .where(eq(syncDocuments.documentId, envelope.documentId));

        if (!doc) {
          throw new Error(`Document not found: ${envelope.documentId}`);
        }

        throw new Error(
          `Snapshot version ${String(envelope.snapshotVersion)} ${SNAPSHOT_VERSION_CONFLICT_MESSAGE} ${String(doc.snapshotVersion)}`,
        );
      }

      // Upsert snapshot
      await tx
        .insert(syncSnapshots)
        .values({
          documentId: envelope.documentId,
          snapshotVersion: envelope.snapshotVersion,
          encryptedPayload: envelope.ciphertext,
          authorPublicKey: envelope.authorPublicKey,
          nonce: envelope.nonce,
          signature: envelope.signature,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: syncSnapshots.documentId,
          set: {
            snapshotVersion: envelope.snapshotVersion,
            encryptedPayload: envelope.ciphertext,
            authorPublicKey: envelope.authorPublicKey,
            nonce: envelope.nonce,
            signature: envelope.signature,
            createdAt: now,
          },
        });
    });
  }

  async getLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const [row] = await this.db
      .select()
      .from(syncSnapshots)
      .where(eq(syncSnapshots.documentId, documentId));

    if (!row) return null;

    return this.mapSnapshotRow(row);
  }

  async getManifest(systemId: string): Promise<SyncManifest> {
    const rows = await this.db
      .select()
      .from(syncDocuments)
      .where(eq(syncDocuments.systemId, systemId));

    const documents: SyncManifestEntry[] = rows.map((row) => ({
      docId: row.documentId,
      docType: row.docType,
      keyType: row.keyType,
      bucketId: row.bucketId ?? undefined,
      channelId: row.channelId ?? undefined,
      timePeriod: row.timePeriod,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sizeBytes: row.sizeBytes,
      snapshotVersion: row.snapshotVersion,
      archived: row.archived,
    }));

    return { documents, systemId };
  }

  private mapChangeRow(row: SyncChangeRow): EncryptedChangeEnvelope {
    return {
      ciphertext: row.encryptedPayload,
      nonce: row.nonce as EncryptedChangeEnvelope["nonce"],
      signature: row.signature as EncryptedChangeEnvelope["signature"],
      authorPublicKey: row.authorPublicKey as EncryptedChangeEnvelope["authorPublicKey"],
      documentId: row.documentId,
      seq: row.seq,
    };
  }

  private mapSnapshotRow(row: SyncSnapshotRow): EncryptedSnapshotEnvelope {
    return {
      ciphertext: row.encryptedPayload,
      nonce: row.nonce as EncryptedSnapshotEnvelope["nonce"],
      signature: row.signature as EncryptedSnapshotEnvelope["signature"],
      authorPublicKey: row.authorPublicKey as EncryptedSnapshotEnvelope["authorPublicKey"],
      documentId: row.documentId,
      snapshotVersion: row.snapshotVersion,
    };
  }
}
