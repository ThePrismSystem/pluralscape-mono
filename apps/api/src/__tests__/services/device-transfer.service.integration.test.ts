import { randomBytes, randomUUID } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import {
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  DecryptionFailedError,
  PWHASH_SALT_BYTES,
} from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import { createPgAuthTables, pgInsertAccount } from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { toHex } from "../../lib/hex.js";
import { approveTransfer } from "../../services/device-transfer/approve.js";
import { completeTransfer } from "../../services/device-transfer/complete.js";
import {
  TransferExpiredError,
  TransferNotFoundError,
  TransferValidationError,
} from "../../services/device-transfer/errors.js";
import { initiateTransfer } from "../../services/device-transfer/initiate.js";
import { asDb, noopAudit, spyAudit } from "../helpers/integration-setup.js";

import type { AccountId, DeviceTransferRequestId, SessionId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ── Mock the KDF worker offload ───────────────────────────────────────
// deriveTransferKeyOffload uses a worker thread pool that requires the
// compiled kdf-worker-thread.js file. In vitest/Node integration tests
// the worker path resolution fails, so we mock the offload to return a
// deterministic 32-byte key. The real Argon2id derivation is covered by
// the crypto package's own tests and the unit test mocks.

const mockDeriveTransferKeyOffload = vi.fn(() => Promise.resolve(new Uint8Array(32)));

vi.mock("../../lib/kdf-offload.js", () => ({
  deriveTransferKeyOffload: () => mockDeriveTransferKeyOffload(),
  WorkerError: class WorkerError extends Error {
    override readonly name = "WorkerError" as const;
  },
}));

// Mock decryptFromTransfer: by default succeed (returns a 32-byte key).
// Tests for wrong-code paths override this to throw DecryptionFailedError.
const mockDecryptFromTransfer = vi.fn(() => new Uint8Array(32));

vi.mock("@pluralscape/crypto", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/crypto")>("@pluralscape/crypto");
  return {
    ...actual,
    decryptFromTransfer: () => mockDecryptFromTransfer(),
  };
});

// ── Schema for drizzle ────────────────────────────────────────────────

const { sessions, deviceTransferRequests } = schema;

// ── Helpers ───────────────────────────────────────────────────────────

/** 16-byte salt as hex (32 hex chars). */
function validSaltHex(): string {
  return toHex(randomBytes(PWHASH_SALT_BYTES));
}

/** Minimal valid encrypted payload hex: nonce (24) + tag (16) = 40 bytes. */
function validEncryptedHex(): string {
  return toHex(randomBytes(AEAD_NONCE_BYTES + AEAD_TAG_BYTES));
}

async function insertSession(
  db: PgliteDatabase<typeof schema>,
  accountId: AccountId,
): Promise<SessionId> {
  const sessionId = brandId<SessionId>(`sess_${randomUUID()}`);
  const now = Date.now();
  await db.insert(sessions).values({
    id: sessionId,
    accountId,
    tokenHash: `hash_${randomUUID()}`,
    createdAt: now,
    lastActive: now,
    expiresAt: now + 86_400_000,
  });
  return sessionId;
}

// ── Test suite ────────────────────────────────────────────────────────

describe("device-transfer.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let sessionId: SessionId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAuthTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    sessionId = await insertSession(db, accountId);
  }, 60_000);

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(deviceTransferRequests);
    vi.clearAllMocks();
    // Restore default mock implementations after clearAllMocks
    mockDeriveTransferKeyOffload.mockImplementation(() => Promise.resolve(new Uint8Array(32)));
    mockDecryptFromTransfer.mockImplementation(() => new Uint8Array(32));
  });

  // ── initiateTransfer ──────────────────────────────────────────────

  describe("initiateTransfer", () => {
    it("creates a pending transfer request and returns transferId + expiresAt", async () => {
      const audit = spyAudit();
      const result = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        audit,
      );

      expect(result.transferId).toMatch(/^dtr_/);
      expect(result.expiresAt).toBeGreaterThan(Date.now() - 1000);

      // Verify the row was written to the DB
      const [row] = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, result.transferId));

      expect(row?.accountId).toBe(accountId);
      expect(row?.sourceSessionId).toBe(sessionId);
      expect(row?.status).toBe("pending");
      expect(row?.codeAttempts).toBe(0);
      expect(row?.encryptedKeyMaterial).toBeInstanceOf(Uint8Array);
      expect(row?.codeSalt).toBeInstanceOf(Uint8Array);

      // Audit was recorded
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.device-transfer-initiated");
    });

    it("rejects codeSalt with wrong byte length", async () => {
      const badSaltHex = "00".repeat(8); // 8 bytes instead of 16

      await expect(
        initiateTransfer(
          asDb(db),
          accountId,
          sessionId,
          { codeSaltHex: badSaltHex, encryptedKeyMaterialHex: validEncryptedHex() },
          noopAudit,
        ),
      ).rejects.toThrow(TransferValidationError);
    });

    it("rejects invalid hex in codeSalt", async () => {
      await expect(
        initiateTransfer(
          asDb(db),
          accountId,
          sessionId,
          { codeSaltHex: "not-valid-hex!!", encryptedKeyMaterialHex: validEncryptedHex() },
          noopAudit,
        ),
      ).rejects.toThrow(TransferValidationError);
    });

    it("rejects encrypted payload that is too short to deserialize", async () => {
      const tooShortHex = "00".repeat(10); // 10 bytes, need at least 40

      await expect(
        initiateTransfer(
          asDb(db),
          accountId,
          sessionId,
          { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: tooShortHex },
          noopAudit,
        ),
      ).rejects.toThrow(TransferValidationError);
    });
  });

  // ── completeTransfer ──────────────────────────────────────────────

  describe("completeTransfer", () => {
    it("returns encrypted key material hex on valid code after approval", async () => {
      // Initiate and approve a transfer first
      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );
      await approveTransfer(asDb(db), transferId, accountId, sessionId, noopAudit);

      const targetSessionId = await insertSession(db, accountId);
      const audit = spyAudit();

      const result = await completeTransfer(
        asDb(db),
        transferId,
        accountId,
        targetSessionId,
        "1234567890", // Valid 10-digit code
        audit,
      );

      expect(typeof result.encryptedKeyMaterialHex).toBe("string");
      // 40 bytes = 80 hex chars (nonce + tag)
      expect(result.encryptedKeyMaterialHex.length).toBeGreaterThanOrEqual(80);

      // Transfer record should be deleted after successful completion
      const [row] = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, transferId));
      expect(row).toBeUndefined();

      // Audit was recorded
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.device-transfer-completed");
    });

    it("throws TransferNotFoundError when transfer has not been approved yet", async () => {
      // Initiate but do NOT approve
      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );

      const targetSessionId = await insertSession(db, accountId);

      // completeTransfer must require status='approved'; a 'pending' transfer
      // must not be completable (prevents brute-force racing around approval).
      await expect(
        completeTransfer(asDb(db), transferId, accountId, targetSessionId, "1234567890", noopAudit),
      ).rejects.toThrow(TransferNotFoundError);

      // Row should still exist in 'pending' state — completion did not mutate
      const [row] = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, transferId));
      expect(row?.status).toBe("pending");
      expect(row?.codeAttempts).toBe(0);
    });

    it("throws TransferNotFoundError for non-existent transferId", async () => {
      const targetSessionId = await insertSession(db, accountId);

      await expect(
        completeTransfer(
          asDb(db),
          brandId<DeviceTransferRequestId>("dtr_nonexistent"),
          accountId,
          targetSessionId,
          "1234567890",
          noopAudit,
        ),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("throws TransferValidationError for invalid code format", async () => {
      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );
      await approveTransfer(asDb(db), transferId, accountId, sessionId, noopAudit);

      const targetSessionId = await insertSession(db, accountId);

      // "abc" is not a valid 10-digit transfer code
      await expect(
        completeTransfer(asDb(db), transferId, accountId, targetSessionId, "abc", noopAudit),
      ).rejects.toThrow(TransferValidationError);
    });

    it("throws TransferNotFoundError for wrong accountId", async () => {
      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );
      await approveTransfer(asDb(db), transferId, accountId, sessionId, noopAudit);

      // Create a separate account
      const otherAccountId = brandId<AccountId>(await pgInsertAccount(db));
      const otherSessionId = await insertSession(db, otherAccountId);

      await expect(
        completeTransfer(
          asDb(db),
          transferId,
          otherAccountId,
          otherSessionId,
          "1234567890",
          noopAudit,
        ),
      ).rejects.toThrow(TransferNotFoundError);
    });
  });

  // ── Expired / invalid transfer ────────────────────────────────────

  describe("expired or invalid transfer", () => {
    it("throws TransferNotFoundError for an already-completed (deleted) transfer", async () => {
      // Initiate, approve, and complete a transfer
      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );
      await approveTransfer(asDb(db), transferId, accountId, sessionId, noopAudit);

      const targetSessionId = await insertSession(db, accountId);
      await completeTransfer(
        asDb(db),
        transferId,
        accountId,
        targetSessionId,
        "1234567890",
        noopAudit,
      );

      // Second attempt should fail — the record was deleted on completion
      const secondTargetSessionId = await insertSession(db, accountId);
      await expect(
        completeTransfer(
          asDb(db),
          transferId,
          accountId,
          secondTargetSessionId,
          "1234567890",
          noopAudit,
        ),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("throws TransferNotFoundError when transfer has been manually expired", async () => {
      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );

      // Approve first, then manually mark as expired — simulates the case
      // where cleanup ran between approval and completion.
      await approveTransfer(asDb(db), transferId, accountId, sessionId, noopAudit);
      await db
        .update(deviceTransferRequests)
        .set({ status: "expired" })
        .where(eq(deviceTransferRequests.id, transferId));

      const targetSessionId = await insertSession(db, accountId);
      await expect(
        completeTransfer(asDb(db), transferId, accountId, targetSessionId, "1234567890", noopAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("throws TransferNotFoundError when expiresAt is in the past", async () => {
      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );
      await approveTransfer(asDb(db), transferId, accountId, sessionId, noopAudit);

      // Set expiresAt to a time in the past (the check constraint requires
      // expiresAt > createdAt, so we set both to the past)
      const pastTime = Date.now() - 600_000;
      await db
        .update(deviceTransferRequests)
        .set({ createdAt: pastTime - 1000, expiresAt: pastTime })
        .where(eq(deviceTransferRequests.id, transferId));

      const targetSessionId = await insertSession(db, accountId);
      // The WHERE clause filters by gt(expiresAt, sql`now()`) so expired records are invisible
      await expect(
        completeTransfer(asDb(db), transferId, accountId, targetSessionId, "1234567890", noopAudit),
      ).rejects.toThrow(TransferNotFoundError);
    });

    it("expires transfer after max incorrect code attempts", async () => {
      // Configure decryptFromTransfer to simulate wrong code
      mockDecryptFromTransfer.mockImplementation(() => {
        throw new DecryptionFailedError("wrong key");
      });

      const { transferId } = await initiateTransfer(
        asDb(db),
        accountId,
        sessionId,
        { codeSaltHex: validSaltHex(), encryptedKeyMaterialHex: validEncryptedHex() },
        noopAudit,
      );
      await approveTransfer(asDb(db), transferId, accountId, sessionId, noopAudit);

      const targetSessionId = await insertSession(db, accountId);

      // MAX_TRANSFER_CODE_ATTEMPTS is 5, so attempts 1-4 should throw TransferCodeError
      // and attempt 5 should throw TransferExpiredError
      for (let i = 1; i <= 4; i++) {
        await expect(
          completeTransfer(
            asDb(db),
            transferId,
            accountId,
            targetSessionId,
            "1234567890",
            noopAudit,
          ),
        ).rejects.toThrow("Incorrect transfer code");
      }

      // Fifth attempt triggers expiration
      await expect(
        completeTransfer(asDb(db), transferId, accountId, targetSessionId, "1234567890", noopAudit),
      ).rejects.toThrow(TransferExpiredError);

      // Verify the status was set to expired in the DB
      const [row] = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, transferId));
      expect(row?.status).toBe("expired");
    });
  });
});
