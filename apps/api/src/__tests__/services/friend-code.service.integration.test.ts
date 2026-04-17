import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));

import { MAX_FRIEND_CODES_PER_ACCOUNT } from "../../quota.constants.js";
import {
  archiveFriendCode,
  generateFriendCode,
  listFriendCodes,
  redeemFriendCode,
} from "../../services/friend-code.service.js";
import { assertApiError, asDb, noopAudit, spyAudit } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, FriendCodeId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { friendCodes, friendConnections } = schema;

describe("friend-code.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  // Account A — the code generator
  let accountIdA: AccountId;
  let systemIdA: SystemId;
  let authA: AuthContext;

  // Account B — the code redeemer
  let accountIdB: AccountId;
  let systemIdB: SystemId;
  let authB: AuthContext;

  function makeAccountAuth(accountId: AccountId, systemId: SystemId): AuthContext {
    return {
      authMethod: "session" as const,
      accountId,
      systemId,
      sessionId: `sess_${crypto.randomUUID()}` as never,
      accountType: "system",
      ownedSystemIds: new Set([systemId]),
      auditLogIpTracking: false,
    };
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);

    accountIdA = brandId<AccountId>(await pgInsertAccount(db));
    systemIdA = brandId<SystemId>(await pgInsertSystem(db, accountIdA));
    authA = makeAccountAuth(accountIdA, systemIdA);

    accountIdB = brandId<AccountId>(await pgInsertAccount(db));
    systemIdB = brandId<SystemId>(await pgInsertSystem(db, accountIdB));
    authB = makeAccountAuth(accountIdB, systemIdB);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(friendConnections);
    await db.delete(friendCodes);
  });

  // ── generateFriendCode ────────────────────────────────────────────

  describe("generateFriendCode", () => {
    it("returns result with frc_ id and XXXX-XXXX code", async () => {
      const result = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);

      expect(result.id).toMatch(/^frc_/);
      expect(result.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(result.accountId).toBe(accountIdA);
      expect(result.archived).toBe(false);
      expect(result.expiresAt).toBeNull();
    });

    it("supports optional expiresAt", async () => {
      const expiresAt = Date.now() + 86_400_000;
      const result = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit, {
        expiresAt,
      });

      expect(result.expiresAt).toBe(expiresAt);
    });

    it("writes audit event", async () => {
      const audit = spyAudit();
      await generateFriendCode(asDb(db), accountIdA, authA, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-code.generated");
    });

    it("enforces quota (QUOTA_EXCEEDED)", async () => {
      // Generate max codes
      for (let i = 0; i < MAX_FRIEND_CODES_PER_ACCOUNT; i++) {
        await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      }

      await assertApiError(
        generateFriendCode(asDb(db), accountIdA, authA, noopAudit),
        "QUOTA_EXCEEDED",
        400,
      );
    });
  });

  // ── listFriendCodes ───────────────────────────────────────────────

  describe("listFriendCodes", () => {
    it("returns only active non-expired codes", async () => {
      await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);

      const result = await listFriendCodes(asDb(db), accountIdA, authA);

      expect(result.data).toHaveLength(2);
      for (const code of result.data) {
        expect(code.archived).toBe(false);
      }
    });

    it("excludes archived codes", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      await archiveFriendCode(asDb(db), accountIdA, created.id, authA, noopAudit);

      const result = await listFriendCodes(asDb(db), accountIdA, authA);

      const ids = result.data.map((c) => c.id);
      expect(ids).not.toContain(created.id);
    });

    it("returns empty list when no codes exist", async () => {
      const result = await listFriendCodes(asDb(db), accountIdA, authA);

      expect(result.data).toHaveLength(0);
    });
  });

  // ── archiveFriendCode ─────────────────────────────────────────────

  describe("archiveFriendCode", () => {
    it("archives an active code", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);

      await archiveFriendCode(asDb(db), accountIdA, created.id, authA, noopAudit);

      const remaining = await listFriendCodes(asDb(db), accountIdA, authA);
      const ids = remaining.data.map((c) => c.id);
      expect(ids).not.toContain(created.id);
    });

    it("writes audit event", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      const audit = spyAudit();

      await archiveFriendCode(asDb(db), accountIdA, created.id, authA, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-code.archived");
    });

    it("returns NOT_FOUND for missing code", async () => {
      await assertApiError(
        archiveFriendCode(
          asDb(db),
          accountIdA,
          brandId<FriendCodeId>("frc_nonexistent"),
          authA,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND for already-archived code", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      await archiveFriendCode(asDb(db), accountIdA, created.id, authA, noopAudit);

      await assertApiError(
        archiveFriendCode(asDb(db), accountIdA, created.id, authA, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── redeemFriendCode ──────────────────────────────────────────────

  describe("redeemFriendCode", () => {
    it("creates 2 connections (A->B and B->A) both pending, archives code", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);

      const result = await redeemFriendCode(asDb(db), created.code, authB, noopAudit);

      expect(result.connectionIds).toHaveLength(2);

      // Verify both connection directions exist in DB
      const connections = await db.select().from(friendConnections);
      const aToBs = connections.filter(
        (c) => c.accountId === accountIdA && c.friendAccountId === accountIdB,
      );
      const bToAs = connections.filter(
        (c) => c.accountId === accountIdB && c.friendAccountId === accountIdA,
      );
      expect(aToBs).toHaveLength(1);
      expect(bToAs).toHaveLength(1);
      expect(aToBs[0]?.status).toBe("pending");
      expect(bToAs[0]?.status).toBe("pending");

      // Verify code is archived
      const codes = await listFriendCodes(asDb(db), accountIdA, authA);
      const redeemed = codes.data.find((c) => c.id === created.id);
      expect(redeemed).toBeUndefined();
    });

    it("writes audit events for redeem and connections", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      const audit = spyAudit();

      await redeemFriendCode(asDb(db), created.code, authB, audit);

      const eventTypes = audit.calls.map((c) => c.eventType);
      expect(eventTypes).toContain("friend-code.redeemed");
      expect(eventTypes).toContain("friend-connection.created");
    });

    it("throws FRIEND_CODE_EXPIRED for expired code", async () => {
      // Create a code with a future expiry, then backdate both timestamps
      // so that expiresAt > createdAt (satisfying the CHECK constraint) but
      // expiresAt < Date.now() (making it expired at redemption time).
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit, {
        expiresAt: Date.now() + 86_400_000,
      });

      const pastCreated = Date.now() - 172_800_000;
      const pastExpiry = Date.now() - 86_400_000;
      await db
        .update(friendCodes)
        .set({ createdAt: pastCreated, expiresAt: pastExpiry })
        .where(eq(friendCodes.id, created.id));

      await assertApiError(
        redeemFriendCode(asDb(db), created.code, authB, noopAudit),
        "FRIEND_CODE_EXPIRED",
        400,
      );
    });

    it("throws NOT_FOUND for archived code", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      await archiveFriendCode(asDb(db), accountIdA, created.id, authA, noopAudit);

      await assertApiError(
        redeemFriendCode(asDb(db), created.code, authB, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND for non-existent code", async () => {
      await assertApiError(
        redeemFriendCode(asDb(db), "ZZZZ-ZZZZ", authB, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws CONFLICT for self-redeem", async () => {
      const created = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);

      await assertApiError(
        redeemFriendCode(asDb(db), created.code, authA, noopAudit),
        "CONFLICT",
        409,
        "Cannot redeem your own friend code",
      );
    });

    it("throws CONFLICT for already-friends (409)", async () => {
      // Create first connection
      const code1 = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      await redeemFriendCode(asDb(db), code1.code, authB, noopAudit);

      // Try to connect again
      const code2 = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);

      await assertApiError(
        redeemFriendCode(asDb(db), code2.code, authB, noopAudit),
        "CONFLICT",
        409,
        "Already friends",
      );
    });
  });
});
