import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { createId, ID_PREFIXES, now, brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveFriendConnection,
  restoreFriendConnection,
} from "../../services/account/friends/lifecycle.js";
import {
  getFriendConnection,
  listFriendConnections,
} from "../../services/account/friends/queries.js";
import {
  blockFriendConnection,
  removeFriendConnection,
} from "../../services/account/friends/transitions.js";
import { updateFriendVisibility } from "../../services/account/friends/update.js";
import {
  assertApiError,
  asDb,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  FriendConnectionId,
  FriendConnectionStatus,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { friendConnections, friendBucketAssignments, keyGrants, buckets } = schema;

/** Insert a friend connection row directly for test setup. */
async function insertConnection(
  db: PgliteDatabase<typeof schema>,
  opts: {
    id?: string;
    accountId: string;
    friendAccountId: string;
    status?: FriendConnectionStatus;
    version?: number;
    archived?: boolean;
    archivedAt?: number | null;
  },
): Promise<string> {
  const id = opts.id ?? createId(ID_PREFIXES.friendConnection);
  const timestamp = now();
  await db.insert(friendConnections).values({
    id,
    accountId: opts.accountId,
    friendAccountId: opts.friendAccountId,
    status: opts.status ?? "accepted",
    version: opts.version ?? 1,
    archived: opts.archived ?? false,
    archivedAt: opts.archivedAt ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return id;
}

describe("friend-connection.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let friendAccountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);

    // Additional tables needed for webhook dispatcher and systems lookup
    await pgExec(client, PG_DDL.apiKeys);
    await pgExec(client, PG_DDL.apiKeysIndexes);
    await pgExec(client, PG_DDL.webhookConfigs);
    await pgExec(client, PG_DDL.webhookConfigsIndexes);
    await pgExec(client, PG_DDL.webhookDeliveries);
    await pgExec(client, PG_DDL.webhookDeliveriesIndexes);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    friendAccountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(friendBucketAssignments);
    await db.delete(keyGrants);
    await db.delete(friendConnections);
    await db.delete(buckets);
  });

  // ── listFriendConnections ──────────────────────────────────────────

  describe("listFriendConnections", () => {
    it("returns paginated results", async () => {
      await insertConnection(db, { accountId, friendAccountId });

      const result = await listFriendConnections(asDb(db), accountId, auth);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.accountId).toBe(accountId);
    });

    it("supports composite cursor pagination", async () => {
      // Create 3 connections with different friend accounts
      const friend2 = brandId<AccountId>(await pgInsertAccount(db));
      const friend3 = brandId<AccountId>(await pgInsertAccount(db));
      await insertConnection(db, { accountId, friendAccountId });
      await insertConnection(db, { accountId, friendAccountId: friend2 });
      await insertConnection(db, { accountId, friendAccountId: friend3 });

      const page1 = await listFriendConnections(asDb(db), accountId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(typeof page1.nextCursor).toBe("string");

      const page2 = await listFriendConnections(asDb(db), accountId, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it("filters by accountId", async () => {
      const otherAccount = brandId<AccountId>(await pgInsertAccount(db));
      await insertConnection(db, { accountId, friendAccountId });
      await insertConnection(db, { accountId: otherAccount, friendAccountId: accountId });

      const result = await listFriendConnections(asDb(db), accountId, auth);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.accountId).toBe(accountId);
    });

    it("returns empty list when no connections exist", async () => {
      const result = await listFriendConnections(asDb(db), accountId, auth);

      expect(result.data).toHaveLength(0);
    });

    it("excludes archived connections by default", async () => {
      const archivedId = await insertConnection(db, {
        accountId,
        friendAccountId,
        archived: true,
        archivedAt: now(),
      });
      const friend2 = brandId<AccountId>(await pgInsertAccount(db));
      const activeId = await insertConnection(db, {
        accountId,
        friendAccountId: friend2,
      });

      const result = await listFriendConnections(asDb(db), accountId, auth);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(activeId);
      expect(result.data.find((c) => c.id === archivedId)).toBeUndefined();
    });

    it("includes archived connections when includeArchived is true", async () => {
      await insertConnection(db, {
        accountId,
        friendAccountId,
        archived: true,
        archivedAt: now(),
      });
      const friend2 = brandId<AccountId>(await pgInsertAccount(db));
      await insertConnection(db, {
        accountId,
        friendAccountId: friend2,
      });

      const result = await listFriendConnections(asDb(db), accountId, auth, {
        includeArchived: true,
      });

      expect(result.data).toHaveLength(2);
    });

    it("throws INVALID_CURSOR for malformed cursor string", async () => {
      await assertApiError(
        listFriendConnections(asDb(db), accountId, auth, { cursor: "not-a-valid-cursor" }),
        "INVALID_CURSOR" as Parameters<typeof assertApiError>[1],
        400,
      );
    });
  });

  // ── getFriendConnection ────────────────────────────────────────────

  describe("getFriendConnection", () => {
    it("returns connection by id", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      const result = await getFriendConnection(asDb(db), accountId, connId, auth);

      expect(result.id).toBe(connId);
      expect(result.accountId).toBe(accountId);
      expect(result.friendAccountId).toBe(friendAccountId);
      expect(result.status).toBe("accepted");
    });

    it("returns 404 for missing connection", async () => {
      const fakeId = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);

      await assertApiError(
        getFriendConnection(asDb(db), accountId, fakeId, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("returns 404 for archived connection", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          archived: true,
          archivedAt: now(),
        }),
      );

      await assertApiError(
        getFriendConnection(asDb(db), accountId, connId, auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── blockFriendConnection ──────────────────────────────────────────

  describe("blockFriendConnection", () => {
    it("blocks accepted connection", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "accepted",
        }),
      );

      const result = await blockFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      expect(result.status).toBe("blocked");
    });

    it("throws 409 when already blocked", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "blocked",
        }),
      );

      await assertApiError(
        blockFriendConnection(asDb(db), accountId, connId, auth, noopAudit),
        "CONFLICT",
        409,
      );
    });

    it("throws 409 when already removed", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "removed",
        }),
      );

      await assertApiError(
        blockFriendConnection(asDb(db), accountId, connId, auth, noopAudit),
        "CONFLICT",
        409,
      );
    });

    it("blocking A->B also blocks B->A (bilateral)", async () => {
      // Create bidirectional connections
      const abId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "accepted",
        }),
      );

      const friendAuth = makeAuth(friendAccountId, systemId);
      await insertConnection(db, {
        accountId: friendAccountId,
        friendAccountId: accountId,
        status: "accepted",
      });

      // Block A->B — should also block B->A
      await blockFriendConnection(asDb(db), accountId, abId, auth, noopAudit);

      // B->A should also be blocked (bilateral behavior)
      const listB = await listFriendConnections(asDb(db), friendAccountId, friendAuth);
      expect(listB.data).toHaveLength(1);
      expect(listB.data[0]?.status).toBe("blocked");
    });

    it("writes audit event", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "accepted",
        }),
      );

      const audit = spyAudit();
      await blockFriendConnection(asDb(db), accountId, connId, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-connection.blocked");
    });
  });

  // ── removeFriendConnection ─────────────────────────────────────────

  describe("removeFriendConnection", () => {
    it("removes accepted connection", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "accepted",
        }),
      );

      const result = await removeFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      expect(result.status).toBe("removed");
    });

    it("removes blocked connection", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "blocked",
        }),
      );

      const result = await removeFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      expect(result.status).toBe("removed");
    });

    it("throws 409 when already removed", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "removed",
        }),
      );

      await assertApiError(
        removeFriendConnection(asDb(db), accountId, connId, auth, noopAudit),
        "CONFLICT",
        409,
      );
    });

    it("deletes bucket assignments on remove", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "accepted",
        }),
      );

      // Create a bucket and assignment
      const bucketTimestamp = now();
      const bucketId = createId(ID_PREFIXES.bucket);
      await db.insert(buckets).values({
        id: bucketId,
        systemId,
        encryptedData: testBlob(),
        createdAt: bucketTimestamp,
        updatedAt: bucketTimestamp,
      });
      await db.insert(friendBucketAssignments).values({
        friendConnectionId: connId,
        bucketId,
        systemId,
      });

      await removeFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      // Verify bucket assignments are deleted
      const remaining = await db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.friendConnectionId, connId));
      expect(remaining).toHaveLength(0);
    });

    it("revokes key grants on remove", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "accepted",
        }),
      );

      // Create a bucket, assignment, and key grant
      const bucketTimestamp = now();
      const bucketId = createId(ID_PREFIXES.bucket);
      await db.insert(buckets).values({
        id: bucketId,
        systemId,
        encryptedData: testBlob(),
        createdAt: bucketTimestamp,
        updatedAt: bucketTimestamp,
      });
      await db.insert(friendBucketAssignments).values({
        friendConnectionId: connId,
        bucketId,
        systemId,
      });
      const keyGrantId = createId(ID_PREFIXES.keyGrant);
      await db.insert(keyGrants).values({
        id: keyGrantId,
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: new Uint8Array([1, 2, 3, 4]),
        keyVersion: 1,
        createdAt: bucketTimestamp,
      });

      await removeFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      // Verify key grants are revoked (revokedAt is set)
      const grants = await db.select().from(keyGrants).where(eq(keyGrants.id, keyGrantId));
      expect(grants).toHaveLength(1);
      expect(grants[0]?.revokedAt).not.toBeNull();
    });

    it("writes audit event", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
          status: "accepted",
        }),
      );

      const audit = spyAudit();
      await removeFriendConnection(asDb(db), accountId, connId, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-connection.removed");
    });
  });

  // ── updateFriendVisibility ─────────────────────────────────────────

  describe("updateFriendVisibility", () => {
    it("updates with correct version and bumps version", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      const result = await updateFriendVisibility(
        asDb(db),
        accountId,
        connId,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      expect(result.version).toBe(2);
      expect(result.encryptedData).not.toBeNull();
    });

    it("throws 409 CONFLICT on stale version", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      await assertApiError(
        updateFriendVisibility(
          asDb(db),
          accountId,
          connId,
          { encryptedData: testEncryptedDataBase64(), version: 999 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("throws 404 for missing connection", async () => {
      const fakeId = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);

      await assertApiError(
        updateFriendVisibility(
          asDb(db),
          accountId,
          fakeId,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      const audit = spyAudit();
      await updateFriendVisibility(
        asDb(db),
        accountId,
        connId,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-visibility.updated");
    });
  });

  // ── archiveFriendConnection ────────────────────────────────────────

  describe("archiveFriendConnection", () => {
    it("archives successfully", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      await archiveFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      // Should be invisible to getFriendConnection
      await assertApiError(
        getFriendConnection(asDb(db), accountId, connId, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("throws 404 for missing connection", async () => {
      const fakeId = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);

      await assertApiError(
        archiveFriendConnection(asDb(db), accountId, fakeId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws 409 for already archived connection", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      await archiveFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      await assertApiError(
        archiveFriendConnection(asDb(db), accountId, connId, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });

    it("writes audit event", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      const audit = spyAudit();
      await archiveFriendConnection(asDb(db), accountId, connId, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-connection.archived");
    });
  });

  // ── restoreFriendConnection ────────────────────────────────────────

  describe("restoreFriendConnection", () => {
    it("restores successfully", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      await archiveFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      const result = await restoreFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      expect(result.id).toBe(connId);
      expect(result.version).toBe(3); // 1 -> archive bumps to 2, restore bumps to 3
    });

    it("throws 404 for non-archived connection", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      await assertApiError(
        restoreFriendConnection(asDb(db), accountId, connId, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
      );
    });

    it("throws 404 for missing connection", async () => {
      const fakeId = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);

      await assertApiError(
        restoreFriendConnection(asDb(db), accountId, fakeId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event", async () => {
      const connId = brandId<FriendConnectionId>(
        await insertConnection(db, {
          accountId,
          friendAccountId,
        }),
      );

      await archiveFriendConnection(asDb(db), accountId, connId, auth, noopAudit);

      const audit = spyAudit();
      await restoreFriendConnection(asDb(db), accountId, connId, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-connection.restored");
    });
  });
});
