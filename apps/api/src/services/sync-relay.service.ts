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
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** Any Drizzle PG database instance (PostgresJs, PGlite, etc). */
type AnyPgDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/**
 * PostgreSQL-backed implementation of SyncRelayService.
 *
 * Document IDs encode the systemId in their prefix (e.g. "system-core-sys_abc"),
 * making them globally unique. Operational methods scope implicitly via documentId,
 * so no separate systemId filter is needed on individual change/snapshot queries.
 */
export class PgSyncRelayService implements SyncRelayService {
  constructor(private readonly db: AnyPgDatabase) {}

  async submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): Promise<number> {
    return await this.db.transaction(async (tx) => {
      // Check for existing row by dedup key (documentId, authorPublicKey, nonce)
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

      // Idempotent replay: return existing seq without burning a new one
      if (existing) {
        return existing.seq;
      }

      // Atomically increment last_seq and get the new value
      const [updated] = await tx
        .update(syncDocuments)
        .set({
          lastSeq: sql`${syncDocuments.lastSeq} + 1`,
          updatedAt: Date.now(),
        })
        .where(eq(syncDocuments.documentId, envelope.documentId))
        .returning({ lastSeq: syncDocuments.lastSeq });

      if (!updated) {
        throw new Error(`Document not found: ${envelope.documentId}`);
      }

      const seq = updated.lastSeq;

      // Insert the change (no onConflictDoNothing — dedup is already handled above)
      await tx.insert(syncChanges).values({
        id: createId(ID_PREFIXES.syncChange),
        documentId: envelope.documentId,
        seq,
        encryptedPayload: envelope.ciphertext,
        authorPublicKey: envelope.authorPublicKey,
        nonce: envelope.nonce,
        signature: envelope.signature,
        createdAt: Date.now(),
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

    return rows.map((row) => ({
      ciphertext: row.encryptedPayload,
      nonce: row.nonce as EncryptedChangeEnvelope["nonce"],
      signature: row.signature as EncryptedChangeEnvelope["signature"],
      authorPublicKey: row.authorPublicKey as EncryptedChangeEnvelope["authorPublicKey"],
      documentId: row.documentId,
      seq: row.seq,
    }));
  }

  async submitSnapshot(envelope: EncryptedSnapshotEnvelope): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Lock the document row to prevent TOCTOU races
      const [doc] = await tx
        .select({ snapshotVersion: syncDocuments.snapshotVersion })
        .from(syncDocuments)
        .where(eq(syncDocuments.documentId, envelope.documentId))
        .for("update");

      if (!doc) {
        throw new Error(`Document not found: ${envelope.documentId}`);
      }

      if (doc.snapshotVersion >= envelope.snapshotVersion) {
        throw new Error(
          `Snapshot version ${String(envelope.snapshotVersion)} ${SNAPSHOT_VERSION_CONFLICT_MESSAGE} ${String(doc.snapshotVersion)}`,
        );
      }

      // Upsert snapshot
      const now = Date.now();
      await tx
        .insert(syncSnapshots)
        .values({
          documentId: envelope.documentId,
          snapshotVersion: envelope.snapshotVersion,
          lastSeq: envelope.lastSeq,
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
            lastSeq: envelope.lastSeq,
            encryptedPayload: envelope.ciphertext,
            authorPublicKey: envelope.authorPublicKey,
            nonce: envelope.nonce,
            signature: envelope.signature,
            createdAt: now,
          },
        });

      // Update document metadata
      await tx
        .update(syncDocuments)
        .set({
          snapshotVersion: envelope.snapshotVersion,
          updatedAt: now,
        })
        .where(eq(syncDocuments.documentId, envelope.documentId));
    });
  }

  async getLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const [row] = await this.db
      .select()
      .from(syncSnapshots)
      .where(eq(syncSnapshots.documentId, documentId));

    if (!row) return null;

    return {
      ciphertext: row.encryptedPayload,
      nonce: row.nonce as EncryptedSnapshotEnvelope["nonce"],
      signature: row.signature as EncryptedSnapshotEnvelope["signature"],
      authorPublicKey: row.authorPublicKey as EncryptedSnapshotEnvelope["authorPublicKey"],
      documentId: row.documentId,
      snapshotVersion: row.snapshotVersion,
      lastSeq: row.lastSeq,
    };
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
      bucketId: row.bucketId ?? null,
      channelId: row.channelId ?? null,
      timePeriod: row.timePeriod,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sizeBytes: row.sizeBytes,
      snapshotVersion: row.snapshotVersion,
      archived: row.archived,
    }));

    return { documents, systemId };
  }
}
