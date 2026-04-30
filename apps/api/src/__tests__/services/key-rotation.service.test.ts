import { ROTATION_ITEM_STATUSES, ROTATION_STATES, brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { BucketId, BucketKeyRotationId, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { initiateRotation } = await import("../../services/bucket/rotations/initiate.js");
const { claimRotationChunk } = await import("../../services/bucket/rotations/claim.js");
const { completeRotationChunk } = await import("../../services/bucket/rotations/complete.js");
const { getRotationProgress } = await import("../../services/bucket/rotations/queries.js");
const { retryRotation } = await import("../../services/bucket/rotations/retry.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const BUCKET_ID = brandId<BucketId>("bkt_test-bucket");
const ROTATION_ID = brandId<BucketKeyRotationId>("bkr_test-rotation");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeRotationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ROTATION_ID,
    bucketId: BUCKET_ID,
    systemId: SYSTEM_ID,
    fromKeyVersion: 1,
    toKeyVersion: 2,
    state: ROTATION_STATES.initiated,
    initiatedAt: 1000000,
    completedAt: null,
    totalItems: 3,
    completedItems: 0,
    failedItems: 0,
    ...overrides,
  };
}

function makeItemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "bri_test-item",
    rotationId: ROTATION_ID,
    entityType: "member",
    entityId: "mem_entity-1",
    status: ROTATION_ITEM_STATUSES.pending,
    claimedBy: null,
    claimedAt: null,
    completedAt: null,
    attempts: 0,
    ...overrides,
  };
}

const VALID_INITIATE_PARAMS = {
  wrappedNewKey: Buffer.alloc(32).toString("base64"),
  newKeyVersion: 2,
  friendKeyGrants: [],
};

const VALID_CLAIM_PARAMS = {
  chunkSize: 10,
};

// ── Tests ────────────────────────────────────────────────────────────

describe("key-rotation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── initiateRotation ─────────────────────────────────────────────

  describe("initiateRotation", () => {
    it("creates a rotation with no existing active rotation and no content tags", async () => {
      const { db, chain } = mockDb();

      // No active rotation check
      chain.limit.mockResolvedValueOnce([]);
      // Transaction: content tags
      chain.select.mockReturnValue(chain);
      chain.from.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      // tags query returns empty
      chain.where.mockReturnValueOnce({
        ...chain,
        then: (resolve: (val: unknown[]) => void) => {
          resolve([]);
        },
      });
      // rotation insert returning
      chain.returning.mockResolvedValueOnce([makeRotationRow({ totalItems: 0 })]);
      // key grant update (revoke)
      chain.where.mockReturnValue(chain);

      const result = await initiateRotation(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        VALID_INITIATE_PARAMS,
        AUTH,
        mockAudit,
      );

      expect(result.id).toBe(ROTATION_ID);
      expect(result.bucketId).toBe(BUCKET_ID);
      expect(result.state).toBe(ROTATION_STATES.initiated);
      expect(result.fromKeyVersion).toBe(1);
      expect(result.toKeyVersion).toBe(2);
    });

    it("throws ROTATION_IN_PROGRESS when a migrating rotation is active", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.migrating })]);

      await expect(
        initiateRotation(db, SYSTEM_ID, BUCKET_ID, VALID_INITIATE_PARAMS, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ROTATION_IN_PROGRESS" }));
    });

    it("throws ROTATION_IN_PROGRESS when a sealing rotation is active", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.sealing })]);

      await expect(
        initiateRotation(db, SYSTEM_ID, BUCKET_ID, VALID_INITIATE_PARAMS, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ROTATION_IN_PROGRESS" }));
    });

    it("cancels an initiated (unclaimed) rotation and proceeds", async () => {
      const { db, chain } = mockDb();

      // Returns an initiated rotation
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.initiated })]);
      // update to failed (cancel)
      chain.where.mockReturnValue(chain);
      // Transaction: tags query returns 1 tag
      chain.returning
        .mockResolvedValueOnce([makeRotationRow({ totalItems: 1 })]) // rotation insert
        .mockResolvedValueOnce([]); // items insert (no returning needed)

      const result = await initiateRotation(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        VALID_INITIATE_PARAMS,
        AUTH,
        mockAudit,
      );

      expect(typeof result).toBe("object");
      expect(chain.update).toHaveBeenCalled();
    });

    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      chain.returning.mockResolvedValueOnce([makeRotationRow({ totalItems: 0 })]);

      await initiateRotation(db, SYSTEM_ID, BUCKET_ID, VALID_INITIATE_PARAMS, AUTH, mockAudit);

      expect(assertSystemOwnership).toHaveBeenCalledWith(SYSTEM_ID, AUTH);
    });

    it("inserts key grants when friendKeyGrants are provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      chain.returning.mockResolvedValueOnce([makeRotationRow({ totalItems: 0 })]);

      const paramsWithGrants = {
        wrappedNewKey: Buffer.alloc(32).toString("base64"),
        newKeyVersion: 2,
        friendKeyGrants: [
          { friendAccountId: "acct_friend", encryptedKey: Buffer.alloc(32).toString("base64") },
        ],
      };

      const result = await initiateRotation(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        paramsWithGrants,
        AUTH,
        mockAudit,
      );

      expect(typeof result).toBe("object");
      // insert called for rotation and key grants
      expect(chain.insert).toHaveBeenCalled();
    });

    it("calls audit with bucket.key_rotation.initiated", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      chain.returning.mockResolvedValueOnce([makeRotationRow({ totalItems: 0 })]);

      await initiateRotation(db, SYSTEM_ID, BUCKET_ID, VALID_INITIATE_PARAMS, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "bucket.key_rotation.initiated" }),
      );
    });
  });

  // ── claimRotationChunk ───────────────────────────────────────────

  describe("claimRotationChunk", () => {
    it("returns claimed items and transitions state from initiated to migrating", async () => {
      const { db, chain } = mockDb();

      // Rotation lookup
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.initiated })]);
      // Reclaim stale (update, no return needed)
      chain.where.mockReturnValue(chain);
      // Pending items query
      chain.limit.mockResolvedValueOnce([{ id: "bri_item-1" }]);
      // CAS claim returning
      chain.returning.mockResolvedValueOnce([
        makeItemRow({ status: ROTATION_ITEM_STATUSES.claimed, claimedBy: AUTH.sessionId }),
      ]);
      // Transition initiated → migrating (update)
      chain.where.mockReturnValue(chain);

      const result = await claimRotationChunk(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        ROTATION_ID,
        VALID_CLAIM_PARAMS,
        AUTH,
      );

      expect(result.rotationState).toBe(ROTATION_STATES.migrating);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe(ROTATION_ITEM_STATUSES.claimed);
    });

    it("returns empty items when no pending work", async () => {
      const { db, chain } = mockDb();

      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.migrating })]);
      // Pending items: none
      chain.limit.mockResolvedValueOnce([]);

      const result = await claimRotationChunk(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        ROTATION_ID,
        VALID_CLAIM_PARAMS,
        AUTH,
      );

      expect(result.data).toHaveLength(0);
      expect(result.rotationState).toBe(ROTATION_STATES.migrating);
    });

    it("throws NOT_FOUND when rotation does not exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        claimRotationChunk(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, VALID_CLAIM_PARAMS, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws CONFLICT when rotation is in completed state", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.completed })]);

      await expect(
        claimRotationChunk(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, VALID_CLAIM_PARAMS, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws CONFLICT when rotation is in failed state", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.failed })]);

      await expect(
        claimRotationChunk(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, VALID_CLAIM_PARAMS, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("does not transition state when rotation is already migrating", async () => {
      const { db, chain } = mockDb();

      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.migrating })]);
      chain.limit.mockResolvedValueOnce([{ id: "bri_item-1" }]);
      chain.returning.mockResolvedValueOnce([
        makeItemRow({ status: ROTATION_ITEM_STATUSES.claimed, claimedBy: AUTH.sessionId }),
      ]);

      const result = await claimRotationChunk(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        ROTATION_ID,
        VALID_CLAIM_PARAMS,
        AUTH,
      );

      expect(result.rotationState).toBe(ROTATION_STATES.migrating);
      // update called for stale reclaim, but NOT for state transition
      // (the state transition update is conditional on currentState === "initiated")
      expect(result.data).toHaveLength(1);
    });

    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.migrating })]);
      chain.limit.mockResolvedValueOnce([]);

      await claimRotationChunk(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, VALID_CLAIM_PARAMS, AUTH);

      expect(assertSystemOwnership).toHaveBeenCalledWith(SYSTEM_ID, AUTH);
    });
  });

  // ── completeRotationChunk ────────────────────────────────────────

  describe("completeRotationChunk", () => {
    // completeRotationChunk uses .for("update") in a transaction.
    // We extend the chain with a `for` stub that returns the chain.
    function mockDbWithFor() {
      const { db, chain } = mockDb();
      return { db, chain };
    }

    it("throws NOT_FOUND when rotation does not exist inside transaction", async () => {
      const { db, chain } = mockDbWithFor();
      // Transaction rotation lock returns nothing
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        completeRotationChunk(
          db,
          SYSTEM_ID,
          BUCKET_ID,
          ROTATION_ID,
          { items: [{ itemId: "bri_item-1", status: ROTATION_ITEM_STATUSES.completed }] },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws CONFLICT when rotation is not in migrating state", async () => {
      const { db, chain } = mockDbWithFor();
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.initiated })]);

      await expect(
        completeRotationChunk(
          db,
          SYSTEM_ID,
          BUCKET_ID,
          ROTATION_ID,
          { items: [{ itemId: "bri_item-1", status: ROTATION_ITEM_STATUSES.completed }] },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("updates counters when items remain and no transition", async () => {
      const { db, chain } = mockDbWithFor();

      // Rotation: 5 total, 1 completed, 0 failed
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.migrating,
          totalItems: 5,
          completedItems: 1,
          failedItems: 0,
        }),
      ]);
      // item update returning (completed)
      chain.returning.mockResolvedValueOnce([
        makeItemRow({ status: ROTATION_ITEM_STATUSES.completed }),
      ]);
      // counters update (no returning needed)
      // final rotation select
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.migrating,
          totalItems: 5,
          completedItems: 2,
          failedItems: 0,
        }),
      ]);

      const result = await completeRotationChunk(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        ROTATION_ID,
        { items: [{ itemId: "bri_item-1", status: ROTATION_ITEM_STATUSES.completed }] },
        AUTH,
        mockAudit,
      );

      expect(result.transitioned).toBe(false);
      expect(result.rotation.state).toBe(ROTATION_STATES.migrating);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "bucket.key_rotation.chunk_completed" }),
      );
    });

    // NOTE: State transition tests (sealing → completed/failed) require complex
    // mock chain orchestration and are better covered by integration tests.

    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDbWithFor();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        completeRotationChunk(
          db,
          SYSTEM_ID,
          BUCKET_ID,
          ROTATION_ID,
          { items: [] },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow();

      expect(assertSystemOwnership).toHaveBeenCalledWith(SYSTEM_ID, AUTH);
    });

    it("always emits chunk_completed audit event", async () => {
      const { db, chain } = mockDbWithFor();

      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.migrating,
          totalItems: 5,
          completedItems: 0,
          failedItems: 0,
        }),
      ]);
      chain.returning.mockResolvedValueOnce([
        makeItemRow({ status: ROTATION_ITEM_STATUSES.completed }),
      ]);
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.migrating,
          totalItems: 5,
          completedItems: 1,
          failedItems: 0,
        }),
      ]);

      await completeRotationChunk(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        ROTATION_ID,
        { items: [{ itemId: "bri_item-1", status: ROTATION_ITEM_STATUSES.completed }] },
        AUTH,
        mockAudit,
      );

      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "bucket.key_rotation.chunk_completed" }),
      );
    });

    it("calls .for('update') on the rotation record lock to prevent concurrent sealing", async () => {
      const { db, chain } = mockDbWithFor();

      // Rotation lookup with lock returns existing rotation
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.migrating,
          totalItems: 5,
          completedItems: 0,
          failedItems: 0,
        }),
      ]);
      chain.returning.mockResolvedValueOnce([
        makeItemRow({ status: ROTATION_ITEM_STATUSES.completed }),
      ]);
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.migrating,
          totalItems: 5,
          completedItems: 1,
          failedItems: 0,
        }),
      ]);

      await completeRotationChunk(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        ROTATION_ID,
        { items: [{ itemId: "bri_item-1", status: ROTATION_ITEM_STATUSES.completed }] },
        AUTH,
        mockAudit,
      );

      expect(chain.for).toHaveBeenCalledWith("update");
    });
  });

  // ── retryRotation ────────────────────────────────────────────────

  describe("retryRotation", () => {
    it("resets failed items and transitions to migrating", async () => {
      const { db, chain } = mockDb();
      // FOR UPDATE lock: rotation in failed state
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.failed,
          totalItems: 10,
          completedItems: 5,
          failedItems: 5,
        }),
      ]);
      // Reset failed items returning
      chain.returning
        .mockResolvedValueOnce([{ id: "bri_1" }, { id: "bri_2" }, { id: "bri_3" }])
        // Update rotation state returning
        .mockResolvedValueOnce([
          makeRotationRow({
            state: ROTATION_STATES.migrating,
            failedItems: 0,
          }),
        ]);

      const result = await retryRotation(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH, mockAudit);

      expect(result.state).toBe(ROTATION_STATES.migrating);
      expect(result.failedItems).toBe(0);
      expect(chain.for).toHaveBeenCalledWith("update");
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({
          eventType: "bucket.key_rotation.retried",
          // Detail must spell out both the reset count and the state transition
          // to disambiguate from a per-item "retry count" interpretation.
          detail:
            "Rotation retry: reset 3 failed items to pending (rotation state failed → migrating)",
        }),
      );
    });

    it("throws NOT_FOUND when rotation does not exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        retryRotation(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws CONFLICT when rotation state is not failed", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeRotationRow({ state: ROTATION_STATES.migrating })]);

      await expect(
        retryRotation(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws on ownership failure", async () => {
      const { db } = mockDb();
      vi.mocked(assertSystemOwnership).mockImplementationOnce(() => {
        throw new Error("System not found");
      });

      await expect(
        retryRotation(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH, mockAudit),
      ).rejects.toThrow("System not found");
    });
  });

  // ── getRotationProgress ──────────────────────────────────────────

  describe("getRotationProgress", () => {
    it("returns the rotation progress when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({ state: ROTATION_STATES.migrating, completedItems: 1, failedItems: 0 }),
      ]);

      const result = await getRotationProgress(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH);

      expect(result.id).toBe(ROTATION_ID);
      expect(result.state).toBe(ROTATION_STATES.migrating);
      expect(result.completedItems).toBe(1);
      expect(result.failedItems).toBe(0);
    });

    it("throws NOT_FOUND when rotation does not exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        getRotationProgress(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("returns completed rotation", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        makeRotationRow({
          state: ROTATION_STATES.completed,
          completedItems: 3,
          failedItems: 0,
          completedAt: 1000000,
        }),
      ]);

      const result = await getRotationProgress(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH);

      expect(result.state).toBe(ROTATION_STATES.completed);
      expect(result.completedAt).toBe(1000000);
    });

    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeRotationRow()]);

      await getRotationProgress(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH);

      expect(assertSystemOwnership).toHaveBeenCalledWith(SYSTEM_ID, AUTH);
    });

    it("maps all rotation fields correctly", async () => {
      const { db, chain } = mockDb();
      const row = makeRotationRow({
        state: ROTATION_STATES.migrating,
        fromKeyVersion: 3,
        toKeyVersion: 4,
        totalItems: 10,
        completedItems: 7,
        failedItems: 1,
        initiatedAt: 999,
        completedAt: null,
      });
      chain.limit.mockResolvedValueOnce([row]);

      const result = await getRotationProgress(db, SYSTEM_ID, BUCKET_ID, ROTATION_ID, AUTH);

      expect(result).toMatchObject({
        id: ROTATION_ID,
        bucketId: BUCKET_ID,
        fromKeyVersion: 3,
        toKeyVersion: 4,
        state: ROTATION_STATES.migrating,
        initiatedAt: 999,
        completedAt: null,
        totalItems: 10,
        completedItems: 7,
        failedItems: 1,
      });
    });
  });
});
