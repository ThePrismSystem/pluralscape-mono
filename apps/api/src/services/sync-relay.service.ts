import { assertAeadNonce, assertSignature, assertSignPublicKey } from "@pluralscape/crypto";
import { syncChanges, syncDocuments, syncSnapshots } from "@pluralscape/db/pg";
import { DocumentNotFoundError, SnapshotVersionConflictError } from "@pluralscape/sync";
import { createId, ID_PREFIXES } from "@pluralscape/types";
import { and, eq, gt, sql } from "drizzle-orm";

import type { SyncChangeRow, SyncSnapshotRow } from "@pluralscape/db/pg";
import type {
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  SyncManifest,
  SyncManifestEntry,
  SyncRelayService,
} from "@pluralscape/sync";
import type { BucketId, ChannelId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** PostgreSQL-backed implementation of SyncRelayService. */
export class PgSyncRelayService implements SyncRelayService {
  constructor(private readonly db: PostgresJsDatabase) {}

  async submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): Promise<number> {
    return await this.db.transaction(async (tx) => {
      const now = Date.now();

      // M8: Atomically increment last_seq and get the new value (query 1 of 2)
      const [updated] = await tx
        .update(syncDocuments)
        .set({
          lastSeq: sql`${syncDocuments.lastSeq} + 1`,
          updatedAt: now,
        })
        .where(eq(syncDocuments.documentId, envelope.documentId))
        .returning({ lastSeq: syncDocuments.lastSeq });

      if (!updated) {
        throw new DocumentNotFoundError(envelope.documentId);
      }

      const seq = updated.lastSeq;

      // M8: INSERT with ON CONFLICT DO NOTHING combines insert + dedup (query 2 of 2)
      // If (documentId, authorPublicKey, nonce) already exists, no row is returned.
      const [inserted] = await tx
        .insert(syncChanges)
        .values({
          id: createId(ID_PREFIXES.syncChange),
          documentId: envelope.documentId,
          seq,
          encryptedPayload: envelope.ciphertext,
          authorPublicKey: envelope.authorPublicKey,
          nonce: envelope.nonce,
          signature: envelope.signature,
          createdAt: now,
        })
        .onConflictDoNothing({
          target: [syncChanges.documentId, syncChanges.authorPublicKey, syncChanges.nonce],
        })
        .returning({ seq: syncChanges.seq });

      if (inserted) {
        return inserted.seq;
      }

      // Dedup hit: we incremented last_seq but the insert was a no-op.
      // Roll back the increment and return the existing seq.
      await tx
        .update(syncDocuments)
        .set({
          lastSeq: sql`${syncDocuments.lastSeq} - 1`,
          updatedAt: now,
        })
        .where(eq(syncDocuments.documentId, envelope.documentId));

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

      if (!existing) {
        throw new DocumentNotFoundError(envelope.documentId);
      }

      return existing.seq;
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
          throw new DocumentNotFoundError(envelope.documentId);
        }

        throw new SnapshotVersionConflictError(envelope.snapshotVersion, doc.snapshotVersion);
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

  async getManifest(systemId: SystemId): Promise<SyncManifest> {
    const rows = await this.db
      .select()
      .from(syncDocuments)
      .where(eq(syncDocuments.systemId, systemId));

    const documents: SyncManifestEntry[] = rows.map((row) => ({
      docId: row.documentId,
      docType: row.docType,
      keyType: row.keyType,
      bucketId: row.bucketId as BucketId | null,
      channelId: row.channelId as ChannelId | null,
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
    assertAeadNonce(row.nonce);
    assertSignature(row.signature);
    assertSignPublicKey(row.authorPublicKey);
    return {
      ciphertext: row.encryptedPayload,
      nonce: row.nonce,
      signature: row.signature,
      authorPublicKey: row.authorPublicKey,
      documentId: row.documentId,
      seq: row.seq,
    };
  }

  private mapSnapshotRow(row: SyncSnapshotRow): EncryptedSnapshotEnvelope {
    assertAeadNonce(row.nonce);
    assertSignature(row.signature);
    assertSignPublicKey(row.authorPublicKey);
    return {
      ciphertext: row.encryptedPayload,
      nonce: row.nonce,
      signature: row.signature,
      authorPublicKey: row.authorPublicKey,
      documentId: row.documentId,
      snapshotVersion: row.snapshotVersion,
    };
  }
}
