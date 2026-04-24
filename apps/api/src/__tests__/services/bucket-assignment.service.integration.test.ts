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
  assignBucketToFriend,
  listFriendBucketAssignments,
  unassignBucketFromFriend,
} from "../../services/bucket-assignment.service.js";
import { clearWebhookConfigCache } from "../../services/webhook-dispatcher.js";
import {
  asDb,
  assertApiError,
  genBucketId,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  ApiErrorCode,
  BucketId,
  FriendConnectionId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { buckets, friendConnections, friendBucketAssignments, keyGrants } = schema;

describe("bucket-assignment.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;
  let friendAccountId: AccountId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);
    await pgExec(client, PG_DDL.apiKeys);
    await pgExec(client, PG_DDL.apiKeysIndexes);
    await pgExec(client, PG_DDL.webhookConfigs);
    await pgExec(client, PG_DDL.webhookConfigsIndexes);
    await pgExec(client, PG_DDL.webhookDeliveries);
    await pgExec(client, PG_DDL.webhookDeliveriesIndexes);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
    friendAccountId = brandId<AccountId>(await pgInsertAccount(db));
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    clearWebhookConfigCache();
    await db.delete(friendBucketAssignments);
    await db.delete(keyGrants);
    await db.delete(friendConnections);
    await db.delete(buckets);
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  async function insertBucket(): Promise<BucketId> {
    const id = brandId<BucketId>(createId(ID_PREFIXES.bucket));
    const ts = now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<BucketId>(id);
  }

  async function insertConnection(
    opts: { status?: string; archived?: boolean } = {},
  ): Promise<FriendConnectionId> {
    const id = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));
    const ts = now();
    await db.insert(friendConnections).values({
      id,
      accountId,
      friendAccountId,
      status: (opts.status ?? "accepted") as "accepted",
      createdAt: ts,
      updatedAt: ts,
      archived: opts.archived ?? false,
      archivedAt: opts.archived ? ts : null,
    });
    return brandId<FriendConnectionId>(id);
  }

  function makeAssignParams(connectionId: FriendConnectionId): {
    readonly connectionId: FriendConnectionId;
    readonly encryptedBucketKey: string;
    readonly keyVersion: number;
  } {
    return {
      connectionId,
      encryptedBucketKey: Buffer.from("test-encrypted-bucket-key").toString("base64"),
      keyVersion: 1,
    };
  }

  // ── assignBucketToFriend ───────────────────────────────────────────

  describe("assignBucketToFriend", () => {
    it("creates assignment + key grant rows, audit event emitted", async () => {
      const bucketId = await insertBucket();
      const connectionId = await insertConnection();
      const audit = spyAudit();

      const result = await assignBucketToFriend(
        asDb(db),
        systemId,
        bucketId,
        makeAssignParams(connectionId),
        auth,
        audit,
      );

      expect(result.friendConnectionId).toBe(connectionId);
      expect(result.bucketId).toBe(bucketId);
      expect(result.friendAccountId).toBe(friendAccountId);

      // Verify assignment row exists
      const assignments = await db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.bucketId, bucketId));
      expect(assignments).toHaveLength(1);

      // Verify key grant row exists
      const grants = await db.select().from(keyGrants).where(eq(keyGrants.bucketId, bucketId));
      expect(grants).toHaveLength(1);
      expect(grants[0]?.friendAccountId).toBe(friendAccountId);
      expect(grants[0]?.keyVersion).toBe(1);
      expect(grants[0]?.revokedAt).toBeNull();

      // Verify audit
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-bucket-assignment.assigned");
    });

    it("throws NOT_FOUND for non-existent bucket", async () => {
      const connectionId = await insertConnection();

      await assertApiError(
        assignBucketToFriend(
          asDb(db),
          systemId,
          genBucketId(),
          makeAssignParams(connectionId),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND for archived bucket", async () => {
      const bucketId = await insertBucket();
      await db
        .update(buckets)
        .set({ archived: true, archivedAt: now() })
        .where(eq(buckets.id, bucketId));
      const connectionId = await insertConnection();

      await assertApiError(
        assignBucketToFriend(
          asDb(db),
          systemId,
          bucketId,
          makeAssignParams(connectionId),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws CONNECTION_NOT_ACCEPTED for non-accepted connection", async () => {
      const bucketId = await insertBucket();
      const connectionId = await insertConnection({ status: "pending" });

      await assertApiError(
        assignBucketToFriend(
          asDb(db),
          systemId,
          bucketId,
          makeAssignParams(connectionId),
          auth,
          noopAudit,
        ),
        "CONNECTION_NOT_ACCEPTED" as ApiErrorCode,
        400,
      );
    });

    it("throws NOT_FOUND for non-existent connection", async () => {
      const bucketId = await insertBucket();
      const fakeConnectionId = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);

      await assertApiError(
        assignBucketToFriend(
          asDb(db),
          systemId,
          bucketId,
          makeAssignParams(fakeConnectionId),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("is idempotent (duplicate assignment, no error, no duplicate row)", async () => {
      const bucketId = await insertBucket();
      const connectionId = await insertConnection();
      const params = makeAssignParams(connectionId);

      // First assignment
      const firstAudit = spyAudit();
      await assignBucketToFriend(asDb(db), systemId, bucketId, params, auth, firstAudit);
      expect(firstAudit.calls).toHaveLength(1);

      // Second assignment (idempotent)
      const secondAudit = spyAudit();
      const result = await assignBucketToFriend(
        asDb(db),
        systemId,
        bucketId,
        params,
        auth,
        secondAudit,
      );

      // Should not emit audit on duplicate
      expect(secondAudit.calls).toHaveLength(0);

      // Should still return the same result
      expect(result.friendConnectionId).toBe(connectionId);
      expect(result.bucketId).toBe(bucketId);

      // Should still only have one assignment row
      const assignments = await db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.bucketId, bucketId));
      expect(assignments).toHaveLength(1);
    });
  });

  // ── unassignBucketFromFriend ──────────────────────────────────────

  describe("unassignBucketFromFriend", () => {
    it("deletes assignment, sets revokedAt on key grants, emits audit", async () => {
      const bucketId = await insertBucket();
      const connectionId = await insertConnection();
      await assignBucketToFriend(
        asDb(db),
        systemId,
        bucketId,
        makeAssignParams(connectionId),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await unassignBucketFromFriend(asDb(db), systemId, bucketId, connectionId, auth, audit);

      // Verify assignment deleted
      const assignments = await db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.bucketId, bucketId));
      expect(assignments).toHaveLength(0);

      // Verify key grants have revokedAt set
      const grants = await db.select().from(keyGrants).where(eq(keyGrants.bucketId, bucketId));
      expect(grants).toHaveLength(1);
      expect(grants[0]?.revokedAt).not.toBeNull();

      // Verify audit
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("friend-bucket-assignment.unassigned");
    });

    it("throws NOT_FOUND for non-existent assignment", async () => {
      const bucketId = await insertBucket();
      const connectionId = await insertConnection();

      await assertApiError(
        unassignBucketFromFriend(asDb(db), systemId, bucketId, connectionId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── listFriendBucketAssignments ───────────────────────────────────

  describe("listFriendBucketAssignments", () => {
    it("returns all assignments for bucket", async () => {
      const bucketId = await insertBucket();
      const connectionId1 = await insertConnection();

      // Need a second friend account for a second connection
      const friendAccount2 = brandId<AccountId>(await pgInsertAccount(db));
      const connectionId2 = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));
      const ts = now();
      await db.insert(friendConnections).values({
        id: connectionId2,
        accountId,
        friendAccountId: friendAccount2,
        status: "accepted" as const,
        createdAt: ts,
        updatedAt: ts,
      });

      await assignBucketToFriend(
        asDb(db),
        systemId,
        bucketId,
        makeAssignParams(connectionId1),
        auth,
        noopAudit,
      );
      await assignBucketToFriend(
        asDb(db),
        systemId,
        bucketId,
        {
          connectionId: brandId<FriendConnectionId>(connectionId2),
          encryptedBucketKey: Buffer.from("key-2").toString("base64"),
          keyVersion: 1,
        },
        auth,
        noopAudit,
      );

      const result = await listFriendBucketAssignments(asDb(db), systemId, bucketId, auth);

      expect(result).toHaveLength(2);
      const connectionIds = result.map((r) => r.friendConnectionId);
      expect(connectionIds).toContain(connectionId1);
      expect(connectionIds).toContain(connectionId2);
    });

    it("returns empty list when no assignments", async () => {
      const bucketId = await insertBucket();

      const result = await listFriendBucketAssignments(asDb(db), systemId, bucketId, auth);

      expect(result).toHaveLength(0);
    });
  });
});
