import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgNotificationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  listDeviceTokens,
  registerDeviceToken,
  revokeDeviceToken,
  updateLastActive,
} from "../../services/device-token.service.js";
import {
  assertApiError,
  asDb,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, DeviceTokenId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { deviceTokens } = schema;

describe("device-token.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgNotificationTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(deviceTokens);
  });

  // ── registerDeviceToken ──────────────────────────────────────────────

  it("registers a new device token with dt_ prefix", async () => {
    const result = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "apns-token-abc" },
      auth,
      noopAudit,
    );

    expect(result.id).toMatch(/^dt_/);
    expect(result.systemId).toBe(systemId);
    expect(result.platform).toBe("ios");
    expect(result.token).toBe("apns-token-abc");
    expect(result.createdAt).toBeTypeOf("number");
  });

  it("upserts on same token+platform (updates lastActiveAt)", async () => {
    const first = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "android", token: "fcm-token-xyz" },
      auth,
      noopAudit,
    );

    const second = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "android", token: "fcm-token-xyz" },
      auth,
      noopAudit,
    );

    // Should return same record (upsert, not duplicate)
    expect(second.id).toBe(first.id);
    expect(second.token).toBe("fcm-token-xyz");
  });

  it("creates separate record for same token on different platform", async () => {
    const ios = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "shared-token" },
      auth,
      noopAudit,
    );

    const web = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "web", token: "shared-token" },
      auth,
      noopAudit,
    );

    expect(ios.id).not.toBe(web.id);
    expect(ios.platform).toBe("ios");
    expect(web.platform).toBe("web");
  });

  it("writes audit event on register", async () => {
    const audit = spyAudit();
    await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "audit-test-token" },
      auth,
      audit,
    );

    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.eventType).toBe("device-token.registered");
  });

  // ── revokeDeviceToken ────────────────────────────────────────────────

  it("revokes a token (excluded from list)", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "revoke-me" },
      auth,
      noopAudit,
    );

    await revokeDeviceToken(asDb(db), systemId, registered.id, auth, noopAudit);

    const tokens = await listDeviceTokens(asDb(db), systemId, auth);
    expect(tokens.map((t) => t.id)).not.toContain(registered.id);
  });

  it("writes audit event on revoke", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "revoke-audit-test" },
      auth,
      noopAudit,
    );

    const audit = spyAudit();
    await revokeDeviceToken(asDb(db), systemId, registered.id, auth, audit);

    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.eventType).toBe("device-token.revoked");
  });

  it("returns 404 when revoking non-existent token", async () => {
    await assertApiError(
      revokeDeviceToken(asDb(db), systemId, "dt_nonexistent" as DeviceTokenId, auth, noopAudit),
      "NOT_FOUND",
      404,
    );
  });

  it("returns 404 when revoking already-revoked token", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "double-revoke" },
      auth,
      noopAudit,
    );

    await revokeDeviceToken(asDb(db), systemId, registered.id, auth, noopAudit);

    await assertApiError(
      revokeDeviceToken(asDb(db), systemId, registered.id, auth, noopAudit),
      "NOT_FOUND",
      404,
    );
  });

  // ── listDeviceTokens ────────────────────────────────────────────────

  it("lists only non-revoked tokens ordered by createdAt desc", async () => {
    const t1 = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "list-token-1" },
      auth,
      noopAudit,
    );
    const t2 = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "android", token: "list-token-2" },
      auth,
      noopAudit,
    );
    const t3 = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "web", token: "list-token-3" },
      auth,
      noopAudit,
    );

    // Revoke the second one
    await revokeDeviceToken(asDb(db), systemId, t2.id, auth, noopAudit);

    const tokens = await listDeviceTokens(asDb(db), systemId, auth);
    const ids = tokens.map((t) => t.id);

    expect(ids).toContain(t1.id);
    expect(ids).not.toContain(t2.id);
    expect(ids).toContain(t3.id);
    expect(ids).toHaveLength(2);

    // Newest first
    expect(ids[0]).toBe(t3.id);
    expect(ids[1]).toBe(t1.id);
  });

  // ── updateLastActive ─────────────────────────────────────────────────

  it("updates lastActiveAt timestamp", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "last-active-test" },
      auth,
      noopAudit,
    );

    await updateLastActive(asDb(db), registered.id);

    const [row] = await db
      .select({ lastActiveAt: deviceTokens.lastActiveAt })
      .from(deviceTokens)
      .where(eq(deviceTokens.id, registered.id));

    expect(row?.lastActiveAt).not.toBeNull();
  });

  // ── Authorization ────────────────────────────────────────────────────

  it("returns 404 when system not owned by auth context", async () => {
    const otherAccountId = (await pgInsertAccount(db)) as AccountId;
    const otherSystemId = (await pgInsertSystem(db, otherAccountId)) as SystemId;
    const otherAuth = makeAuth(otherAccountId, otherSystemId);

    await assertApiError(
      registerDeviceToken(
        asDb(db),
        systemId,
        { platform: "ios", token: "unauthorized-token" },
        otherAuth,
        noopAudit,
      ),
      "NOT_FOUND",
      404,
    );
  });
});
