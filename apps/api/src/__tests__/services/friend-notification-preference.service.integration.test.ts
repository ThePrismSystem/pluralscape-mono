import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgNotificationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getOrCreateFriendNotificationPreference,
  listFriendNotificationPreferences,
  updateFriendNotificationPreference,
} from "../../services/friend-notification-preference.service.js";
import {
  assertApiError,
  asDb,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, FriendConnectionId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { friendConnections, friendNotificationPreferences } = schema;

/** Insert an accepted friend connection for testing. */
async function insertFriendConnection(
  db: PgliteDatabase<typeof schema>,
  accountId: AccountId,
  friendAccountId: AccountId,
): Promise<FriendConnectionId> {
  const id = brandId<FriendConnectionId>(`fc_${crypto.randomUUID()}`);
  const now = toUnixMillis(Date.now());
  await db.insert(friendConnections).values({
    id,
    accountId,
    friendAccountId,
    status: "accepted",
    createdAt: now,
    updatedAt: now,
    version: 1,
    archived: false,
    archivedAt: null,
  });
  return id;
}

describe("friend-notification-preference.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  let accountIdA: AccountId;
  let systemIdA: SystemId;
  let authA: AuthContext;
  let accountIdB: AccountId;
  let systemIdB: SystemId;
  let connectionId: FriendConnectionId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgNotificationTables(client);

    accountIdA = brandId<AccountId>(await pgInsertAccount(db));
    systemIdA = brandId<SystemId>(await pgInsertSystem(db, accountIdA));
    authA = makeAuth(accountIdA, systemIdA);

    accountIdB = brandId<AccountId>(await pgInsertAccount(db));
    systemIdB = brandId<SystemId>(await pgInsertSystem(db, accountIdB));
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(friendNotificationPreferences);
    await db.delete(friendConnections);
  });

  // ── getOrCreateFriendNotificationPreference ──────────────────────────

  it("creates preference with default enabled event types", async () => {
    connectionId = await insertFriendConnection(db, accountIdA, accountIdB);

    const result = await getOrCreateFriendNotificationPreference(
      asDb(db),
      accountIdA,
      connectionId,
      authA,
    );

    expect(result.id).toMatch(/^fnp_/);
    expect(result.accountId).toBe(accountIdA);
    expect(result.friendConnectionId).toBe(connectionId);
    expect(result.enabledEventTypes).toEqual(["friend-switch-alert"]);
    expect(result.createdAt).toBeTypeOf("number");
    expect(result.updatedAt).toBeTypeOf("number");
  });

  it("returns same record on subsequent calls (idempotent)", async () => {
    connectionId = await insertFriendConnection(db, accountIdA, accountIdB);

    const first = await getOrCreateFriendNotificationPreference(
      asDb(db),
      accountIdA,
      connectionId,
      authA,
    );
    const second = await getOrCreateFriendNotificationPreference(
      asDb(db),
      accountIdA,
      connectionId,
      authA,
    );

    expect(second.id).toBe(first.id);
  });

  // ── updateFriendNotificationPreference ───────────────────────────────

  it("updates enabled event types", async () => {
    connectionId = await insertFriendConnection(db, accountIdA, accountIdB);
    await getOrCreateFriendNotificationPreference(asDb(db), accountIdA, connectionId, authA);

    const updated = await updateFriendNotificationPreference(
      asDb(db),
      accountIdA,
      connectionId,
      { enabledEventTypes: [] },
      authA,
      noopAudit,
    );

    expect(updated.enabledEventTypes).toEqual([]);
  });

  it("restores event types after clearing", async () => {
    connectionId = await insertFriendConnection(db, accountIdA, accountIdB);
    await getOrCreateFriendNotificationPreference(asDb(db), accountIdA, connectionId, authA);

    await updateFriendNotificationPreference(
      asDb(db),
      accountIdA,
      connectionId,
      { enabledEventTypes: [] },
      authA,
      noopAudit,
    );

    const restored = await updateFriendNotificationPreference(
      asDb(db),
      accountIdA,
      connectionId,
      { enabledEventTypes: ["friend-switch-alert"] },
      authA,
      noopAudit,
    );

    expect(restored.enabledEventTypes).toEqual(["friend-switch-alert"]);
  });

  it("writes audit event on update", async () => {
    connectionId = await insertFriendConnection(db, accountIdA, accountIdB);
    await getOrCreateFriendNotificationPreference(asDb(db), accountIdA, connectionId, authA);

    const audit = spyAudit();
    await updateFriendNotificationPreference(
      asDb(db),
      accountIdA,
      connectionId,
      { enabledEventTypes: [] },
      authA,
      audit,
    );

    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.eventType).toBe("friend-notification-preference.updated");
  });

  it("returns 404 for non-existent preference on update", async () => {
    connectionId = await insertFriendConnection(db, accountIdA, accountIdB);

    // No getOrCreate first — preference doesn't exist
    await assertApiError(
      updateFriendNotificationPreference(
        asDb(db),
        accountIdA,
        brandId<FriendConnectionId>("fc_nonexistent"),
        { enabledEventTypes: [] },
        authA,
        noopAudit,
      ),
      "NOT_FOUND",
      404,
    );
  });

  // ── listFriendNotificationPreferences ────────────────────────────────

  it("lists preferences scoped to account", async () => {
    // Need separate friend accounts to avoid unique constraint on (account_id, friend_account_id)
    const accountIdC = brandId<AccountId>(await pgInsertAccount(db));
    const conn1 = await insertFriendConnection(db, accountIdA, accountIdB);
    const conn2 = await insertFriendConnection(db, accountIdA, accountIdC);

    await getOrCreateFriendNotificationPreference(asDb(db), accountIdA, conn1, authA);
    await getOrCreateFriendNotificationPreference(asDb(db), accountIdA, conn2, authA);

    const prefs = await listFriendNotificationPreferences(asDb(db), accountIdA, authA);
    expect(prefs).toHaveLength(2);
    const connIds = prefs.map((p) => p.friendConnectionId);
    expect(connIds).toContain(conn1);
    expect(connIds).toContain(conn2);
  });

  it("returns empty array when no preferences exist", async () => {
    const prefs = await listFriendNotificationPreferences(asDb(db), accountIdA, authA);
    expect(prefs).toHaveLength(0);
  });

  // ── Authorization ────────────────────────────────────────────────────

  it("returns 404 when account not owned by auth context", async () => {
    connectionId = await insertFriendConnection(db, accountIdA, accountIdB);
    const authB = makeAuth(accountIdB, systemIdB);

    await assertApiError(
      getOrCreateFriendNotificationPreference(asDb(db), accountIdA, connectionId, authB),
      "NOT_FOUND",
      404,
    );
  });
});
