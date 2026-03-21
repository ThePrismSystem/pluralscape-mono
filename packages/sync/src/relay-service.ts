import type { SyncManifest } from "./adapters/network-adapter.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

/** Result of a paginated envelope fetch. */
export interface PaginatedEnvelopes {
  readonly envelopes: readonly EncryptedChangeEnvelope[];
  /** True when additional envelopes exist beyond the returned page. */
  readonly hasMore: boolean;
}

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

  /**
   * Fetch encrypted change envelopes with seq > sinceSeq.
   *
   * Results are capped at `limit` rows. When more rows exist beyond the
   * returned page, `hasMore` is true and the caller should re-fetch using
   * the last envelope's seq as the new `sinceSeq`.
   */
  getEnvelopesSince(
    documentId: SyncDocumentId,
    sinceSeq: number,
    limit?: number,
  ): Promise<PaginatedEnvelopes>;

  /** Submit an encrypted snapshot. Throws on version conflict. */
  submitSnapshot(envelope: EncryptedSnapshotEnvelope): Promise<void>;

  /** Get the latest snapshot for a document. */
  getLatestSnapshot(documentId: SyncDocumentId): Promise<EncryptedSnapshotEnvelope | null>;

  /** Get the document manifest for a system. */
  getManifest(systemId: SystemId): Promise<SyncManifest>;
}
