import { DocumentNotFoundError, SnapshotVersionConflictError } from "@pluralscape/sync";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PgSyncRelayService } from "../../services/sync-relay.service.js";
import { mockDb } from "../helpers/mock-db.js";

import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "@pluralscape/sync";
import type { SystemId } from "@pluralscape/types";

function nonce(fill: number): AeadNonce {
  const bytes: unknown = new Uint8Array(24).fill(fill);
  return bytes as AeadNonce;
}

function pubkey(fill: number): SignPublicKey {
  const bytes: unknown = new Uint8Array(32).fill(fill);
  return bytes as SignPublicKey;
}

function sig(fill: number): Signature {
  const bytes: unknown = new Uint8Array(64).fill(fill);
  return bytes as Signature;
}

/** Build a minimal change envelope (without seq). */
function makeEnvelope(documentId: string): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    documentId,
    ciphertext: new Uint8Array([0xde, 0xad]),
    authorPublicKey: pubkey(0x01),
    nonce: nonce(0x02),
    signature: sig(0x77),
  };
}

/** Build a minimal snapshot envelope. */
function makeSnapshotEnvelope(documentId: string, snapshotVersion = 1): EncryptedSnapshotEnvelope {
  return {
    documentId,
    snapshotVersion,
    ciphertext: new Uint8Array([0xca, 0xfe]),
    authorPublicKey: pubkey(0x03),
    nonce: nonce(0x04),
    signature: sig(0x88),
  };
}

describe("PgSyncRelayService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("submit", () => {
    it("increments lastSeq and inserts change with ON CONFLICT", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      // UPDATE .set().where().returning() -> new seq
      chain.returning.mockResolvedValueOnce([{ lastSeq: 5 }]);
      // INSERT .values().onConflictDoNothing().returning() -> inserted row
      chain.returning.mockResolvedValueOnce([{ seq: 5 }]);

      const envelope = makeEnvelope("doc-1");
      const seq = await service.submit(envelope);

      expect(seq).toBe(5);
    });

    it("throws DocumentNotFoundError when document not found", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      // UPDATE returning (no rows — document not found)
      chain.returning.mockResolvedValueOnce([]);

      await expect(service.submit(makeEnvelope("missing-doc"))).rejects.toThrow(
        DocumentNotFoundError,
      );
    });

    it("returns existing seq on dedup hit (ON CONFLICT DO NOTHING)", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      // Call order for .where():
      // 1. update().set().where().returning() -> chain (for returning chaining)
      // 2. update().set().where() -> chain (rollback, no returning)
      // 3. select().from().where() -> [{ seq: 3 }] (the SELECT result)
      chain.where
        .mockReturnValueOnce(chain) // 1st: initial UPDATE where
        .mockReturnValueOnce(chain) // 2nd: rollback UPDATE where
        .mockResolvedValueOnce([{ seq: 3 }]); // 3rd: SELECT where

      // Call order for .returning():
      // 1. update .returning() -> [{ lastSeq: 4 }]
      // 2. insert .returning() -> [] (dedup hit, ON CONFLICT DO NOTHING)
      chain.returning.mockResolvedValueOnce([{ lastSeq: 4 }]).mockResolvedValueOnce([]);

      const seq = await service.submit(makeEnvelope("doc-1"));

      expect(seq).toBe(3);
    });

    it("throws assertion Error (not DocumentNotFoundError) when dedup row is missing", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      // UPDATE returns a row (document exists)
      chain.returning.mockResolvedValueOnce([{ lastSeq: 4 }]);
      // INSERT returns empty (dedup hit)
      chain.returning.mockResolvedValueOnce([]);
      // Rollback UPDATE where
      chain.where.mockReturnValueOnce(chain).mockReturnValueOnce(chain);
      // SELECT where returns empty — the "impossible" edge case
      chain.where.mockResolvedValueOnce([]);

      try {
        await service.submit(makeEnvelope("doc-dedup-missing"));
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(DocumentNotFoundError);
        expect((err as Error).message).toContain("Dedup change row unexpectedly missing");
      }
    });
  });

  describe("getEnvelopesSince", () => {
    it("maps rows including signature", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      const row = {
        id: "sc_abc",
        documentId: "doc-1",
        seq: 2,
        encryptedPayload: new Uint8Array([0x01]),
        authorPublicKey: new Uint8Array(32).fill(0x05),
        nonce: new Uint8Array(24).fill(0x06),
        signature: new Uint8Array(64).fill(0x77),
        createdAt: Date.now(),
      };

      chain.orderBy.mockResolvedValueOnce([row]);

      const result = await service.getEnvelopesSince("doc-1", 1);

      expect(result).toHaveLength(1);
      expect(result[0]?.signature).toEqual(row.signature);
      expect(result[0]?.ciphertext).toEqual(row.encryptedPayload);
      expect(result[0]?.documentId).toBe("doc-1");
      expect(result[0]?.seq).toBe(2);
    });

    it("returns empty for no matches", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.getEnvelopesSince("doc-1", 0);

      expect(result).toEqual([]);
    });
  });

  describe("submitSnapshot", () => {
    it("atomically updates version and upserts snapshot with signature", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      // Atomic UPDATE returning
      chain.returning.mockResolvedValueOnce([{ snapshotVersion: 2 }]);
      // Upsert onConflictDoUpdate
      const onConflictDoUpdate = vi.fn().mockResolvedValueOnce(undefined);
      chain.values.mockReturnValueOnce({ onConflictDoUpdate });

      await expect(service.submitSnapshot(makeSnapshotEnvelope("doc-1", 2))).resolves.not.toThrow();
    });

    it("throws VERSION_CONFLICT when not newer", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      // Atomic UPDATE returns 0 rows
      chain.where.mockReturnValueOnce(chain); // UPDATE .where() — must chain
      chain.returning.mockResolvedValueOnce([]);
      // SELECT finds doc with higher version
      chain.where.mockResolvedValueOnce([{ snapshotVersion: 5 }]);

      await expect(service.submitSnapshot(makeSnapshotEnvelope("doc-1", 3))).rejects.toThrow(
        SnapshotVersionConflictError,
      );
    });

    it("throws DocumentNotFoundError when document not found", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      // Atomic UPDATE returns 0 rows
      chain.where.mockReturnValueOnce(chain); // UPDATE .where() — must chain
      chain.returning.mockResolvedValueOnce([]);
      // SELECT returns empty
      chain.where.mockResolvedValueOnce([]);

      await expect(service.submitSnapshot(makeSnapshotEnvelope("missing", 1))).rejects.toThrow(
        DocumentNotFoundError,
      );
    });
  });

  describe("getLatestSnapshot", () => {
    it("maps row including signature", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      const row = {
        documentId: "doc-1",
        snapshotVersion: 3,
        encryptedPayload: new Uint8Array([0xca]),
        authorPublicKey: new Uint8Array(32).fill(0x07),
        nonce: new Uint8Array(24).fill(0x08),
        signature: new Uint8Array(64).fill(0x88),
        createdAt: Date.now(),
      };

      chain.where.mockResolvedValueOnce([row]);

      const result = await service.getLatestSnapshot("doc-1");

      expect(result).not.toBeNull();
      expect(result?.signature).toEqual(row.signature);
      expect(result?.ciphertext).toEqual(row.encryptedPayload);
      expect(result?.snapshotVersion).toBe(3);
    });

    it("returns null when no snapshot", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      chain.where.mockResolvedValueOnce([]);

      const result = await service.getLatestSnapshot("doc-1");

      expect(result).toBeNull();
    });
  });

  describe("getManifest", () => {
    it("returns documents for systemId", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      const now = Date.now();
      chain.where.mockResolvedValueOnce([
        {
          documentId: "doc-1",
          systemId: "sys-1",
          docType: "system-core",
          sizeBytes: 100,
          snapshotVersion: 1,
          lastSeq: 5,
          archived: false,
          timePeriod: null,
          keyType: "derived",
          bucketId: null,
          channelId: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const manifest = await service.getManifest("sys-1" as SystemId);

      expect(manifest.systemId).toBe("sys-1");
      expect(manifest.documents).toHaveLength(1);
      expect(manifest.documents[0]?.docId).toBe("doc-1");
      expect(manifest.documents[0]?.bucketId).toBeNull();
      expect(manifest.documents[0]?.channelId).toBeNull();
    });

    it("returns empty for no matches", async () => {
      const { db, chain } = mockDb();
      const service = new PgSyncRelayService(db);

      chain.where.mockResolvedValueOnce([]);

      const manifest = await service.getManifest("sys-nonexistent" as SystemId);

      expect(manifest.systemId).toBe("sys-nonexistent");
      expect(manifest.documents).toEqual([]);
    });
  });
});
