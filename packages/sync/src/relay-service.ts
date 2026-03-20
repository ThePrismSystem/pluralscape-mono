import type { SyncManifest } from "./adapters/network-adapter.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";

/**
 * Server-side relay service interface for encrypted sync operations.
 *
 * Both the in-memory `EncryptedRelay` (tests) and `PgSyncRelayService`
 * (production) implement this interface. All methods are async because
 * the PG implementation needs transactions.
 */
export interface SyncRelayService {
  /** Submit an encrypted change. Returns the server-assigned seq number. */
  submit(envelope: Omit<EncryptedChangeEnvelope, "seq">): Promise<number>;

  /** Fetch all encrypted change envelopes with seq > sinceSeq. */
  getEnvelopesSince(
    documentId: string,
    sinceSeq: number,
    limit?: number,
  ): Promise<readonly EncryptedChangeEnvelope[]>;

  /** Submit an encrypted snapshot. Throws on version conflict. */
  submitSnapshot(envelope: EncryptedSnapshotEnvelope): Promise<void>;

  /** Get the latest snapshot for a document. */
  getLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null>;

  /** Get the document manifest for a system. */
  getManifest(systemId: string): Promise<SyncManifest>;
}
